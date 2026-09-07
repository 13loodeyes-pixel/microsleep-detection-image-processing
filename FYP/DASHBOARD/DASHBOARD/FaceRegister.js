let videoInterval;
let isSnapButtonPresed = false;
let isResetButtonPresed = false;

// Automatically start the video when the page is loaded
window.onload = function() {
    startVideo();
}

function startVideo() {
    // Start a loop to fetch frames every 100ms from Python
    videoInterval = setInterval(function() {
        eel.FaceRegister()(function(data) {
            const message = document.getElementById('msg_code');
            message.innerHTML = data.message;
            message.style.color = data.color;
            snapbutton.disabled = data.button;
            registerbutton.disabled = data.button;

            if(data.button)
            {
                registerbutton.style.opacity = 0.5;
                snapbutton.style.opacity = 0.5;
            }

            else
            {
                registerbutton.style.opacity = 1;
                snapbutton.style.opacity = 1;
            }

            if (data.frame) {
                // Update the video frame by setting the image source
                const videoFrame = document.getElementById('video_frame');
                video_frame.src = 'data:image/jpeg;base64,' + data.frame;

            }
        });
    }, 100); // Capture every 100ms (for a smooth stream)
}

snapbutton = document.getElementById('snap_btn');

registerbutton = document.getElementById('register_btn');

resetbutton = document.getElementById('reset_btn');

username = document.getElementById('username');

snapbutton.addEventListener('click',function(){

    //clearInterval(videoInterval);

    isSnapButtonPresed = true;

    eel.snap_button(isSnapButtonPresed);

});

registerbutton.addEventListener('click',function(){

    eel.register_button(username.value);

});


resetbutton.addEventListener('click',function(){

    isResetButtonPresed = true;

    eel.reset_button(isResetButtonPresed);

    username.value = '';

});