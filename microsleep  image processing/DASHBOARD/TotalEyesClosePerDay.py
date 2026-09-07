import eel
import Firebase

eel.init("DASHBOARD")

@eel.expose
def getTotalEyesClosedPerDay(name):

    data_ret = Firebase.fetch("Microsleep",name, "Information")

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

#eel.start("TotalEyesClosePerDay.html",size=((1920,1080)))