from datetime import datetime
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

cred = credentials.Certificate(r"microsleep-privatekey.json")

firebase_admin.initialize_app(cred)

db = firestore.client()

def filter_data(data):

    data_str = str(data[0])

    data_str = data_str.split(" ")

    date = data_str[0]

    year,month,date = date.split("-")

    time = data_str[1].split(".")

    time_24_format = time[0]

    time_24_format_obj = datetime.strptime(time_24_format, "%H:%M:%S")

    time_12_format_obj = time_24_format_obj.strftime("%I:%M:%S %p")

    time_12_format = time_12_format_obj.split(" ")

    hour,minute,second = time_12_format[0].split(":")

    format = time_12_format[1]

    day = ""

    if format == "AM":

        if int(hour) == 12:

            day = "Morning"

        else:
            day = "Morning"

    else:
        if int(hour) < 3:

            day = "Afternoon"

        elif int(hour) > 3 and int(hour) < 8:

            day = "Evening"

        elif int(hour) > 8 and int(hour) < 12:

            day = "Night"

    c_date = f'{date}/{month}/{year}'

    c_time = f'{hour}:{minute}:{second} {format}'

    total_msec = round(data[1],3)

    total_num = data[2]

    c_day = day

    firebase_data = {"Date":c_date,"Time":c_time,"Eyes Closed/S":total_msec,"Total Number Eyes Closed":total_num,"Day":c_day}

    return firebase_data



def insert(name,data):

    new_data = filter_data(data)

    print(new_data)

    document_reference = db.collection("Microsleep").document(name).collection("Information")

    try:
        document_reference.add(new_data)

        print("Data is sucessfully added to Firebase")

    except Exception as e:

        print(f'Error writing document: {e}')


def fetch(id,name,collection):

    try:
        collection_name = db.collection(id).document(name).collection(collection)

        doc = collection_name.stream()


    except Exception as e:

        print(f'Error Fetching Data: {e}')


    return doc


#fetch("Microsleep","rickesh")

def insert_face(user_data):

    try:
        document_reference = db.collection("User").document()

        document_reference.set(user_data)

        return 1

    except Exception as e:
        print(f'Error writing document: {e}')

        return 0

def fetch_face(id):
    try:
        collection_name = db.collection(id)

        doc = collection_name.stream()

    except Exception as e:
        print(f"Error Fetching Face Document: {e}")

    return doc


def check_name(name):
    try:
        document_reference = db.collection("Microsleep").document(name).collection('Information')

        name = document_reference.stream()

        found = False

        for n in name:

            found = True

        if found:
            return found

        return found

    except Exception as e:
        print(f'Error Fetching Name In Document: {e}')

#check_name("rickesh")