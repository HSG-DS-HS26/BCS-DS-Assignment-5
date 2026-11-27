#!/usr/bin/env python3
"""Writes the PDF you upload to Canvas, after checking that GitHub has your work.

Run it from anywhere inside your copy of the repository:

    python3 submission/submission.py

or with the Hand in button in the VS Code status bar, or with ./submit.sh or
.\\submit.ps1. All of them run this file.

The PDF names your repository and the commit GitHub holds. The TA grades that
commit, so the program refuses to write a PDF for work that is not on GitHub:
uncommitted changes, commits you have not pushed, or a commit the viva pushed
that you have not pulled yet.

It needs git and Python 3.9 or later, and nothing else.
"""
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

TEMPLATE_OWNER = "HSG-DS-HS26"
SCREENSHOTS = {"task1_q2_1.png", "task1_q2_2.png", "task1_q3_1.png", "task1_q3_2.png"}
# The template's stand-ins inside a TODO block: they run but do nothing.
PLACEHOLDERS = {"pass", "return True", "return None"}


def fail(what, todo):
    print(f"\nNo PDF written: {what}\n{todo}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------- git

def git_or_none(root, *args):
    """Standard output, or None when git exits non-zero."""
    try:
        p = subprocess.run(["git", *args], cwd=root, capture_output=True,
                           text=True, encoding="utf-8", errors="replace")
    except FileNotFoundError:
        fail("git is not installed or not on the PATH.", "Install git, or work in a Codespace.")
    return p.stdout if p.returncode == 0 else None


def git(root, *args):
    out = git_or_none(root, *args)
    if out is None:
        fail(f"'git {' '.join(args)}' failed.", "Run this from inside your copy of the repository.")
    return out.strip()


def repo_of(remote):
    """owner/name out of an https or ssh GitHub remote, or None."""
    m = re.search(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?$", remote)
    return f"{m.group(1)}/{m.group(2)}" if m else None


# ---------------------------------------------------------------- the checks

def screenshots_there(images):
    """True if images/ holds every screenshot of Task 1, in any letter case (.PNG or .png)."""
    return images.is_dir() and SCREENSHOTS <= {f.name.lower() for f in images.iterdir()}


def todos_done(file):
    """True if every "# TODO start" ... "# TODO end" block holds code of its own:
    a line that is not a comment and not a placeholder left from the template."""
    if not file.is_file():
        return False
    in_block = has_code = False
    for line in file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("# TODO start"):
            in_block, has_code = True, False
        elif line.startswith("# TODO end"):
            if not (in_block and has_code):
                return False
            in_block = False
        elif in_block and line and not line.startswith("#") and line not in PLACEHOLDERS:
            has_code = True
    return not in_block


def all_answered(file):
    """True if every "**Answer:**" is followed by some text before the next question or heading."""
    if not file.is_file():
        return False
    parts = file.read_text(encoding="utf-8").split("**Answer:**")
    return len(parts) > 1 and all(
        re.split(r"\n\s*\d+\. |\n##+ ", part, maxsplit=1)[0].strip() for part in parts[1:])


def has_files(folder):
    return folder.is_dir() and any(p.is_file() for p in folder.rglob("*"))


# ---------------------------------------------------------------------- pdf

def escape(text):
    """PDF string escaping, and anything outside printable ASCII becomes '?'."""
    return "".join("\\" + c if c in "()\\" else c if 32 <= ord(c) <= 126 else "?" for c in text)


def pdf(title, lines):
    """A single-page PDF in the two fonts every reader has, with the repository as the
    document title as well, so it shows in the reader's title bar. lines holds
    (bold, size, text); a line without text is a gap."""
    content = "BT\n50 790 Td\n"
    previous = 0
    for bold, size, text in lines:
        if previous:
            content += f"0 -{previous + 6} Td\n"
        if text:
            content += f"/{'F2' if bold else 'F1'} {size} Tf\n({escape(text)}) Tj\n"
        previous = size
    content += "ET\n"

    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]"
        " /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        f"<< /Length {len(content)} >>\nstream\n{content}endstream",
        f"<< /Title ({escape(title)}) /Creator (submission/submission.py) >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{obj}\nendobj\n".encode("ascii")
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii")
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode("ascii")
    out += (f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info {len(objects)} 0 R >>\n"
            f"startxref\n{xref}\n%%EOF\n").encode("ascii")
    return bytes(out)


# --------------------------------------------------------------------- main

def main():
    root = Path(git(None, "rev-parse", "--show-toplevel"))

    remote = git(root, "remote", "get-url", "origin")
    repo = repo_of(remote)
    if repo is None:
        fail(f"origin is '{remote}', which is not a GitHub repository.",
             "Hand in from the private copy you made with 'Use this template'.")
    if repo.startswith(TEMPLATE_OWNER + "/"):
        fail(f"this is the assignment template itself ({repo}), not your copy.",
             "Open your own copy, github.com/<your-username>/<repo>, and run this there.")

    # The PDF this script writes does not count as a change.
    if any(not l.endswith("-submission.pdf") for l in git(root, "status", "--porcelain").splitlines()):
        fail("you have changes that are not committed.",
             "Commit them, push, and run this again. The examiner only sees what is on GitHub.")

    branch = git(root, "rev-parse", "--abbrev-ref", "HEAD")
    if branch == "HEAD":
        fail("you are not on a branch (a detached HEAD).",
             "Check out the branch you worked on, usually main, and run this again.")

    # Compared with origin rather than with whatever this branch tracks: origin is
    # the repository the TA reads, and a branch can track something else entirely,
    # such as the template it was made from.
    print("Asking GitHub what it holds...")
    if git_or_none(root, "fetch", "--quiet", "origin") is None:
        fail("could not reach GitHub to compare your work with it.", "Check your network and run this again.")
    upstream = f"origin/{branch}"
    if git_or_none(root, "rev-parse", "--verify", "--quiet", upstream) is None:
        fail(f"branch '{branch}' has never been pushed to GitHub.",
             "Push it (Source Control -> Publish Branch, or: git push -u origin HEAD) and run this again.")
    ahead = int(git(root, "rev-list", "--count", f"{upstream}..HEAD"))
    behind = int(git(root, "rev-list", "--count", f"HEAD..{upstream}"))
    if behind:
        fail(f"GitHub has {behind} commit(s) you do not have yet. After the viva, that is the viva's own record.",
             "Pull first (Source Control -> Sync Changes, or: git pull), then run this again.")
    if ahead:
        fail(f"you have {ahead} commit(s) that are not on GitHub yet.",
             "Push them (Source Control -> Sync Changes, or: git push), then run this again.")

    commit = git(root, "rev-parse", "HEAD")
    committed = git(root, "log", "-1", "--format=%cI")

    checks = [
        ("Task 1: the 4 screenshots in images/", screenshots_there(root / "images")),
        ("Task 2: every TODO block filled in kv/kvstorage.py", todos_done(root / "kv/kvstorage.py")),
        ("Task 2: every TODO block filled in kv/kvstorage_http.py", todos_done(root / "kv/kvstorage_http.py")),
        ("Tasks 1 to 4: every question in REPORT.md answered", all_answered(root / "REPORT.md")),
        ("Viva: the record in .viva/", has_files(root / ".viva")),
    ]

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    gap = (False, 8, "")
    lines = [
        (True, 20, "BCS-DS Assignment 5: submission"), gap,
        (True, 13, "Repository"),
        (False, 13, repo),
        (False, 11, f"https://github.com/{repo}"), gap,
        (True, 13, "Commit graded"),
        (False, 11, commit),
        (False, 11, f"branch {branch}, committed {committed}"), gap,
        (True, 13, "Checked when this PDF was written"),
        (False, 11, "[x] every change committed"),
        (False, 11, "[x] the commit above is on GitHub"),
        *[(False, 11, ("[x] " if ok else "[ ] ") + what) for what, ok in checks], gap,
        (False, 9, f"Written by submission/submission.py on {generated}."),
    ]

    out = root / (repo.replace("/", "-") + "-submission.pdf")
    out.write_bytes(pdf(repo, lines))

    print(f"\nWrote {out.relative_to(root)}")
    print(f"  repository  {repo}")
    print(f"  commit      {commit}")
    for what, ok in checks:
        print(f"  {'ok      ' if ok else 'MISSING '}{what}")
    if not all(ok for _, ok in checks):
        print("\nSomething above is missing. If that is not what you meant to hand in,")
        print("add it, commit, push, and run this again: the PDF lists what was missing.")
    print("\nNext: upload that PDF to the assignment on Canvas.")
    print("If you change anything after this, commit, push, and write the PDF again.")


if __name__ == "__main__":
    main()
