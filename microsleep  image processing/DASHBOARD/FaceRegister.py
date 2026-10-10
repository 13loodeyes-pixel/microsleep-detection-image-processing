"""Register a face captured by the browser; no WSL webcam is required."""
import base64
import binascii
import io
from urllib.error import HTTPError, URLError

import eel
import Database


@eel.expose
def register_browser_face(username, photo):
    if not isinstance(username, str) or not username.strip() or len(username) > 200:
        return {"ok": False, "message": "Enter a driver name (up to 200 characters)."}
    if not isinstance(photo, str) or not photo.startswith('data:image/jpeg;base64,') or len(photo) > 3_000_000:
        return {"ok": False, "message": "Capture a valid photo before registering."}
    try:
        import numpy as np
        import face_recognition
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        return {"ok": False, "message": "Face recognition dependencies are missing in the dashboard environment."}
    try:
        raw = base64.b64decode(photo.split(',', 1)[1], validate=True)
        with Image.open(io.BytesIO(raw)) as image:
            if image.width > 1920 or image.height > 1920:
                return {"ok": False, "message": "Photo is too large. Capture a new photo."}
            pixels = np.array(image.convert('RGB'))
    except (ValueError, binascii.Error, OSError, Image.DecompressionBombError):
        return {"ok": False, "message": "Could not read the photo. Capture it again."}
    locations = face_recognition.face_locations(pixels, model='hog')
    if len(locations) != 1:
        return {"ok": False, "message": "Exactly one face must be visible. Adjust your position and capture again."}
    encodings = face_recognition.face_encodings(pixels, locations)
    if not encodings:
        return {"ok": False, "message": "Could not encode your face. Try a clearer photo."}
    try:
        Database.insert_face({"Name": username.strip(), "FaceEncode": encodings[0].tolist()})
    except HTTPError as error:
        text = "This driver name already exists. Choose another name." if error.code == 409 else "Could not save the profile. Check your Cloudflare connection."
        return {"ok": False, "message": text}
    except (URLError, RuntimeError, TimeoutError):
        return {"ok": False, "message": "Could not connect to the database. Check the dashboard connection."}
    return {"ok": True, "message": "Driver registered successfully. You can return to the overview."}
