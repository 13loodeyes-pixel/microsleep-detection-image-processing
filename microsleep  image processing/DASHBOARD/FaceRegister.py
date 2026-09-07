import eel
import cv2
import base64
import time
import threading as th
import mediapipe as mp
import face_recognition as fr
import Firebase as fb

mpFaceDetection = mp.solutions.face_detection

face_detect = mpFaceDetection.FaceDetection()

bounding_color = (0, 255, 0)
x = None
y = None
width = None
height = None
def bounding_box(img,imgBGR):

    result_faceDectection = face_detect.process(imgBGR)

    if result_faceDectection.detections:

        for detection in result_faceDectection.detections:
            # draw.draw_detection(img,detection)

            # print(detection.location_data.relative_bounding_box)

            # boundingbox = detection.location_data.relative_bounding_box

            img_height, img_width = img.shape[:2]

            global x,y,width,height

            x, y, width, height = (int(detection.location_data.relative_bounding_box.xmin * img_width),
                                   int(detection.location_data.relative_bounding_box.ymin * img_height),
                                   int(detection.location_data.relative_bounding_box.width * img_width),
                                   int(detection.location_data.relative_bounding_box.height * img_height)
                                   )

            real_face_width = 0.14

            focal_length = img_width * 1.0

            face_width = width

            distance_meter = (real_face_width * focal_length) / face_width

            distance_cm = int(distance_meter * 100)

            # cv2.rectangle(img,(x,y),(x+width,y+height),(140,0,144),2)

            # cv2.circle(img,(x,y),3,(255,0,255),cv2.FILLED) #TopLeft

            # cv2.circle(img, (x + width, y), 3, (255, 0, 255), cv2.FILLED) #TopRight

            # cv2.circle(img, (x, y + height), 3, (255, 0, 255), cv2.FILLED) #BottomLeft

            # cv2.circle(img, (x + width, y + height), 3, (255, 0, 255), cv2.FILLED) #BottomRigth

            global bounding_color

            cv2.line(img, (x, y), (x + 35, y), bounding_color, 2)

            cv2.line(img, (x, y), (x, y + 35), bounding_color, 2)

            cv2.line(img, (x + width, y), (x + width - 35, y), bounding_color, 2)

            cv2.line(img, (x + width, y), (x + width, y + 35), bounding_color, 2)

            cv2.line(img, (x, y + height), (x + 35, y + height), bounding_color, 2)

            cv2.line(img, (x, y + height), (x, y + height - 35), bounding_color, 2)

            cv2.line(img, (x + width, y + height), (x + width - 35, y + height), bounding_color, 2)

            cv2.line(img, (x + width, y + height), (x + width, y + height - 35), bounding_color, 2)

            area = int((width * height) / 100)

            return distance_cm

    return 0

latest_frame = None
msg_code = ""
color = ""
btn_flag = False
snapbtn = False
resetbtn = False
capture_event = th.Event()
capture_event.set()
def capture_frame():
    global latest_frame

    global msg_code,color

    global bounding_color

    global snapbtn,registerbtn,btn_flag

    global resetbtn

    cap = cv2.VideoCapture(0)

    while True:

        capture_event.wait()

        success, img = cap.read()

        img_face_detection = img.copy()

        imgBGR = cv2.cvtColor(img_face_detection, cv2.COLOR_BGR2RGB)

        distance = bounding_box(img_face_detection,imgBGR)

        _, buffer = cv2.imencode('.jpg', img_face_detection)

        latest_frame = base64.b64encode(buffer).decode('utf-8')

        msg_code = ''

        if not (distance < 45):
            msg_code = "Face To Far!"

            color = "#a83e32" #red

            bounding_color = (0, 0, 158)

            btn_flag = True

        else:
            bounding_color = (0, 255, 0)

            btn_flag = False


        img_wface_detection = img.copy()

        time.sleep(0.03)

        if snapbtn:

            _, buffer = cv2.imencode('.jpg', img_wface_detection)

            latest_frame = base64.b64encode(buffer).decode('utf-8')

            face_encodings(img_wface_detection)

            snapbtn = False

            capture_event.clear()

    cap.release()


face_encode = []
def face_encodings(img_wface_detection):

    imgbgr = cv2.cvtColor(img_wface_detection, cv2.COLOR_BGR2RGB)

    crop_img = imgbgr[y:y + height, x:x+width]

    face_location = [(y,x + width,y + height,x)]

    face_encoding = fr.face_encodings(imgbgr,face_location)

    if face_encoding:
        global face_encode

        face_encode = face_encoding[0]



def face_register_database(username,face_encodings):

    faces = face_encodings.tolist()

    user = username

    user_data = {"Name":user,"FaceEncode":faces}

    code = fb.insert_face(user_data)

    global msg_code

    global color

    if code:
        msg_code = "Sucessfull Register"

        color = "#32db18" #green

    else:
        msg_code = "unsucessfull Register"

        color = "#a83e32" #red



eel.init('DASHBOARD')

@eel.expose
def FaceRegister():
    data = {"frame":latest_frame,"message":msg_code,"color":color,'button':btn_flag}

    return data


@eel.expose
def snap_button(is_pressed):
    global snapbtn
    snapbtn = is_pressed

@eel.expose
def reset_button(is_pressed):
    global resetbtn
    resetbtn = is_pressed

    capture_event.set()

@eel.expose
def register_button(username):

    global face_encode

    global msg_code

    users = username

    if users == '':
        msg_code = "Please Enter Your Name!"

    else:
        face_register_database(users,face_encode)


thread = th.Thread(target=capture_frame)
thread.daemon = True
thread.start()
#eel.start('FaceRegister.html',size=((1920,1080)))

