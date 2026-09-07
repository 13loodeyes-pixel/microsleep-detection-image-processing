from kivymd.app import MDApp

from kivy.lang.builder import Builder

from kivymd.uix.floatlayout import MDFloatLayout

from kivymd.uix.boxlayout import MDBoxLayout

from kivymd.uix.label import MDLabel

from kivymd.uix.card import MDCard

from matplotlib import pyplot as plt

from matplotlib.font_manager import FontProperties

from kivy_garden.matplotlib import FigureCanvasKivy

from kivy.core.window import Window

import numpy as np
from matplotlib.ticker import MaxNLocator

import Firebase

class Dashboard(MDApp):

    def build(self):
        self.theme_cls.theme_style = "Light"
        self.root = Builder.load_file("PoliFyp.kv")
        self.create_bar_plot()
        Window.borderless = True
        #self.create_pie_plot()
        #self.create_line_plot()
        return self.root

    def filterretrieve_data_bar(self):

        data_ret = Firebase.fetch("Microsleep")

        eye_close_list = []

        date_list = []

        for doc in data_ret:
            # print(doc.id,doc.to_dict())

            data = doc.to_dict()

            date = data.get("Date")

            eye_close = data.get('Total Number Eyes Closed')

            if date not in date_list:
                date_list.append(date)

                eye_close_list.append(eye_close)

            else:
                index = date_list.index(date)

                eye_close_list[index] += eye_close

            # print(date)

        # date_list.sort()

        # eye_close_list.sort()

        print(eye_close_list)

        return date_list, eye_close_list


    def filterretrieve_data_line(self):

        date_ret = Firebase.fetch("Microsleep")

        time_list = []

        eye_close_sec_list = []

        for doc in date_ret:

            data = doc.to_dict()

            time = data.get('Time')

            eye_close_sec = data.get('Eyes Closed/S')

            time_list.append(time)

            eye_close_sec_list.append(eye_close_sec)

        total_eye_close = sum(eye_close_sec_list)

        average_eye_close = np.mean(eye_close_sec_list)

        max_eye_close = max(eye_close_sec_list)

        index = eye_close_sec_list.index(max_eye_close)

        peak_time = time_list[index]

        return time_list,eye_close_sec_list,average_eye_close,peak_time


    def filter_data_pie(self):

        date_ret = Firebase.fetch("Microsleep")

        num_days = []

        for doc in date_ret:
            data = doc.to_dict()

            day = data.get("Day")

            num_days.append(day)

        days = [num_days.count("Morning"),num_days.count("Evening"),num_days.count("Night"),num_days.count("Midnight")]

        total_days = sum(days)

        if total_days > 0:

            percent = [round((count / total_days) * 100) for count in days]

        else:
            percent = [0,0,0,0]


        return percent


    def create_bar_plot(self):

        plt.clf()

        #colors = ['red','green','blue']

        plot_container = self.root.ids.plot_container

        plot_container.clear_widgets()

        self.root.ids.summary.opacity = 0

        plot_container.width = 600

        plot_container.height = 400

        date_list,eye_close_list = self.filterretrieve_data_bar()

        x = date_list

        y = eye_close_list

        plt.bar(x, y,0.6,color='#7eab91')

        plt.ylabel("Total Number Eyes Closed")

        plt.xlabel("Date")

        axis = plt.gca()

        axis.yaxis.set_major_locator(MaxNLocator(integer=True))

        #plt.xticks(rotation=10)

        plot_container.add_widget(FigureCanvasKivy(plt.gcf()))

    def create_pie_plot(self):

        plt.clf()

        plot_container = self.root.ids.plot_container

        self.root.ids.summary.opacity = 0

        plot_container.clear_widgets()

        label = ('Morning', 'Evening', 'Night', 'Midnight')

        colors = ['#A8E6CF', '#64B5F6', '#FFE08A', '#FF6F61']

        sizes = self.filter_data_pie()

        fig,axis = plt.subplots()

        wedges,test,autotext = axis.pie(sizes,labels=label, autopct='', startangle=90, textprops={'fontsize':12},colors=colors)

        center_circle = plt.Circle((0,0),0.70,color='white')

        fig.gca().add_artist(center_circle)

        axis.axis('equal')

        for i, autotext in enumerate(autotext):

            autotext.set_text(f"{sizes[i]}%")

            autotext.set_fontsize(14)

        legend_x = 1.5

        legend_y = 0.5
        for i, label in enumerate(label):

            axis.add_patch(plt.Rectangle((legend_x, legend_y - 0.1 * i), 0.1, 0.1, color=colors[i]))

            plt.text(legend_x + 0.15, legend_y - 0.1 * i + 0.05, label, fontsize=12, va='center')


        plot_container.add_widget(FigureCanvasKivy(plt.gcf()))

        print(self.filter_data_pie())



    def create_line_plot(self):

        plt.clf()

        plot_container = self.root.ids.plot_container

        plot_container.clear_widgets()

        self.root.ids.summary.opacity = 1

        time_list,eye_close_sec_list,average_eye_close,peaktime = self.filterretrieve_data_line()

        y = eye_close_sec_list

        x = time_list

        plt.plot(x,y,marker='o',color='#548B8B')

        plt.xlabel("Time")

        plt.ylabel("Duration Of Eye Close")

        plt.xticks(rotation=85)

        #plt.title("hanishkaran")

        border = plt.gca()

        border.spines['top'].set_visible(False)

        border.spines['right'].set_visible(False)

        plot_container.add_widget(FigureCanvasKivy(plt.gcf()))

        average_eye_close = format(average_eye_close,'.2f')

        self.root.ids.peak.text = f"Peak Time: {peaktime}"

        self.root.ids.average.text = f"Average: {average_eye_close} ms"

        print("Peak Time:", peaktime)

        print("Average",average_eye_close)


Dashboard().run()