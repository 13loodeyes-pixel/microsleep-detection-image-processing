#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export MICROSLEEP_API_URL="${MICROSLEEP_API_URL:-https://microsleep-api.skullcool46.workers.dev}"
if [[ -z "${MICROSLEEP_API_TOKEN:-}" ]]; then
    read -rsp "Paste your API token, then press Enter: " MICROSLEEP_API_TOKEN
    echo
    export MICROSLEEP_API_TOKEN
fi

"$project_dir/.venv/bin/python" - <<'PY'
import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

request = Request(
    os.environ['MICROSLEEP_API_URL'].rstrip('/') + '/events',
    headers={
        'Authorization': 'Bearer ' + os.environ['MICROSLEEP_API_TOKEN'],
        'User-Agent': 'Microsleep/1.0',
    },
)
try:
    with urlopen(request, timeout=15) as response:
        records = json.load(response)
    if not isinstance(records, list):
        raise ValueError('Expected an event list from the API')
except HTTPError as error:
    print(f'Connection failed (HTTP {error.code}). Check your token and Worker configuration.')
    sys.exit(1)
except (URLError, ValueError, TimeoutError):
    print('Connection failed. Check your network and Worker URL.')
    sys.exit(1)
print(f'Cloudflare connected. Found {len(records)} events. Opening dashboard...')
PY

cd "$project_dir/microsleep  image processing/DASHBOARD"
exec "$project_dir/.venv/bin/python" MainPage.py
