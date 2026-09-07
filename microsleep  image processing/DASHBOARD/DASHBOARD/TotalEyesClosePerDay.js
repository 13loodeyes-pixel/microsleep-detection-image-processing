function getDataFromPython(data)
{
    var ctx = document.getElementById("myBarChart").getContext('2d');
    var mybarchart = new Chart(ctx, {
        type: 'bar',
        data:{
            labels:data.date, //x-axis labels
            datasets:[{
               label: 'Daily Total Of Eyes Closed',
               data: data.eye_close,
               backgroundColor: ['rgba(0, 123, 123, 1)','rgba(0, 51, 102, 1)'],
               borderColor: ['rgba(200, 200, 200, 1)','rgba(173, 216, 230, 1)'],
               borderWidth:2
            }]
        },
        options:{
            scales:{
                y:{
                    beginsAtZero: true
                }
            }
        }
    });

}

window.onload = function()
{
    eel.getTotalEyesClosedPerDay()().then(function(data)
    {
        getDataFromPython(data);

    }).catch(function(error) {
        console.error("Error Receiving data: ", error); // Handle any errors
    });

}