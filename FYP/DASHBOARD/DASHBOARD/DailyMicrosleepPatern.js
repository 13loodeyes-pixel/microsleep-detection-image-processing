function getDataFromPython_MicroSleepPattern(data)
{
    var chart = document.getElementById("pieChart").getContext('2d');
    var pieChart = new Chart(chart, {
        type: 'pie',
        data: {
            labels: ['Morning', 'Afternoon','Evening', 'Night', 'Midnight'], // Labels for the pie chart segments
            datasets: [{
                label: '', // Empty dataset label to remove "My First Dataset"
                data: [data.count_days[0], data.count_days[1],data.count_days[2], data.count_days[3], data.count_days[4]], // Data values for the segments
                backgroundColor: ['#a3c8f0', '#D1A6A1','#bfc1c2', '#4a6c8b', '#3e444d'], // Colors for each segment
                borderWidth: 1, // Set the border width (optional, adjust to your preference)
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        // Only show the label in the legend without values
                        generateLabels: function(chart) {
                            return chart.data.labels.map(function(label, index) {
                                return {
                                    text: label, // Only show label (Morning, Evening, etc.)
                                    fillStyle: chart.data.datasets[0].backgroundColor[index] // Set the corresponding color
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        // Custom label format: display the value with the label in the tooltip
                        label: function(tooltipItem) {
                            var label = tooltipItem.label; // Get the label (Morning, Evening, etc.)
                            var value = tooltipItem.raw; // Get the data value (300, 50, 100, 150)
                            if(value < 2)
                            {
                                return "Microsleep Occurs: " + value + " Time"; // Format as "Morning: 300", "Evening: 50", etc.
                            }
                            else
                            {
                                return "Microsleep Occurs: " + value + " Times"; // Format as "Morning: 300", "Evening: 50", etc.
                            }

                        }
                    }
                }
            }
        }
    });

    const morning = document.getElementById('morning');
    const afternoon = document.getElementById('afternoon');
    const evening = document.getElementById('evening');
    const night = document.getElementById('night');
    const midnight = document.getElementById('midnight');
    morning.innerHTML= `Morning: ${data.percent[0]}%`;
    afternoon.innerHTML= `Afternoon: ${data.percent[1]}%`;
    evening.innerHTML= `Evening: ${data.percent[2]}%`;
    night.innerHTML= `Night: ${data.percent[3]}%`;
    midnight.innerHTML= `Midnight: ${data.percent[4]}%`;

}

window.onload = function()
{
    eel.GetDailyMicrosleepPattern()().then(function(data){

        getDataFromPython_MicroSleepPattern(data);

    }).catch(function(error){

       console.error("Error Receiving data: ", error); // Handle any errors

    });
}
