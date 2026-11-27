# Assignment 5 Report

Answer below each question of [TASKS.md](TASKS.md). When an answer relies on `/admin/status`, quote the fields it relies on and say which server they came from.

## Task 1

Note: Some questions require you to take screenshots. Put them in `images/` and indicate in your answer which image refers to which screenshot.

1. What happens when Raft starts? Explain the process of electing a leader in the first term.

   **Answer:**

2. Once the leader has been elected, send a request to the leader and wait until the operation is committed by all the nodes (*note:* in the interactive visualization, a committed operation is represented with a solid border in replicated logs). Then, perform the following steps:

   - Pause the simulation, perform a new request on the leader, and take a screenshot (`task1_q2_1.PNG`). Stop the leader and then resume the simulation for a new election.
   - Once there is a new leader, perform a new request and then resume the leader from the previous term. Once the new request is committed by all servers, pause the simulation, and then take another screenshot (`task1_q2_2.PNG`).

   How did the logs of the nodes evolve during the above exercise? Explain what happened.

   **Answer:**

3. Using the same visualization, stop the current leader and two additional servers. Only two nodes should now be running in your simulation. Then, perform the following steps:

   - After a few term increments, pause the simulation to take a screenshot (`task1_q3_1.PNG`).
   - Resume all nodes and resume the simulation. After the new leader election, pause the simulation and take a screenshot (`task1_q3_2.PNG`).

   How do you explain the behavior of the system during the above exercise?

   **Answer:**

## Task 2

1. Which server is the leader? Can there be multiple leaders? Justify your answer using the statuses from the different servers.

   **Answer:**

2. Perform a `PUT` operation for the key "a" on the leader. Check the status of the different nodes. What changes have occurred and why (if any)?

   **Answer:**

3. Perform an `APPEND` operation for the key "a" on the leader. Check the status of the different nodes. What changes have occurred and why (if any)?

   **Answer:**

4. Perform a `GET` operation for the key "a" on the leader. Check the status of the different nodes. What changes have occurred and why (if any)?

   **Answer:**

## Task 3

### Server Failures

1. Shut down the server that acts as a leader. Report the status changes you get from the servers that remain active after shutting down the leader. What is the new leader (if any)?

   **Answer:**

2. Perform a `PUT` operation for the key "a" on the new leader. Then, restart the previous leader, and indicate the status changes for the three servers. Indicate the result of a `GET` operation for the key "a" to the previous leader.

   **Answer:**

3. Has the `PUT` operation been replicated? Indicate which steps lead to a new election and which steps do not. Justify your answer using the statuses returned by the servers.

   **Answer:**

4. Shut down two servers: first shut down a server that is not the leader, then shut down the leader. Report the status changes of the remaining server and explain what happened.

   **Answer:**

5. Can you perform `GET`, `PUT`, or `APPEND` operations in this system state? Justify your answer.

   **Answer:**

6. Restart the servers and note the status changes. Describe what happened.

   **Answer:**

### Network Partitions: first experiment

For the first experiment, create a network partition with 2 servers (including the leader) on the first partition and the 3 other servers on the other partition. Indicate the changes that occur in the status of a server on the first partition and a server on the second partition. Reconnect the partitions and indicate what happens. What are the similarities and differences between the implementation of Raft used by your key/value service (based on the PySyncObj library) and the implementation shown in the [Secret Lives of Data](https://thesecretlivesofdata.com/raft/) illustration (chapter "Log Replication", network partition)? How do you justify the differences?

**Answer:**

### Network Partitions: second experiment

For the second experiment, create a network partition with 3 servers (including the leader) on the first partition and the 2 other servers on the other partition. Indicate the changes that occur in the status of a server on the first partition and a server on the second partition. Reconnect the partitions and indicate what happens. How does the implementation of Raft used by your key/value service (based on the PySyncObj library) compare to the implementation shown in the [Secret Lives of Data](https://thesecretlivesofdata.com/raft/) illustration?

**Answer:**

## Task 4

1. Raft uses a leader election algorithm based on randomized timeouts and majority voting, but other leader election algorithms exist. Among them is the bully algorithm, which is described in Section 5.4.1 of the Distributed Systems book by van Steen and Tanenbaum. Imagine you update the PySyncObj library to use the bully algorithm for Raft (as described in the Distributed Systems book) instead of randomized timeouts and majority voting. What would happen in the first network partition from Task 3?

   **Answer:**

2. Why is it that Raft cannot handle Byzantine failure? Explain in your own words.

   **Answer:**

## Task 5

Fill in the table below. The explanations themselves go in the
`exercises/<name>-solution.md` files committed with each solution.

| Exercise | Posed by | Solved by | Answer picked | Correct? | Solution file |
|----------|----------|-----------|---------------|----------|---------------|
|          |          |           |               |          |               |
|          |          |           |               |          |               |

Use one row per exercise, with the exercise name, the GitHub usernames of both partners, the answer the solver picked, whether it was correct, and the path of the solution file and its screenshots.

## Declaration of support

Declare any support that you received from others and, within reasonable bounds, any support tools that you were using while solving the assignment, including non-standard tools such as generative machine learning models (e.g., GPT, Claude). Write "none" if there was none.

**Answer:**
