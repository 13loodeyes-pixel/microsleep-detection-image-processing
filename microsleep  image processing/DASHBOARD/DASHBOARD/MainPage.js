function check_name(){

    search_btn = document.getElementById('seach_btn');

    msg = document.getElementById('msg_error');

    serach_bar = document.getElementById('serach_bar');

    const ms_peakhour = document.getElementById('ms-peakhour');

    const ms_pattern = document.getElementById('ms-pattern');

    const ms_eyeclose = document.getElementById('ms-eyeclose');

    ms_peakhour.disabled = true;
    ms_pattern.disabled = true;
    ms_eyeclose.disabled = true;

    ms_peakhour.style.opacity=0.5;
    ms_pattern.style.opacity=0.5;
    ms_eyeclose.style.opacity=0.5;


    seach_btn.addEventListener('click',function(){

        eel.getName(serach_bar.value)(function(data){

            if(data.name_check)
            {
                msg.innerHTML = "Name Found";
                msg.style.color = '#1d913c';
                ms_peakhour.style.opacity=1;
                ms_pattern.style.opacity=1;
                ms_eyeclose.style.opacity=1;

                ms_peakhour.disabled = false;
                ms_pattern.disabled = false;
                ms_eyeclose.disabled = false;

            }

            else
            {
                msg.innerHTML = "Name Not Found";
                msg.style.color = '#b50b02';
                ms_peakhour.style.opacity=0.5;
                ms_pattern.style.opacity=0.5;
                ms_eyeclose.style.opacity=0.5;

                ms_peakhour.disabled = true;
                ms_pattern.disabled = true;
                ms_eyeclose.disabled = true;

            }
        });


    });

}

function btn_config(){

    ms_peakhour = document.getElementById('ms-peakhour');

    ms_pattern = document.getElementById('ms-pattern');

    ms_eyeclose = document.getElementById('ms-eyeclose');

    face_register = document.getElementById('face-register');

    ms_eyeclose.addEventListener('click',function(){
            if(!ms_peakhour.disabled){
                window.location.href = 'TotalEyesClosePerDay.html';
            }
    });

    ms_pattern.addEventListener('click',function(){

             if(!ms_pattern.disabled){
                window.location.href = 'DailyMicrosleepPatern.html';
             }
    });

    ms_peakhour.addEventListener('click',function(){

            if(!ms_eyeclose.disabled){
                 window.location.href = 'GuiFYP.html';
            }

    });

    face_register.addEventListener('click',function(){

        window.location.href = 'FaceRegister.html';

        eel.start_camera();

    });

}

window.onload = function(){

    check_name();

    btn_config();
};

