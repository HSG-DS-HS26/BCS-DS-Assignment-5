# A Raft server: kv/kvstorage_http.py with PySyncObj and Flask. Every node of both
# compose files runs this image; compose passes each its ports and partners.
FROM python:3.12-slim
# iptables: partition.sh drops the traffic between the two groups inside each container.
RUN apt-get update && apt-get install -y --no-install-recommends iptables && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock .python-version /app/
RUN uv sync --frozen --no-dev --no-install-project
COPY kv /app/kv
# -u: print() from kvstorage.py shows up in `docker compose logs` straight away.
ENTRYPOINT ["uv", "run", "--no-sync", "python", "-u", "/app/kv/kvstorage_http.py"]
