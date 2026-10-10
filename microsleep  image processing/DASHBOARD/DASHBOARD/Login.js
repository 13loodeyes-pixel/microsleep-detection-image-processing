'use strict';
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button=document.getElementById('login-button');const message=document.getElementById('login-message');
    button.disabled=true;message.textContent='Signing in…';message.removeAttribute('data-error');
    try {
      const result=await fetch('/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value})});
      const data=await result.json();
      if(!result.ok) throw new Error(data.error||'Could not sign in');
      document.getElementById('password').value='';location.assign('/MainPage.html');
    } catch(error) {message.textContent=error.message;message.dataset.error='true';}
    finally {button.disabled=false;}
  });
});
