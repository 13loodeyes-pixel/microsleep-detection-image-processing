function getDataFromPython(data)
{
  const ctx = document.getElementById('myLineChart').getContext('2d');

  const myLineChart = new Chart(ctx,
  {
    type: 'line',

    data:
    {
      labels: data.Time,  // X-axis

      datasets:
      [{
        label: 'Longest Microsleep Duration',  // Label for the dataset

        data: data.eyeClose, // Y-axis data

        borderColor: 'rgba(8, 2, 99, 1)', // Line color

        backgroundColor: 'rgba(2, 99, 38, 0.2)', // Line fill color

        fill: true,  // Whether to fill the area below the line

        tension: 0.1 // Line smoothness (0 = straight lines, 1 = very smooth curves)
      }]
    },

    options:
    {
      responsive: true, // Make the chart responsive to window resizing

      scales:
      {
        x:
        {
          title:
          {
            display: true,
            text: 'Time' // X-axis title
          }
        },
        y:
        {
          title:
          {
            display: true,
            text: 'Eye Closure(Sec)' // Y-axis title
          }
        }
      }
    }
  });

  const time = document.getElementById('time');
  time.innerHTML = data.peakTime;
  const average_eye_close = document.getElementById('avg_eye_close')
  average_eye_close.innerHTML = `Eye Close ${data.averageEyeClose} Second`;
  moveNeedle(data.percent);


}

function moveNeedle(percentage)
{
  const needle = document.querySelector('.progress_bar_needle');
  const progressBarWidth = 480;
  const needlePosition = (percentage / 100) * progressBarWidth;
  needle.style.left = `${needlePosition - needle.offsetWidth / 2}px`;
}

window.onload = function()
{
    eel.get_user_data()().then(function(data)
    {
        getDataFromPython(data);

    }).catch(function(error) {
        console.error("Error Receiving data: ", error); // Handle any errors
    });

}
