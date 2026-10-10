"""Cloudflare Worker database client shared by the dashboard and detector.

Requires MICROSLEEP_API_URL and MICROSLEEP_API_TOKEN in the environment.
The Worker must implement /events and /users and return JSON arrays for GET.
"""
import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class Record:
    def __init__(self, data):
        self._data = data
        self.id = str(data.get("id", ""))

    def to_dict(self):
        return dict(self._data)


def _request(path, payload=None):
    url = os.environ.get("MICROSLEEP_API_URL", "").rstrip("/")
    token = os.environ.get("MICROSLEEP_API_TOKEN", "")
    if not url or not token:
        raise RuntimeError("Set MICROSLEEP_API_URL and MICROSLEEP_API_TOKEN to connect to the Cloudflare Worker.")
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(url + path, data=body, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "Microsleep/1.0",
    })
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def filter_data(data):
    timestamp, seconds, count = data
    hour = timestamp.hour
    period = ("Midnight" if hour < 6 else "Morning" if hour < 12 else
              "Afternoon" if hour < 15 else "Evening" if hour < 20 else "Night")
    return {"Date": timestamp.strftime("%d/%m/%Y"),
            "Time": timestamp.strftime("%I:%M:%S %p"),
            "Eyes Closed/S": round(seconds, 3),
            "Total Number Eyes Closed": count, "Day": period}


def insert(name, data):
    _request("/events", {"username": name, "recorded_at": data[0].isoformat(),
                         "eyes_closed_seconds": round(data[1], 3),
                         "eyes_closed_count": data[2],
                         "day_period": filter_data(data)["Day"]})


def fetch(collection, name=None, subcollection=None):
    if collection != "Microsleep" or subcollection not in (None, "Information"):
        raise ValueError("Unsupported event collection")
    query = "" if name is None else "?" + urlencode({"username": name})
    return [Record(row) for row in _request("/events" + query)]


def insert_face(user_data):
    _request("/users", {"name": user_data["Name"],
                        "face_encoding": user_data["FaceEncode"]})
    return 1


def fetch_face(collection):
    if collection != "User":
        raise ValueError("Unsupported user collection")
    return [Record(row) for row in _request("/users")]


def check_name(name):
    return bool(fetch("Microsleep", name, "Information"))
