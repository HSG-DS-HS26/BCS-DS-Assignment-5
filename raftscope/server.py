#!/usr/bin/env python3
"""Serve RaftScope as a webpage and store Raft exercises (challenges).

Run from the repository root of the assignment:

    python raftscope/server.py

then open http://localhost:8060 in a browser. The RaftScope visualization is
served from the directory containing this script; exercises exported with the
"Export challenge" button are stored as pretty-printed JSON files in the
exercises directory (default: ./exercises), so they can be committed, and
"Import challenge" lists and loads them back.

Only the Python standard library is used.
"""

import argparse
import json
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DEFAULT_PORT = 8060
MAX_BODY_BYTES = 64 * 1024 * 1024
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")

FILES_ROOT = Path(__file__).resolve().parent
EXERCISES_ROOT = Path.cwd() / "exercises"


class BadRequest(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def exercise_is_valid(exercise):
    """Light validation; the browser validates the same fields."""

    def is_state_string(value):
        if not isinstance(value, str):
            return False
        try:
            parsed = json.loads(value)
        except ValueError:
            return False
        return (
            isinstance(parsed, dict)
            and isinstance(parsed.get("checkpoints"), list)
            and parsed["checkpoints"]
            and isinstance(parsed.get("maxTime"), (int, float))
        )

    return (
        isinstance(exercise, dict)
        and exercise.get("format") == 1
        and isinstance(exercise.get("question"), str)
        and exercise["question"].strip() != ""
        and isinstance(exercise.get("answers"), list)
        and len(exercise["answers"]) == 4
        and all(isinstance(a, str) and a.strip() != "" for a in exercise["answers"])
        and isinstance(exercise.get("correct"), int)
        and 0 <= exercise["correct"] < 4
        and isinstance(exercise.get("stageTime"), (int, float))
        and exercise["stageTime"] >= 0
        and is_state_string(exercise.get("stage"))
        and is_state_string(exercise.get("solution"))
    )


def read_exercise(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


class ChallengeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FILES_ROOT), **kwargs)

    # ------------------------------------------------------------- helpers

    def reply_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def reply_error(self, status, message):
        self.reply_json(status, {"error": message})

    def parse_challenge_path(self, path):
        """Return the challenge name for /api/challenges/<name>, else None."""
        prefix = "/api/challenges/"
        if not path.startswith(prefix) or "/" in path[len(prefix):]:
            raise BadRequest("expected /api/challenges/<name> with a simple name")
        name = path[len(prefix):]
        if not NAME_RE.match(name):
            raise BadRequest("challenge names are lowercase letters, digits and dashes")
        return name

    def serve_api(self, method):
        try:
            if method == "GET" and self.path == "/api/challenges":
                self.list_challenges()
                return True
            if method == "GET" and self.path.startswith("/api/challenges/"):
                self.get_challenge(self.path)
                return True
            if method == "POST" and self.path.startswith("/api/challenges/"):
                self.post_challenge(self.path)
                return True
        except BadRequest as e:
            self.reply_error(400, e.message)
            return True
        except BrokenPipeError:
            return True
        return False

    # ---------------------------------------------------------------- api

    def list_challenges(self):
        challenge_dir = EXERCISES_ROOT
        challenges = []
        if challenge_dir.is_dir():
            for path in sorted(challenge_dir.glob("*.json")):
                if not NAME_RE.match(path.stem):
                    continue
                exercise = read_exercise(path)
                if exercise is not None:
                    challenges.append({
                        "name": path.stem,
                        "question": exercise.get("question", ""),
                    })
        self.reply_json(200, {"exercises": challenges})

    def challenge_path(self, name):
        return EXERCISES_ROOT / (name + ".json")

    def get_challenge(self, path):
        name = self.parse_challenge_path(path)
        exercise = read_exercise(self.challenge_path(name))
        if exercise is None:
            self.reply_error(404, "no challenge named %r" % name)
            return
        self.reply_json(200, exercise)

    def post_challenge(self, path):
        name = self.parse_challenge_path(path)
        length = self.headers.get("Content-Length")
        try:
            length = int(length)
        except (TypeError, ValueError):
            raise BadRequest("missing or invalid Content-Length")
        if length <= 0 or length > MAX_BODY_BYTES:
            raise BadRequest("unexpected body size")
        body = self.rfile.read(length)
        try:
            exercise = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise BadRequest("body is not valid JSON or UTF-8")
        if not exercise_is_valid(exercise):
            raise BadRequest(
                "not a valid exercise: it needs format 1, a question, four "
                "non-empty answers, a correct answer, a stage time and two "
                "recorded timelines (stage and solution)")
        existed = self.challenge_path(name).exists()
        EXERCISES_ROOT.mkdir(parents=True, exist_ok=True)
        with open(self.challenge_path(name), "w", encoding="utf-8") as f:
            json.dump(exercise, f, indent=2, ensure_ascii=False)
            f.write("\n")
        self.reply_json(200 if existed else 201, {
            "name": name,
            "file": str(self.challenge_path(name)),
        })

    # ------------------------------------------------------------- routing

    def do_GET(self):
        if self.serve_api("GET"):
            return
        super().do_GET()

    def do_POST(self):
        if self.serve_api("POST"):
            return
        self.reply_error(404, "unknown API path")

    def send_error(self, code, message=None, explain=None):
        # Keep static-file failures machine-readable for the fetch() callers.
        self.reply_json(code, {"error": message or "error"})


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--host", default="127.0.0.1", help="bind address (default: %(default)s)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port (default: %(default)s)")
    parser.add_argument("--exercises", type=Path, default=None, dest="exercises",
                        help="exercises directory (default: ./exercises, "
                             "relative to where the server is started)")
    args = parser.parse_args()

    global EXERCISES_ROOT
    if args.exercises is not None:
        EXERCISES_ROOT = args.exercises.resolve()

    server = ThreadingHTTPServer((args.host, args.port), ChallengeHandler)
    print("Serving RaftScope at http://%s:%d" % (args.host, args.port))
    print("Storing challenges in %s" % EXERCISES_ROOT, file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
