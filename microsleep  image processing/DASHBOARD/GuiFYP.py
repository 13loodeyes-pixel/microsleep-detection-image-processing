import eel
import numpy as np
import Firebase

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

eel.init('DASHBOARD')

@eel.expose
def get_user_data(name):

    data_ret = Firebase.fetch("Microsleep", name, "Information")

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

#eel.start('GuiFYP.html',size=((1920,1080)))