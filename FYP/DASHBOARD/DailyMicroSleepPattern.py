import eel
import Firebase

eel.init('DASHBOARD')

@eel.expose
def GetDailyMicrosleepPattern(name):

    chec_name = False

    #print(name)

    data_ret = Firebase.fetch("Microsleep","hanish","Information")

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

#eel.start('DailyMicrosleepPatern.html',size=((1920,1080)))