import cv2
import mediapipe as mp
import numpy as np
import math
import time

import datetime
import pyttsx3
import smtplib

import Firebase
from Firebase import insert
from collections import deque
import face_recognition
import threading
import queue

data_pack = []

mpFace = mp.solutions.face_mesh

face = mpFace.FaceMesh(refine_landmarks=True)

mpFaceDetection = mp.solutions.face_detection

face_detect = mpFaceDetection.FaceDetection()

draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

message_triggered = False

face_distance = 50

def send_email(msg):
    
    email = "mmugeshkaran@gmail.com"
    
    receiver = "khairulfikrif021@gmail.com"
    
    server = smtplib.SMTP("smtp.gmail.com",587)
    
    server.starttls()
    
    server.login(email,"cdhxaqnaoxtqgjen")
    
    server.sendmail(email,receiver,msg)

result_from_database = queue.Queue()
def fetch_data_database(q):
    face_fetch = Firebase.fetch_face("User")

    face_encodin = []

    face_name = []

    face_data = {}

    for doc in face_fetch:
        data = doc.to_dict()

        face_encode = data.get("FaceEncode")

        name = data.get("Name")

        #face_encodin.append(face_encode)

        #q.put(face_encodin)

        face_data = (name,face_encode)

        q.put(face_data)


fetch_thread = threading.Thread(target=fetch_data_database,args=(result_from_database,))

fetch_thread.start()

def reload_data():
    fetch_thread = threading.Thread(target=fetch_data_database, args=(result_from_database,))

    fetch_thread.start()

bounding_color = (0, 255, 0)
frame_counter = 0
name = ''
def bounding_box(result_faceDectection,imgBGR,img):

    def face_recog(x,y,width,height):

        frame_list = []

        name_face_database = []

        face_encode_database = []

        face_location = [y, x+width, y+height, x]

        #img_crop = img[face_location[0]:face_location[2],face_location[3]:face_location[1]]

        global frame_counter

        if frame_counter < 5:
            frame_list.append(imgBGR)

            frame_counter = frame_counter + 1

        if frame_counter == 5:
            for frame in frame_list:
                encodings = face_recognition.face_encodings(frame,[face_location])[0].tolist()

                encodings = np.array(encodings)

                #print(type(encodings))

                for result in range(result_from_database.qsize()):
                    face_data = result_from_database.get()

                    name_face_database.append(face_data[0])

                    face_encode_database.append(face_data[1])

                    #print(f'{face_encode_database}:')

                face_encode_database = np.array(face_encode_database)

                global name

                for index,face_detect in enumerate(face_encode_database):

                    result = face_recognition.compare_faces([face_detect],encodings)

                    if result[0]:
                        name = name_face_database[index]

                #for index,face_database in enumerate(face_encode_database):

    if result_faceDectection.detections:

        for detection in result_faceDectection.detections:

            #draw.draw_detection(img,detection)

            #print(detection.location_data.relative_bounding_box)

            #boundingbox = detection.location_data.relative_bounding_box

            img_height, img_width = img.shape[:2]

            x,y,width,height= (int(detection.location_data.relative_bounding_box.xmin * img_width),
                               int(detection.location_data.relative_bounding_box.ymin * img_height),
                               int(detection.location_data.relative_bounding_box.width * img_width),
                               int(detection.location_data.relative_bounding_box.height * img_height)
                               )

            real_face_width = 0.14

            focal_length = img_width * 1.0

            face_width = width

            distance_meter = (real_face_width * focal_length) / face_width

            distance_cm = int(distance_meter * 100)

            #cv2.rectangle(img,(x,y),(x+width,y+height),(140,0,144),2)

            #cv2.circle(img,(x,y),3,(255,0,255),cv2.FILLED) #TopLeft

            #cv2.circle(img, (x + width, y), 3, (255, 0, 255), cv2.FILLED) #TopRight

            #cv2.circle(img, (x, y + height), 3, (255, 0, 255), cv2.FILLED) #BottomLeft

            #cv2.circle(img, (x + width, y + height), 3, (255, 0, 255), cv2.FILLED) #BottomRigth

            global bounding_color

            cv2.line(img,(x,y),(x + 35 , y), bounding_color,2)

            cv2.line(img, (x, y), (x, y + 35), bounding_color, 2)

            cv2.line(img, (x + width, y), (x + width - 35, y), bounding_color, 2)

            cv2.line(img, (x + width, y), (x + width, y + 35), bounding_color, 2)

            cv2.line(img, (x, y + height), (x + 35, y + height), bounding_color, 2)

            cv2.line(img, (x, y + height), (x, y + height - 35), bounding_color, 2)

            cv2.line(img, (x + width, y + height), (x + width - 35, y + height), bounding_color, 2)

            cv2.line(img, (x + width, y + height), (x + width, y + height - 35), bounding_color, 2)

            bottom_center_x = x + width // 2

            bottom_center_y = y + height + 25

            face_recog(x,y,width,height)

            Text(name,(bottom_center_x - len(name) * 5,bottom_center_y),0.65,(52, 235, 219))

            area = int((width * height) / 100)

            return distance_cm

    else:
        global frame_counter

        frame_counter = 0

        reload_data()

        #result_from_database.queue.clear()



RightEye = [362, 382, 381, 380, 374, 373, 390,249, 263, 466, 388, 387, 386, 385, 384, 398]

LeftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]

def draw_eyes(check):

    if check:

        for lefteye in LeftEye:

            print(faceCor[lefteye])

            cv2.circle(img, (faceCor[lefteye]), 1, (255, 255, 255), cv2.FILLED)

            for righteye in RightEye:
                cv2.circle(img, (faceCor[righteye]), 1, (255, 255, 255), cv2.FILLED)



calibrated = False

thresh_ear = 0

eye_close = 0
def eye_closure():

    #Right_Eye = [362,385,387,263,373,380]

    RverDistanceA = math.hypot((faceCor[373][0]-faceCor[387][0]),(faceCor[373][1]-faceCor[387][1]))

    RverDistanceB = math.hypot((faceCor[380][0]-faceCor[385][0]),(faceCor[380][1]-faceCor[385][1]))

    ear_distance_right = math.hypot((faceCor[263][0] - faceCor[362][0]),(faceCor[263][1] - faceCor[362][1]))

    ear_right = (RverDistanceA + RverDistanceB) / (2.0 * ear_distance_right)


    #Left_Eye = [33,160,158,133,153,144]

    LverDistanceA = math.hypot((faceCor[153][0] - faceCor[158][0]),(faceCor[153][1] - faceCor[158][1]))

    LverDistanceB = math.hypot((faceCor[144][0]-faceCor[160][0]),(faceCor[144][1] - faceCor[160][1]))

    ear_distance_left = math.hypot((faceCor[33][0] - faceCor[133][0]),(faceCor[33][1] - faceCor[133][1]))

    ear_left = (LverDistanceA + LverDistanceB) / (2.0 * ear_distance_left)

    global calibrated

    global thresh_ear

    ear_his_left = deque(maxlen=10)

    ear_his_right = deque(maxlen=10)

    if not calibrated:

        camera_calib = 100

        baseline_ear_left = []

        baseline_ear_right = []

        for i in range(camera_calib):

            baseline_ear_left.append(ear_left)

            baseline_ear_right.append(ear_right)

        avg_ear_baselinEar_left = np.mean(baseline_ear_left)

        avg_ear_baselinEar_right = np.mean(baseline_ear_left)

        avg_ear = (avg_ear_baselinEar_left + avg_ear_baselinEar_right) / 2

        thresh_ear = avg_ear * (1 - 0.3)

        calibrated = True

    if calibrated:

        for i in range(20):

            ear_his_left.append(ear_left)

            ear_his_right.append(ear_right)

            avg_ear_his_left = np.mean(ear_left)

            avg_ear_his_right = np.mean(ear_right)

            avg_ear_his = (avg_ear_his_left + avg_ear_his_right) / 2

        #print(avg_ear_his,thresh_ear)

        eye_status = ""

        global eye_close

        if (avg_ear_his < thresh_ear):
            eye_status = "Eye Closed"

            time.sleep(0.1)

            eye_close = eye_close + 1


        else:
            eye_status = "Eye Opened"

            eye_close = 0


        return eye_status,eye_close

        #x1, y1 = int(faceCor[380][0]), int(faceCor[380][1])

        #x2, y2 = int(faceCor[385][0]), int(faceCor[385][1])

        #cv2.line(img, (x1, y1), (x2, y2), (255, 0, 255), thickness=2)


iris_counter = 0
def iris_posture():

    LeftIris = [474, 475, 476, 477]

    RightIris = [469, 470, 471, 472]

    right_iris_x = 0

    right_iris_y = 0

    right_radius_sum = 0


    for rightiris in RightIris:

        right_iris_x = right_iris_x + faceCor[rightiris][0]

        right_iris_y = right_iris_y + faceCor[rightiris][1]


    right_iris_x = right_iris_x / len(RightIris)

    right_iris_y = right_iris_y / len(RightIris)


    for rightiris in RightIris:

        right_radius_sum = right_radius_sum + math.hypot(faceCor[rightiris][0] - right_iris_x, faceCor[rightiris][1] - right_iris_y)


    right_iris_radius = right_radius_sum / len(RightIris)

    #cv2.circle(img, (int(right_iris_x),int(right_iris_y)), int(right_iris_radius), (255,255,255), 2)


    left_iris_x = 0

    left_iris_y = 0

    left_radius_sum = 0


    for leftiris in LeftIris:

        left_iris_x = left_iris_x + faceCor[leftiris][0]

        left_iris_y = left_iris_y + faceCor[leftiris][1]


    left_iris_x = left_iris_x / len(LeftIris)

    left_iris_y = left_iris_y / len(LeftIris)


    for leftiris in LeftIris:

        left_radius_sum = left_radius_sum + math.hypot(faceCor[leftiris][0] - left_iris_x , faceCor[leftiris][1] - left_iris_y)

    left_iris_radius = left_radius_sum / len(LeftIris)

    eye_width = (faceCor[362][0] - faceCor[263][0],faceCor[133][0] - faceCor[33][0])

    iris_pos = ((left_iris_x - faceCor[263][0]) / eye_width[0],(right_iris_x - faceCor[33][0]) / eye_width[1])

    iris_posi = ""

    global iris_counter

    if (iris_pos[0] > 0.52 and iris_pos[1] < 0.46):

        iris_posi = "Eye Looking Right"

        time.sleep(0.1)

        iris_counter = iris_counter + 1


    elif (iris_pos[0] < 0.46 and iris_pos[1] > 0.46):

        iris_posi = "Eye Looking Left"

        time.sleep(0.1)

        iris_counter = iris_counter + 1

    else:
        iris_posi = "Eye Looking Straight"

        iris_counter = 0

    return iris_posi,iris_counter

    #cv2.circle(img,(int(left_iris_x),int(left_iris_y)),int(left_iris_radius),(255,0,255),cv2.FILLED)

    #cv2.circle(img, (int(faceCor[133][0]), int(faceCor[133][1])), 1, (255, 0, 255), cv2.FILLED)


head_counter = 0
def head_posture():

    h,w = img.shape[:2]

    face_landmark_3D = np.array([(0.0,0.0,0.0),(0.0,-330.0,-65.0),(-225.0,170.0,-135.0),(225.0,170.0,-135.0),(-150.0,-150.0,-125.0),(150.0,-150.0,-125.0)], dtype=np.float64)

    facial_landmark_3D = np.array([faceCor_3D[1],faceCor_3D[152],faceCor_3D[33],faceCor_3D[263],faceCor_3D[61],faceCor_3D[291]])

    #print(modelpoint.dtype)

    #faceCor[1]nosetip
    #faceCor[152]chin
    #faceCor[33]left-corner_eye
    #faceCor[263]right-corner_eye
    #faceCor[61]left-corner_mouth
    #faceCor[291]right-corner_mouth

    face_landmark_2D = np.array([faceCor[1],faceCor[152],faceCor[33],faceCor[263],faceCor[61],faceCor[291]],dtype=np.float64)

    #x , y  =  faceCor[199]

    #cv2.circle(img, (int(x),int(y)), 1, (255, 255, 255), 2)

    focal_length = w * 1.0

    principal_point = (w/2,h/2)

    camera_matrix = np.array([[focal_length,0,principal_point[0]],[0,focal_length,principal_point[1]],[0,0,1]],dtype=np.float64)

    distortion = np.zeros((4,1))

    sucess,rotation_vector,trans_vector = cv2.solvePnP(face_landmark_3D,face_landmark_2D,camera_matrix,distortion)

    sucess_roll,r_vector,t_vector = cv2.solvePnP(facial_landmark_3D,face_landmark_2D,camera_matrix,distortion)

    #print(np.linalg.norm(rotation_vector))

    #print(rotation_vector)

    if sucess and sucess_roll:

        project_points,_ = cv2.projectPoints(face_landmark_3D,rotation_vector,trans_vector,camera_matrix,distortion)

        for points in project_points:

            x,y = int(points[0][0]),int(points[0][1])

            cv2.circle(img,(x,y),3,(255,0,255),cv2.FILLED)

        for p in face_landmark_2D:

            x,y = int(p[0]),int(p[1])

            cv2.circle(img, (x, y), 3, (0, 255, 255), cv2.FILLED)


        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)

        rmat,_ = cv2.Rodrigues(r_vector)

        angles,_,_,_,_,_ = cv2.RQDecomp3x3(rmat)

        pitch_rad = np.arcsin(-rotation_matrix[2,1])

        roll_rad = np.arctan2(rotation_matrix[0,1]/np.cos(pitch_rad),rotation_matrix[1,2]/np.cos(pitch_rad))  #x-angle

        pitch = int(angles[0] * 360)

        yaw = int(angles[1] * 360)

        roll = int(np.degrees(roll_rad) / 2)

        head_pos = ""

        global head_counter

        if yaw < -10:
            head_pos = "Looking Left"

            time.sleep(0.1)

            head_counter = head_counter + 1

        elif yaw > 10:
            head_pos = "Looking Right"

            time.sleep(0.1)

            head_counter = head_counter + 1

        elif pitch < -10:
            head_pos = "Looking Down"

            time.sleep(0.1)

            head_counter = head_counter + 1

        elif pitch > 10:
            head_pos = "Looking Up"

            time.sleep(0.1)

            head_counter = head_counter + 1

        elif roll < -20:
            head_pos = "Head Tilt Left"

        elif roll > 20:
            head_pos = "Head Tilt Right"

        else:
            head_pos = "Looking Forward"

            head_counter = 0

    return head_pos,head_counter



def Text(txt,pos,scale,color):
    cv2.putText(img, txt, pos, cv2.FONT_HERSHEY_SIMPLEX, scale, color, 2)


microsleep_counter = 0

current_date_time = 0

eye_time = 0

microsleep_trigger = False

while True:

    sucess,img = cap.read()

    img = cv2.flip(img,1)

    imgBGR = cv2.cvtColor(img,cv2.COLOR_BGR2RGB)

    result = face.process(imgBGR)

    result_faceDectection = face_detect.process(imgBGR)

    faceCor = []

    faceCor_3D = []

    distance = bounding_box(result_faceDectection,imgBGR,img)

    if distance:

        if distance > face_distance and distance < face_distance + 30:

            if result.multi_face_landmarks:

                for facelm in result.multi_face_landmarks:

                    for landmark in facelm.landmark:
                        h, w = img.shape[:2]

                        #x, y= int(landmark.x * w), int(landmark.y * h)

                        x, y = landmark.x * w, landmark.y * h

                        faceCor.append((x, y))

                        faceCor_3D.append((x,y,landmark.z))

                        #print(z)

                        #cv2.circle(img,(x,y),1,(255,255,0),cv2.FILLED)

                #cv2.circle(img, (faceCor[362]), 2, (255, 255, 255), cv2.FILLED)

                head_position,head_time = head_posture()

                iris_position,iris_timer = iris_posture()

                eye_clopening,eye_close_time = eye_closure()

                Text(head_position,(10,30),0.8,(240, 247, 7))

                Text(iris_position,(10,70),0.75,(240, 247, 7))

                Text(eye_clopening,(10,110),0.75,(240, 247, 7))

                Text(f"Face:{distance}cm", (490, 60), 0.65, (205, 90, 106))


                if head_position == "Looking Forward" or head_position == "Head Tilt Right" or head_position == "Head Tilt Left":

                    if eye_clopening == "Eye Closed":

                        Text(eye_clopening, (10, 110), 0.75, (0, 0, 255))

                        if eye_close_time > 16:

                            Text("MicroSleep Alert!", (420, 30), 0.75, (0, 0, 255))

                            eye_time = 0

                            eye_time = eye_close_time * 0.1

                            bounding_color = (52,50,168)

                            if not microsleep_trigger:

                                microsleep_counter = microsleep_counter + 1

                                current_date_time = 0

                                current_date_time = datetime.datetime.now()

                                microsleep_trigger = True

                    elif eye_clopening == "Eye Opened":

                            microsleep_trigger = False

                            bounding_color = (0, 255, 0)

                elif head_position == "Looking Down":

                    Text(head_position, (10, 30), 0.8, (0, 0, 255))

                    if head_counter > 16:

                        Text("MicroSleep Alert!", (420, 30), 0.75, (0, 0, 255))

                        bounding_color = (52, 50, 168)

                        if not microsleep_trigger:

                            microsleep_counter = microsleep_counter + 1

                            current_date_time = 0

                            current_date_time = datetime.datetime.now()

                            bounding_color = (0, 255, 0)

                            microsleep_trigger = True

                elif head_position == "Looking Left":

                    if head_counter > 10:

                        Text(head_position, (10, 30), 0.8, (0, 0, 255))

                elif head_position == "Looking Right":

                    if head_counter > 10:

                        Text(head_position, (10, 30), 0.8, (0, 0, 255))


                if iris_position == "Eye Looking Left":

                    if iris_timer > 5:

                            Text(iris_position, (10, 70), 0.75, (0, 0, 255))

                elif iris_position == "Eye Looking Right":

                    if iris_timer > 5:

                        Text(iris_position, (10, 70), 0.75, (0, 0, 255))

        elif distance > face_distance + 40:
            Text("Face To Far!", (10, 50), 1, (0, 0, 255))

        elif distance < face_distance:
            Text("Face To Close!", (10, 50), 1, (0, 0, 255))


    cv2.imshow("img",img)

    if cv2.waitKey(1) & 0xFF == ord('q'):

        data = [current_date_time, eye_time, microsleep_counter]

        insert(name,data)
        
        break
    
cap.release()
    
cv2.destroyAllWindows()

    




