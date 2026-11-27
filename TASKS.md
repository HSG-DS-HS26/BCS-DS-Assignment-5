# Assignment 5: Raft (10pt)

In this assignment, you will get practical experience with the Raft consensus algorithm by implementing a *fault-tolerant key/value service* (a service that clients can use to retrieve and store values for unique keys). This assignment is structured as follows:

- In the first task, you will explore how the Raft algorithm works using an interactive visualization.
- In the second task, you will implement the fault-tolerant key/value service in Python. The project uses the Python *PySyncObj* package ([docs](https://pysyncobj.readthedocs.io/en/latest/)), which implements the Raft algorithm.
- In the third task, you will simulate different types of failures to assess the fault tolerance of your implementation.
- In the fourth task, a few conceptual questions will help you dive deeper into Raft.
- The fifth task is a team task in which you pose and solve Raft exercises in pairs, and the live task takes place on site during the exercise session on December 11th.

## Before you start

**The assignment repository:**
**<https://github.com/HSG-DS-HS26/BCS-DS-Assignment-5>**

On GitHub, select **Use this template** -> **Create a new repository** to create a private copy of the assignment repository. Do not fork the template or work in it directly.

In your private repository, open **Settings** -> **Collaborators**, add `jangrau13` and grant the account **Read** access. This allows the TA to view your code, commits and results without changing the repository. If you prefer an archive submission or do not want to grant repository access, tell the TA before the deadline and follow the archive and Teams viva process described below.

Open the repository in a Codespace or in the Dev Container as described in [README.md](README.md). Write all answers in [REPORT.md](REPORT.md).

## Task 1: Discovering Raft (1.5 pts)

This repository includes [RaftScope](raftscope/index.html), an interactive visualization of how the Raft algorithm works in a group of five nodes. It extends the visualization on the Raft website (<https://raft.github.io/>), for example with the no-op entry a new leader appends, network partitions, and a field to send a client value to the leader. Start it with `python raftscope/server.py` from the repository root and open port 8060 (details in Task 5). In this task, you will use this interactive visualization to perform several exercises.

**Hint**: Before you start working on the exercises, we also recommend going through the following visual illustration of how Raft works: <https://thesecretlivesofdata.com/raft/>.

1. (0.5 pts) What happens when Raft starts? Explain the process of electing a leader in the first term.

2. (0.5 pts) Once the leader has been elected, send a request to the leader and wait until the operation is committed by all the nodes (*note:* in the interactive visualization, a committed operation is represented with a solid border in replicated logs). Then, perform the following steps:

   - Pause the simulation, perform a new request on the leader, and take a screenshot (`task1_q2_1.PNG`). Stop the leader and then resume the simulation for a new election.
   - Once there is a new leader, perform a new request and then resume the leader from the previous term. Once the new request is committed by all servers, pause the simulation, and then take another screenshot (`task1_q2_2.PNG`).

   How did the logs of the nodes evolve during the above exercise? Explain what happened.

3. (0.5 pts) Using the same visualization, stop the current leader and two additional servers. Only two nodes should now be running in your simulation. Then, perform the following steps:

   - After a few term increments, pause the simulation to take a screenshot (`task1_q3_1.PNG`).
   - Resume all nodes and resume the simulation. After the new leader election, pause the simulation and take a screenshot (`task1_q3_2.PNG`).

   How do you explain the behavior of the system during the above exercise?

Todo:

- [ ] Save the 4 screenshots in `images/` under the names above
- [ ] Answer questions 1 to 3 of Task 1 in [REPORT.md](REPORT.md)

## Task 2: Implementing a Fault-Tolerant Key/Value Service with Raft (1.5 pts)

### Implementation (0.5 pts)

In this task, you will implement a key/value service, i.e., a service that provides key/value pairs, where the key is a string, and the value is a list of strings. The service supports three types of operations:

- `GET(Key)` returns the value associated with the key. The value is a list of strings.
- `PUT(Key, Value)` sets the value (i.e., a list) for the given key.
- `APPEND(Key, Value)` adds the value (a string) to the list of values for the given key. This operation acts like `PUT(Key, [Value])` (i.e., setting the key to a single-item list) if the current value for the key is empty or undefined.

To enable fault tolerance, the service can use Raft to replicate the key/value store across a group of servers. We provide you with a Python project template based on [PySyncObj](https://pysyncobj.readthedocs.io/en/latest/), an open-source implementation of Raft. To solve this task, you will then have to update the following files (see also project [README](README.md)):

1. [`kvstorage.py`](kv/kvstorage.py), which implements an instance of the key/value service itself, and
2. [`kvstorage_http.py`](kv/kvstorage_http.py), which implements an HTTP server that is used to perform queries on the key/value service.

The HTTP API of the servers is described in [api_description.yml](api_description.yml).

Todo:

- [ ] In [kv/kvstorage.py](kv/kvstorage.py), fill in the TODO blocks of `put`, `append` and `get`
- [ ] In [kv/kvstorage_http.py](kv/kvstorage_http.py), fill in the TODO blocks of `is_str` and `is_list_of_string`
- [ ] Start the 3 servers and check that PUT, APPEND and GET work on every node (commands below)

### Performing operations (1 pt)

Start the 3 servers from the `docker/` folder:

```bash
cd docker
docker compose up --build -d
```

> **Ports:** Node 1: `http://localhost:8080`, Node 2: `http://localhost:8081`, Node 3: `http://localhost:8082`  
> *(If you edit code in `kv/`, restart with `docker compose up --build -d`; view logs with `docker compose logs -f`)*  
> If `docker compose logs` shows the same traceback over and over, an exception in your `put` or `append` keeps repeating: fix the code, then run `docker compose down` and `docker compose up --build -d`.  
> **Note on formatting:** `/keys/<key>` and `/admin/status` return JSON; the commands below pipe it into `jq` to pretty-print it. The status keys and more `jq` filters are in [Appendix: Working with Server Status and JSON](#appendix-working-with-server-status-and-json) at the bottom.

1. **Which server is the leader? Can there be multiple leaders?** Justify your answer using the statuses from the different servers.

   Query each node's status:
   ```bash
   curl -s http://localhost:8080/admin/status | jq
   curl -s http://localhost:8081/admin/status | jq
   curl -s http://localhost:8082/admin/status | jq
   ```

2. **Perform a `PUT` operation for the key "a" on the leader.** Check the status of the different nodes. What changes have occurred and why (if any)?

   (Replace 8080 with the port of the current leader: node1=8080, node2=8081, node3=8082.)
   ```bash
   curl -X POST http://localhost:8080/keys/a -H "Content-Type: application/json" -d '{"type": "PUT", "value": ["cat", "dog"]}'
   ```
   Check statuses again:
   ```bash
   curl -s http://localhost:8080/admin/status | jq
   curl -s http://localhost:8081/admin/status | jq
   curl -s http://localhost:8082/admin/status | jq
   ```

3. **Perform an `APPEND` operation for the key "a" on the leader.** Check the status of the different nodes. What changes have occurred and why (if any)?

   (Replace 8080 with the port of the current leader: node1=8080, node2=8081, node3=8082.)
   ```bash
   curl -X POST http://localhost:8080/keys/a -H "Content-Type: application/json" -d '{"type": "APPEND", "value": "mouse"}'
   ```
   Check statuses again:
   ```bash
   curl -s http://localhost:8080/admin/status | jq
   curl -s http://localhost:8081/admin/status | jq
   curl -s http://localhost:8082/admin/status | jq
   ```

4. **Perform a `GET` operation for the key "a" on the leader.** Check the status of the different nodes. What changes have occurred and why (if any)?

   ```bash
   curl -s http://localhost:8080/keys/a | jq
   ```
   Check statuses again:
   ```bash
   curl -s http://localhost:8080/admin/status | jq
   curl -s http://localhost:8081/admin/status | jq
   curl -s http://localhost:8082/admin/status | jq
   ```

Stop the servers with `docker compose down` (in `docker/`) before you continue.

Todo:

- [ ] Answer questions 1 to 4 of Task 2 in [REPORT.md](REPORT.md)

## Task 3: Evaluating Fault-Tolerance (2 pts)

In this task, you will simulate server failures and network partitions to test the behavior of your implementation from **Task 2**.

### Server Failures (1 pt)

You will begin by simulating several server failures and their recoveries in your group of three servers (all commands run from the `docker/` folder).

1. **Shut down the server that acts as a leader.** Report the status changes you get from the servers that remain active after shutting down the leader. What is the new leader (if any)?

   *(Replace `node1` with your current leader container: `node1`, `node2`, or `node3`)*:
   ```bash
   docker compose stop node1
   ```
   Query the remaining active servers (adjust ports if your stopped node was not node1):
   ```bash
   curl -s http://localhost:8081/admin/status | jq
   curl -s http://localhost:8082/admin/status | jq
   ```

2. **Perform a `PUT` operation for the key "a" on the new leader.** Then, restart the previous leader, and indicate the status changes for the three servers. Indicate the result of a `GET` operation for the key "a" to the previous leader.

   Execute `PUT` on the new leader (replace port `8081` with your new leader's port):
   ```bash
   curl -X POST http://localhost:8081/keys/a -H "Content-Type: application/json" -d '{"type": "PUT", "value": ["elephant"]}'
   ```
   Restart the previous leader (replace `node1` with the server stopped in question 1):
   ```bash
   docker compose start node1
   ```
   Check statuses on all three servers:
   ```bash
   curl -s http://localhost:8080/admin/status | jq
   curl -s http://localhost:8081/admin/status | jq
   curl -s http://localhost:8082/admin/status | jq
   ```
   Execute `GET` on the restarted previous leader (replace 8080 with the port of the server you restarted):
   ```bash
   curl -s http://localhost:8080/keys/a | jq
   ```

3. **Has the `PUT` operation been replicated?** Indicate which steps lead to a new election and which steps do not. Justify your answer using the statuses returned by the servers.

4. **Shut down two servers:** first shut down a server that is not the leader, then shut down the leader. Report the status changes of the remaining server and explain what happened.

   *(Note: The leader changed in question 1 and node1 rejoined as a follower in question 2. First check statuses to find the current leader, for example with `curl -s http://localhost:808{0,1,2}/admin/status | jq -c '{self, state, leader}'`. Then stop a non-leader first and the leader second by their container names, and query the remaining server)*:
   ```bash
   docker compose stop <a-follower>
   docker compose stop <the-leader>
   ```
   Check the status of the remaining active server (e.g. node3):
   ```bash
   curl -s http://localhost:8082/admin/status | jq
   ```

5. **Can you perform `GET`, `PUT`, or `APPEND` operations in this system state?** Justify your answer.

   Test on the remaining server (adjust port to your remaining server):
   ```bash
   curl -s http://localhost:8082/keys/a | jq
   curl -X POST http://localhost:8082/keys/a -H "Content-Type: application/json" -d '{"type": "PUT", "value": ["zebra"]}'
   ```

6. **Restart the servers and note the status changes.** Describe what happened.

   Restart the two stopped servers (the ones you stopped in question 4, e.g. node1 and node2):
   ```bash
   docker compose start node1 node2
   ```
   Check statuses on all three servers:
   ```bash
   curl -s http://localhost:8080/admin/status | jq
   curl -s http://localhost:8081/admin/status | jq
   curl -s http://localhost:8082/admin/status | jq
   ```

Stop the servers with `docker compose down` (in `docker/`) before you continue.

Todo:

- [ ] Answer questions 1 to 6 of Task 3 in [REPORT.md](REPORT.md)
- [ ] Stop the 3 servers before moving to network partitions:
  ```bash
  docker compose down
  ```

### Network Partitions (1 pt)

To simulate network partitions, you will now instantiate 5 servers using Docker (ports: node1=8080, node2=8081, node3=8082, node4=8083, node5=8084). The containers are all part of the same Docker Network. We provide `partition.sh` and `reconnect.sh` in `docker/partition/`.

From the `docker/` folder, change into the `partition/` folder and start the 5 servers:

```bash
cd partition
docker compose up --build -d
```

*(If you are working from the repository root instead, use `cd docker/partition`.)*

#### Experiment 1 (0.5 pts)

Create a network partition with 2 servers (including the leader) on the first partition and the 3 other servers on the other partition. Indicate the changes that occur in the status of a server on the first partition and a server on the second partition. Reconnect the partitions and indicate what happens. What are the similarities and differences between the implementation of Raft used by your key/value service (based on the PySyncObj library) and the implementation shown in the [Secret Lives of Data](https://thesecretlivesofdata.com/raft/) illustration (chapter "Log Replication", network partition)? How do you justify the differences?

1. Find the current leader:
   ```bash
   for port in 8080 8081 8082 8083 8084; do echo -n "Port $port: "; curl -s http://localhost:$port/admin/status | jq -c '{state, leader, raft_term}'; done
   ```
2. Partition the network (place the leader and one follower in partition 1, and the other 3 nodes in partition 2; for example, if `node1` is the leader):
   ```bash
   ./partition.sh "node1 node2" "node3 node4 node5"
   ```
3. Check statuses across both partitions (adjust ports to match your partitions). Wait about 40 seconds first: PySyncObj steps a leader down only after 30 seconds without a majority, and the minority needs time to start elections.
   ```bash
   curl -s http://localhost:8080/admin/status | jq   # partition 1 (minority with former leader)
   curl -s http://localhost:8082/admin/status | jq   # partition 2 (majority)
   ```
4. Reconnect and inspect what happens:
   ```bash
   ./reconnect.sh
   ```
   Wait about 10 seconds before checking the statuses, then check all 5 servers with the loop from step 1.
   ```bash
   for port in 8080 8081 8082 8083 8084; do echo -n "Port $port: "; curl -s http://localhost:$port/admin/status | jq -c '{state, leader, raft_term}'; done
   ```

#### Experiment 2 (0.5 pts)

Create a network partition with 3 servers (including the leader) on the first partition and the 2 other servers on the other partition. Indicate the changes that occur in the status of a server on the first partition and a server on the second partition. Reconnect the partitions and indicate what happens. How does the implementation of Raft used by your key/value service (based on the PySyncObj library) compare to the implementation shown in the [Secret Lives of Data](https://thesecretlivesofdata.com/raft/) illustration?

1. Find the current leader (after Experiment 1's reconnect, the leader usually comes from the former majority side, e.g. node3 to node5):
   ```bash
   for port in 8080 8081 8082 8083 8084; do echo -n "Port $port: "; curl -s http://localhost:$port/admin/status | jq -c '{state, leader, raft_term}'; done
   ```
2. Partition the network with the leader and two other nodes as the first group, and the remaining two nodes as the second group (for example, if `node4` is the leader):
   ```bash
   ./partition.sh "node3 node4 node5" "node1 node2"
   ```
3. Check statuses on both partitions (query a port from each group, for example 8083 from the first group and 8080 from the second). Wait about 40 seconds first: PySyncObj steps a leader down only after 30 seconds without a majority, and the minority needs time to start elections.
   ```bash
   curl -s http://localhost:8083/admin/status | jq   # partition 1 (majority with leader)
   curl -s http://localhost:8080/admin/status | jq   # partition 2 (minority)
   ```
4. Reconnect all nodes and observe status:
   ```bash
   ./reconnect.sh
   ```
   Wait about 10 seconds before checking the statuses, then check all 5 servers with the loop from step 1.
   ```bash
   for port in 8080 8081 8082 8083 8084; do echo -n "Port $port: "; curl -s http://localhost:$port/admin/status | jq -c '{state, leader, raft_term}'; done
   ```
5. Clean up when finished:
   ```bash
   docker compose down
   ```

Stop the servers with `docker compose down` (in `docker/partition/`) before you continue.

Todo:

- [ ] Run both experiments
- [ ] Answer the questions of both experiments in [REPORT.md](REPORT.md)
- [ ] All servers stopped (`docker compose down` in `docker/` and `docker/partition/`)

## Task 4: Questions on Raft (1 pt)

1. (0.5 pts) Raft uses a leader election algorithm based on randomized timeouts and majority voting, but other leader election algorithms exist. Among them is the bully algorithm, which is described in Section 5.4.1 of the [Distributed Systems book](https://www.distributed-systems.net/index.php/books/ds4/) by van Steen and Tanenbaum. Imagine you update the PySyncObj library to use the bully algorithm for Raft (as described in the Distributed Systems book) instead of randomized timeouts and majority voting. What would happen in the first network partition from Task 3?
2. (0.5 pts) Why is it that Raft cannot handle Byzantine failure? Explain in your own words.

Todo:

- [ ] Answer questions 1 and 2 of Task 4 in [REPORT.md](REPORT.md)

## Task 5: Raft Exercises in Pairs (1 pt)

> [!NOTE]
> **Collaboration & Git Exercise:** Work on this task in pairs within the same shared repository. This task doubles as a collaborative Git workflow exercise: you will alternate posing challenges and solving each other's exercises through a series of distinct commits.
>
> Your Git commit history is an explicit part of grading. Every commit must be authored and pushed by the partner who carried out that step (exchanging challenge JSONs and solution markdown/screenshots).
>
> *Working individually?* Complete both roles yourself (pose one scenario, solve it) and commit all corresponding files.

This task uses [RaftScope](raftscope/index.html), an interactive Raft visualization, served as a webpage by a small Python server that also stores the exercises. From the repository root:

```bash
python raftscope/server.py
```

In a GitHub Codespace or the Dev Container, VS Code forwards the port automatically and either opens a browser tab directly or shows a notification to open it. You can also open the **Ports** tab in VS Code and click the globe icon next to port 8060 (RaftScope). If you are running locally outside a container, open <http://localhost:8060> in your browser. (Opening `raftscope/index.html` directly also works, but **Import challenge** and **Export challenge** need the server; without it, RaftScope falls back to downloading and uploading JSON files.)

With its **Create exercise** feature you can pause the simulation mid-scenario, pose a multiple-choice question about the frozen state, and record the continuation of the run that reveals the answer. The question form is built into the page below the exercise buttons, so the simulation stays in view while you write. With **Export challenge** the exercise lands as `exercises/<name>.json` in your repository, ready to commit. Your partner imports it with **Import challenge**: the recorded story re-runs from the beginning, exactly as you built it, and stops at the moment you posed the question. They answer, and a button press continues the recorded run to check the answer.

### How to pose an exercise (0.5 pts)

1. Set up a Raft scenario (leader election, log replication, a network partition, stopped servers, dropped messages, ...). The **Create exercise** button freezes the current state of the simulation as the stage your partner will see.
2. Press **Create exercise** to freeze the current state as the stage. The panel below the exercise buttons stays in place: give the exercise a name, type a question and four answers, and select which answer is correct.
3. Press **Set question and continue the run**, then run the simulation until the answer becomes visible, and press **Export challenge**. The server saves the exercise as `exercises/<name>.json`: a JSON file containing the question, the answers, the frozen stage, and your recorded solution run.

Three rules for a well-posed exercise:

- The question must be answerable from the frozen stage using the Raft rules (logs, terms, quorum, timers), not by guessing.
- At least several of the four answers must be plausible; the correct answer must follow deterministically from the Raft algorithm.
- The scenario should exercise a non-trivial situation, for example an election across terms, a network partition with and without a majority, diverging logs, or a leader change with uncommitted entries. Scenarios that only show a healthy leader getting elected are too simple.

### How to solve an exercise (0.5 pts)

1. Pull so that the server sees the exercise your partner committed, press **Import challenge**, and pick it. The simulation re-runs the recorded story from the beginning (exactly as your partner built it, down to every drawn election timeout) and stops at the moment the question was posed. The question then appears in the panel below the exercise buttons, with the frozen stage in view.
2. Pick the answer you believe is correct. The panel immediately tells you whether you were right and highlights the correct answer. (Do not read the JSON's `correct` field, as the viva may ask you to justify your answer without it.)
3. Press **Show solution** to continue the recorded run from the stage, and take two screenshots: the frozen stage (`images/task5_stage_<name>.PNG`) and the moment the situation resolves (`images/task5_reveal_<name>.PNG`).
4. Write your solution in `exercises/<name>-solution.md`: which answer you picked, whether it was correct, and an explanation of what happens in the recorded run and why, referencing the Raft concepts this assignment covers.

### The Git team workflow

You and your partner exchange exercises by collaborating on Git: one partner poses an exercise and commits its JSON challenge file, while the other pulls the repository, solves it in RaftScope, and commits their solution. You then swap roles.

Treat this as a collaborative Git exercise: each numbered step below **must be committed and pushed separately by the designated partner** so that the repository history reflects the back-and-forth exchange:

1. **Commit 1 (Partner A):** Poses Exercise A in RaftScope, exports it, and commits and pushes `exercises/<name-A>.json`.
2. **Commit 2 (Partner B):** Runs `git pull`, imports and solves Exercise A, then commits and pushes the solution (`exercises/<name-A>-solution.md` + 2 screenshots) **along with their own challenge** (`exercises/<name-B>.json`).
3. **Commit 3 (Partner A):** Runs `git pull`, imports and solves Exercise B, then commits and pushes the solution (`exercises/<name-B>-solution.md` + 2 screenshots).

*If you are working alone:* Play both roles yourself, posing and solving one exercise, and commit the challenge JSON, the screenshots, and the solution markdown in a single commit.

Todo:

- [ ] Exercise 1 (`<name-A>.json`, `<name-A>-solution.md`, screenshots) committed in the workflow above
- [ ] Exercise 2 (`<name-B>.json`, `<name-B>-solution.md`, screenshots) committed in the workflow above
- [ ] Fill in the Task 5 table in [REPORT.md](REPORT.md)

## Hand in: commit and push

When Tasks 1 to 5 are done, **commit and push** to your repository. The viva reads that repository on GitHub, so work that exists only in a Codespace or on your laptop is invisible to it.

As in the other assignments, if you do not want to work with GitHub, please inform the TA and schedule a private Teams call where you will get a viva in person. The same process applies if you do not want the automated viva to read your GitHub repository.

Across all tasks, in this and the other assignments in this course, you are **required to declare** any support that you received from others and, within reasonable bounds, any support tools that you were using while solving the assignment. It is not required that you declare that you were using a text-editing software with orthographic correction; it is however required to declare if you were using any non-standard tools such as generative machine learning models (e.g., GPT, Claude). [REPORT.md](REPORT.md) has a section for it.

Todo:

- [ ] Tasks 1 to 4 are done, the screenshots are in `images/`, and every question in [REPORT.md](REPORT.md) is answered
- [ ] Task 5: both exercises are posed and solved, each step committed by the partner who did it, and the Task 5 table in [REPORT.md](REPORT.md) is filled in
- [ ] **Commit and push**, or send the agreed `.zip` archive
- [ ] Tell the TA before the deadline if you want to do the viva in a Teams call instead of with the viva site

## Solidify your knowledge (1pt)

Open [the viva site](https://wiser-sp4.interactions.ics.unisg.ch) and sign in with GitHub. Select your repository and the commit you pushed. Answer the viva's questions about your code and the contents of `REPORT.md`.

When the viva ends, **it commits its record to your repository and pushes the commit**. The commit is on GitHub but not yet in your Codespace or on your laptop. **Pull** before making more changes, or your next push will be rejected.

Todo:

- [ ] Open [the viva site](https://wiser-sp4.interactions.ics.unisg.ch), select your repository and commit, and answer its questions
- [ ] **Pull** and check that `.viva/` is in your repository. In VS Code, choose **Source Control** -> **Sync Changes**, or run `git pull` in a terminal
- [ ] Attend the agreed Teams viva if you use an archive submission or withhold GitHub access from the automated viva

## Live Task: on site during exercise session Dec 11th (2 pts)

The live task takes place on site during the exercise session on December 11th.

## Submit on Canvas

The final submission is a PDF on Canvas that identifies your repository and the commit to grade. A repository tool creates the PDF and refuses to run while GitHub is missing any of your work.

1. **Commit and push** everything. If you have not pulled since the viva, pull first.
2. **Write the PDF.** In VS Code, press **Hand in** in the status bar at the bottom, or run **Terminal** -> **Run Task** -> **Hand in: write the PDF for Canvas**. From a terminal:

   ```bash
   ./submit.sh
   ```

   On a Windows host without the Dev Container, run `.\submit.ps1`. If Windows refuses to run scripts, use `python submission\submission.py`.

   The tool writes `<your-username>-<repo>-submission.pdf` in the repository root and lists what it found. If it says **No PDF written**, it explains the cause and the required action, usually a commit, push or pull.
3. **Upload that PDF** to the assignment on Canvas.

If you change anything after that, **commit and push again, then write and upload a new PDF**. The PDF names a single commit, and that commit is graded.

Todo:

- [ ] Everything committed and pushed, and pulled since the viva
- [ ] **Hand in** pressed, and the PDF lists your repository and the commit you expect
- [ ] PDF uploaded to Canvas

## Appendix: Working with Server Status and JSON

Both endpoints return JSON (`application/json`): `/keys/<key>` the value of a key, and `/admin/status` the PySyncObj status of the server (`getStatus()`). Pipe them into **`jq`** to pretty-print them:

```bash
curl -s http://localhost:8080/keys/a | jq
curl -s http://localhost:8080/admin/status | jq
```

### Important keys in the status

- **`self`**: the address of this server, e.g. `node1:6000`.
- **`state`**: `0` follower, `1` candidate, `2` leader.
- **`leader`**: the address of the leader this server knows, or `null` while it knows none.
- **`raft_term`**: the current Raft term.
- **`log_len`**, **`commit_idx`**, **`last_applied`**: the length of the log, the highest committed index, and how far this server has applied the log to its key/value store.
- **`has_quorum`**: whether this server is connected to a majority.
- **`partner_node_status_server_<node>`**: `2` if the connection to that partner is up, `0` if not.

### Useful jq filters

```bash
# Only the state (0 follower, 1 candidate, 2 leader):
curl -s http://localhost:8080/admin/status | jq .state

# The fields the questions ask about:
curl -s http://localhost:8080/admin/status | jq '{self, state, leader, raft_term, log_len, commit_idx, last_applied, has_quorum}'

# Which partners are connected:
curl -s http://localhost:8080/admin/status | jq 'with_entries(select(.key | startswith("partner_node_status")))'
```

### Environment & OS Command Reference

| Action | macOS / Linux / Dev Container | Windows (PowerShell) |
| :--- | :--- | :--- |
| **Install `jq`** | Pre-installed in Dev Container<br>`brew install jq` / `apt install jq` | `winget install jqlang.jq`<br>*(or `choco install jq` / `scoop install jq`)* |
| **Pretty-print the status** | `curl -s http://localhost:8080/admin/status \| jq` | `curl.exe -s http://localhost:8080/admin/status \| jq`<br>*or native:* `curl.exe -s http://localhost:8080/admin/status \| ConvertFrom-Json` |
| **Extract a key** | `curl -s http://localhost:8080/admin/status \| jq .leader` | `curl.exe -s http://localhost:8080/admin/status \| jq .leader`<br>*or native:* `(curl.exe -s http://localhost:8080/admin/status \| ConvertFrom-Json).leader` |
| **Without jq** | `curl -s http://localhost:8080/admin/status \| python3 -m json.tool` | `curl.exe -s http://localhost:8080/admin/status \| python -m json.tool` |

> **PowerShell tip:** In Windows PowerShell, `curl` by default aliases to `Invoke-WebRequest`. Always use `curl.exe` to invoke the real cURL binary.
