/* milimo concierge - floating chat widget
   Backend: Supabase edge function (milimo-chat) powered by Claude.
   Include with: <script src="chat.js" defer></script> */
(function () {
    var API = 'https://jiquevvzrdavgqonvvug.supabase.co/functions/v1/milimo-chat';
    var GREETING = "Hi, I'm the milimo concierge. Ask me anything - wedding cars, corporate transfers, formals, seniors transport, prices, availability - and I'll point you in the right direction.";
    var FALLBACK = "I can't reach our chat service right now - please call 1300 884 536 or use the enquiry form on this page and Leanne will look after you directly.";

    var session = sessionStorage.getItem('milimo-chat-session');
    if (!session) {
        session = 'web-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
        sessionStorage.setItem('milimo-chat-session', session);
    }
    var history = [];

    var css = document.createElement('style');
    css.textContent = "\
#mlc-btn { position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px; border-radius: 50%; background: #1B2A41; border: 1px solid rgba(212,184,122,0.5); box-shadow: 0 6px 24px rgba(13,23,38,0.35); cursor: pointer; z-index: 99990; display: flex; align-items: center; justify-content: center; transition: transform 0.25s, box-shadow 0.25s; }\
#mlc-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(13,23,38,0.45); }\
#mlc-btn svg { width: 26px; height: 26px; fill: none; stroke: #D4B87A; stroke-width: 1.6; }\
#mlc-panel { position: fixed; bottom: 98px; right: 24px; width: 360px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 130px); background: #FAF8F3; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; box-shadow: 0 18px 60px rgba(13,23,38,0.3); z-index: 99991; display: none; flex-direction: column; overflow: hidden; font-family: 'Inter', sans-serif; }\
#mlc-panel.open { display: flex; }\
#mlc-head { background: linear-gradient(160deg, #122034, #1B2A41); color: #fff; padding: 1rem 1.2rem; }\
#mlc-head h4 { margin: 0; font-family: 'Playfair Display', serif; font-weight: 500; font-size: 1.05rem; letter-spacing: 0.5px; }\
#mlc-head p { margin: 2px 0 0; font-size: 0.68rem; color: rgba(255,255,255,0.65); letter-spacing: 1px; }\
#mlc-close { position: absolute; right: 14px; top: 14px; background: none; border: none; color: rgba(255,255,255,0.7); font-size: 1.1rem; cursor: pointer; line-height: 1; }\
#mlc-msgs { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.7rem; }\
.mlc-m { max-width: 85%; padding: 0.65rem 0.9rem; border-radius: 10px; font-size: 0.82rem; line-height: 1.55; white-space: pre-wrap; }\
.mlc-bot { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-top: 2px solid #1B2A41; color: #23201B; align-self: flex-start; }\
.mlc-user { background: #1B2A41; color: #fff; align-self: flex-end; }\
.mlc-typing { align-self: flex-start; color: rgba(35,32,27,0.5); font-size: 0.78rem; font-style: italic; }\
#mlc-form { display: flex; gap: 0.5rem; padding: 0.8rem; border-top: 1px solid rgba(0,0,0,0.08); background: #fff; }\
#mlc-in { flex: 1; border: 1px solid rgba(0,0,0,0.16); border-radius: 3px; padding: 0.6rem 0.8rem; font-family: 'Inter', sans-serif; font-size: 0.82rem; color: #23201B; outline: none; }\
#mlc-in:focus { border-color: #B8995A; }\
#mlc-send { background: #B8995A; color: #0D0D0D; border: none; border-radius: 3px; padding: 0 1rem; font-family: 'Inter', sans-serif; font-size: 0.7rem; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; cursor: pointer; transition: background 0.25s; }\
#mlc-send:hover { background: #D4B87A; }\
#mlc-send:disabled { opacity: 0.5; cursor: default; }\
@media (max-width: 480px) { #mlc-panel { right: 16px; bottom: 90px; } #mlc-btn { right: 16px; bottom: 16px; } }";
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'mlc-btn';
    btn.setAttribute('aria-label', 'Chat with milimo');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-4.1A8.38 8.38 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3a8.5 8.5 0 0 1 9.5 8.5z"/></svg>';

    var panel = document.createElement('div');
    panel.id = 'mlc-panel';
    panel.innerHTML = '\
<div id="mlc-head" style="position:relative;">\
  <h4>milimo concierge</h4>\
  <p>USUALLY REPLIES IN SECONDS &middot; 24/7</p>\
  <button id="mlc-close" aria-label="Close chat">&#10005;</button>\
</div>\
<div id="mlc-msgs"></div>\
<form id="mlc-form">\
  <input id="mlc-in" type="text" placeholder="Ask about cars, dates, prices..." autocomplete="off" maxlength="500">\
  <button id="mlc-send" type="submit">Send</button>\
</form>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    var msgs = panel.querySelector('#mlc-msgs');
    var form = panel.querySelector('#mlc-form');
    var input = panel.querySelector('#mlc-in');
    var send = panel.querySelector('#mlc-send');
    var greeted = false;

    function add(text, who) {
        var d = document.createElement('div');
        d.className = 'mlc-m ' + (who === 'user' ? 'mlc-user' : 'mlc-bot');
        d.textContent = text;
        msgs.appendChild(d);
        msgs.scrollTop = msgs.scrollHeight;
        return d;
    }

    btn.addEventListener('click', function () {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            if (!greeted) { add(GREETING, 'bot'); greeted = true; }
            input.focus();
        }
    });
    panel.querySelector('#mlc-close').addEventListener('click', function () {
        panel.classList.remove('open');
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (!q) return;
        input.value = '';
        add(q, 'user');
        history.push({ role: 'user', content: q });
        send.disabled = true;

        var t = document.createElement('div');
        t.className = 'mlc-typing';
        t.textContent = 'milimo is typing...';
        msgs.appendChild(t);
        msgs.scrollTop = msgs.scrollHeight;

        fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: history.slice(-10), session: session })
        }).then(function (r) { return r.json(); }).then(function (d) {
            t.remove();
            var a = d.answer || FALLBACK;
            add(a, 'bot');
            history.push({ role: 'assistant', content: a });
            send.disabled = false;
            input.focus();
        }).catch(function () {
            t.remove();
            add(FALLBACK, 'bot');
            send.disabled = false;
        });
    });
})();
