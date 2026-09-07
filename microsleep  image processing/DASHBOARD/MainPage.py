import eel
import Firebase
import numpy as np

def time_percent(time):
    if 0 <= time <= 2:
        percent = np.interp(time, [0, 2], [70, 95])

    elif 2 < time <= 4:
        percent = np.interp(time, [2, 4], [36, 60])

    elif time > 4:
        percent = np.interp(time, [4, 10], [5, 30])


    else:
        percent = 0

    return min(max(percent,0),100)


eel.init("DASHBOARD")

username = ''

@eel.expose
def getTotalEyesClosedPerDay():

    global username

    data_ret = Firebase.fetch("Microsleep",username, "Information")

    eye_close_list = []

    date_list = []

    for doc in data_ret:
        data = doc.to_dict()

        date = data.get("Date")

        eye_close = data.get('Total Number Eyes Closed')

        if date not in date_list:
            date_list.append(date)

            eye_close_list.append(eye_close)

        else:
            index = date_list.index(date)

            eye_close_list[index] += eye_close

    data = {"date":date_list,"eye_close":eye_close_list}

    return data

@eel.expose
def GetDailyMicrosleepPattern():

    chec_name = False

    global username

    data_ret = Firebase.fetch("Microsleep",username,"Information")

    num_days = []

    for doc in data_ret:
        chec_name = True

        data = doc.to_dict()

        day = data.get("Day")

        num_days.append(day)

    if not chec_name:
        print("Name Not Found")

    days = [num_days.count("Morning"),num_days.count("Afternoon"),num_days.count("Evening"), num_days.count("Night"), num_days.count("Midnight")]

    total_days = sum(days)

    if total_days > 0:

        percent = [round((count / total_days) * 100) for count in days]

    else:
        percent = [0, 0, 0, 0]

    data = {'count_days':days,'percent':percent}

    return data

@eel.expose
def get_user_data():

    global username

    data_ret = Firebase.fetch("Microsleep", username, "Information")

    time_list = []

    eye_close_sec_list = []

    for doc in data_ret:
        fdata = doc.to_dict()

        time = fdata.get('Time')

        eye_close_sec = fdata.get('Eyes Closed/S')

        time_list.append(time)

        eye_close_sec_list.append(eye_close_sec)

    total_eye_close = sum(eye_close_sec_list)

    average_eye_close = np.mean(eye_close_sec_list)

    max_eye_close = max(eye_close_sec_list)

    index = eye_close_sec_list.index(max_eye_close)

    peak_time = time_list[index]

    percentage = time_percent(average_eye_close)

    print(percentage)

    average_eye_close = format(average_eye_close, '.2f')

    data = {'Time': time_list, 'eyeClose':eye_close_sec_list,'peakTime':peak_time,'averageEyeClose':average_eye_close,'percent':percentage}

    return data

@eel.expose
def start_camera():
    import FaceRegister

@eel.expose
def getName(name):

    global username

    username = name

    name = Firebase.check_name(name)

    data = {"name_check":name}

    #print(name)

    return data

eel.start("MainPage.html",size=((1920,1080)))
