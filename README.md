# Distributed Systems - Assignment 5

[TASKS.md](TASKS.md) contains the assignment tasks. This README covers the setup.

## Learning objectives

1. Use the Raft visualization and server status to explain how Raft elects a leader and replicates a log entry.
2. Implement a key/value store as a replicated state machine with a Raft library, and distinguish operations that pass through the Raft log from those that do not.
3. Use server status to predict and explain how a Raft group behaves when servers crash, restart, or lose their majority.
4. Explain the fault tolerance boundaries of Raft, and explain how its leader election mechanism compares to alternative election algorithms.
5. Create exercises that test understanding and edge cases of the Raft algorithm.

## Setup

In VS Code or Codespaces, choose "Reopen in Container". The Dev Container has Docker and Python, with the dependencies in `.venv`.

Without the Dev Container, install Docker and run the `docker compose` commands in [TASKS.md](TASKS.md). The `partition.sh` and `reconnect.sh` scripts require a bash shell. On Windows, use WSL2 and convert the scripts' line endings with `dos2unix` if bash rejects them.

## Layout

| Path | Purpose |
|------|------|
| `kv/kvstorage.py` | key/value service implemented as a PySyncObj `SyncObj` |
| `kv/kvstorage_http.py` | HTTP server for the key/value service |
| `api_description.yml` | OpenAPI description of the server API |
| `docker/compose.yml` | three-server setup for Tasks 2 and 3 |
| `docker/partition/` | five-server setup and partition scripts for Task 3 |
| `docker/Dockerfile` | Docker image definition for all servers |
| `raftscope/` | interactive Raft visualization for Tasks 1 and 5 |
| `exercises/` | Task 5 exercise files and solutions |
| `images/` | Task 1 screenshots |
| `REPORT.md` | assignment answers |

## Ports

| Port | Server |
|------|--------|
| 8060 | RaftScope |
| 8080 | node1 |
| 8081 | node2 |
| 8082 | node3 |
| 8083 | node4 (partition setup only) |
| 8084 | node5 (partition setup only) |

Each server exposes `GET /admin/status`, `GET /keys/<key>` and `POST /keys/<key>`. You can call these endpoints with `curl` from the terminal. To open a server in a browser, use `http://localhost:<port>/admin/status` locally or the Ports tab in Codespaces. If a port is missing from the Ports tab, click **Forward a Port** and enter the port number.

Inside the Docker network, the servers reach each other by container name (`node1:6000`, `node2:6001`, ...). These names also appear in `/admin/status`.

## AI usage disclaimer

LLMs supported code scaffolding and document layout during preparation of this assignment template. The TAs and coordinating professor designed the learning objectives and all student-facing material. They reviewed and tested generated code before release.
