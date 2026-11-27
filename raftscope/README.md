# RaftScope

RaftScope is the interactive Raft visualization you use in Tasks 1 and 5 of [TASKS.md](../TASKS.md). It runs as a webpage, served by a small Python server that also stores your exercises. From the repository root:

```bash
python raftscope/server.py
```

In a GitHub Codespace or the Dev Container, the port is forwarded automatically: open it from the pop-up notification or click the globe icon next to port 8060 in the **Ports** tab. If running locally outside a container, open <http://localhost:8060> in a browser. (Opening `raftscope/index.html` directly also works, but **Import challenge** and **Export challenge** need the server; without it, RaftScope falls back to downloading and uploading JSON files.)

## Origin

This folder is a copy of [JeremyLemee/raftscope](https://github.com/JeremyLemee/raftscope) at commit `341cd7f`, not a submodule, so it is part of your repository as soon as you create it from the template. That repository is a fork of [ongardie/raftscope](https://github.com/ongardie/raftscope), the original RaftScope by Diego Ongaro (copyright 2014 Stanford University, see [LICENSE](LICENSE)).

The original provides the Raft simulation and its visualization. The fork adds network partitions, implemented with [Codex](https://openai.com/codex/). For this course, we added the keyboard legend, the creation and solving of exercises, the exercise server `server.py`, the layout of the page and the **Client value** field. The simulation also gained 2 rules: every new leader appends a no-op entry (Raft paper, section 8), and a leader that no longer hears from a majority steps down (Ongaro's dissertation, section 6.2).

## Bundled libraries

RaftScope loads its libraries from this folder, so it works without an internet connection: Bootstrap 3.1.1 (MIT), jQuery 2.0.3 (MIT), [bootstrap-slider](https://github.com/seiyria/bootstrap-slider) 3.1.0 (Apache 2.0) and [bootstrap-contextmenu](https://github.com/sydcanem/bootstrap-contextmenu) 0.2.0 (MIT). Of bootstrap-slider and bootstrap-contextmenu, only the files the page loads are kept.
