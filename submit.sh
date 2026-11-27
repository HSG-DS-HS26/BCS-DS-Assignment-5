#!/usr/bin/env bash
# Writes the PDF you upload to Canvas, after checking that GitHub has your work.
# Commit and push first. The work itself is in submission/submission.py, which
# the Hand in button and submit.ps1 run too.
set -e
cd "$(dirname "$0")"
exec python3 submission/submission.py "$@"
