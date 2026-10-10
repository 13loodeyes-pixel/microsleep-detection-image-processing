"""Browser-camera monitoring using the installed dlib face landmarks."""
import base64
import io
import math
import threading
import time
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import eel
import Database

_sessions = {}
_lock = threading.Lock()
THRESHOLD = 0.22
MIN_SECONDS = 1.0
MAX_GAP = 2.0


def eye_ratio(points):
    """Six-point eye aspect ratio; lower values indicate a closed eye."""
    distance = lambda a, b: math.dist(a, b)
    width = distance(points[0], points[3])
    return (distance(points[1], points[5]) + distance(points[2], points[4])) / (2 * width) if width else 1.0


def _finish_closure(session):
    start = session.pop('closed_at', None)
    if start is None:
        return
    duration = session['last_sample'] - start
    if duration >= MIN_SECONDS:
        session['pending'].append((session.pop('recorded_at'), duration, 1))
    else:
        session.pop('recorded_at', None)


def _save_pending(session):
    while session['pending']:
        Database.insert(session['name'], session['pending'][0])
        session['pending'].pop(0)
        session['saved'] += 1


@eel.expose
def monitoring_drivers():
    try:
        return {'ok': True, 'names': sorted({row.to_dict()['Name'] for row in Database.fetch_face('User')})}
    except Exception:
        return {'ok': False, 'message': 'Could not load drivers. Check your Cloudflare connection.'}


@eel.expose
def monitoring_start(name):
    try:
        import face_recognition
        drivers = [row.to_dict() for row in Database.fetch_face('User')]
        driver = next((row for row in drivers if row['Name'] == name), None)
        if driver is None:
            return {'ok': False, 'message': 'Select a registered driver.'}
        token = uuid.uuid4().hex
        with _lock:
            # Drop abandoned sessions after one hour.
            for key in list(_sessions):
                if time.monotonic() - _sessions[key]['last_sample'] > 3600:
                    del _sessions[key]
            _sessions[token] = {'name': name, 'encoding': driver['FaceEncode'],
                                'last_sample': time.monotonic(), 'saved': 0, 'pending': []}
        return {'ok': True, 'session': token}
    except ImportError:
        return {'ok': False, 'message': 'Face recognition dependencies are missing. Check the dashboard terminal.'}
    except Exception:
        return {'ok': False, 'message': 'Could not start monitoring. Check the database connection.'}


@eel.expose
def monitoring_frame(token, photo):
    import face_recognition
    import numpy as np
    from PIL import Image
    with _lock:
        session = _sessions.get(token)
        if session is None:
            return {'ok': False, 'message': 'Session expired. Start a new session.'}
        try:
            if not isinstance(photo, str) or not photo.startswith('data:image/jpeg;base64,') or len(photo) > 1_500_000:
                raise ValueError('Invalid photo')
            raw = base64.b64decode(photo.split(',', 1)[1], validate=True)
            with Image.open(io.BytesIO(raw)) as image:
                if image.width > 960 or image.height > 720:
                    raise ValueError('Frame too large')
                pixels = np.array(image.convert('RGB'))
            locations = face_recognition.face_locations(pixels, model='hog')
            now = time.monotonic()
            if now - session['last_sample'] > MAX_GAP:
                session.pop('closed_at', None)
                session.pop('recorded_at', None)
            if len(locations) != 1:
                session.pop('closed_at', None)
                session.pop('recorded_at', None)
                session['last_sample'] = now
                return {'ok': True, 'state': 'paused', 'message': 'Keep exactly one face visible. Detection is paused.', 'saved': session['saved']}
            encoding = face_recognition.face_encodings(pixels, locations)
            if not encoding or not face_recognition.compare_faces([np.array(session['encoding'])], encoding[0], tolerance=0.6)[0]:
                session.pop('closed_at', None)
                session.pop('recorded_at', None)
                session['last_sample'] = now
                return {'ok': True, 'state': 'paused', 'message': 'Face does not match the selected driver. Detection is paused.', 'saved': session['saved']}
            landmarks = face_recognition.face_landmarks(pixels, locations)[0]
            ratio = (eye_ratio(landmarks['left_eye']) + eye_ratio(landmarks['right_eye'])) / 2
            session['last_sample'] = now
            closed = ratio < THRESHOLD
            if closed and 'closed_at' not in session:
                session['closed_at'] = now
                session['recorded_at'] = datetime.now(ZoneInfo('Asia/Kuala_Lumpur'))
            elif not closed:
                _finish_closure(session)
            duration = now - session['closed_at'] if 'closed_at' in session else 0
            result = {'ok': True, 'state': 'closed' if closed else 'open', 'ratio': round(ratio, 3),
                      'duration': round(duration, 1), 'saved': session['saved'],
                      'message': 'Eyes closed' if closed else 'Eyes open'}
            try:
                _save_pending(session)
                result['saved'] = session['saved']
            except Exception:
                result['message'] = 'Cloud save failed. Stop and retry saving before leaving this page.'
                result['state'] = 'error'
            return result
        except Exception:
            session.pop('closed_at', None)
            session.pop('recorded_at', None)
            return {'ok': False, 'message': 'Could not process this frame. Check lighting and try again.'}


@eel.expose
def monitoring_stop(token):
    with _lock:
        session = _sessions.get(token)
        if session is None:
            return {'ok': True, 'saved': 0}
        _finish_closure(session)
        try:
            _save_pending(session)
        except Exception:
            return {'ok': False, 'saved': session['saved'], 'message': 'Cloud save failed. Keep this page open and click Retry saving.'}
        saved = session['saved']
        del _sessions[token]
        return {'ok': True, 'saved': saved}
