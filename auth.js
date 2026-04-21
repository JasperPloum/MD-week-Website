(function () {
    const session = JSON.parse(localStorage.getItem('mingle_session') || 'null');
    const users   = JSON.parse(localStorage.getItem('mingle_users') || '[]');
    if (session && users.find(u => u.username === session.username)) {
        window.location.replace('app.html');
    }
})();

function showMsg(text, type) {
    const el = document.getElementById('auth-msg');
    el.textContent = text;
    el.className = 'msg ' + type;
}

function clearMsg() {
    const el = document.getElementById('auth-msg');
    el.className = 'msg';
    el.textContent = '';
}

function togglePw(id) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById('panel-' + t.dataset.tab).classList.add('active');
        clearMsg();
    });
});

document.getElementById('su-pw').addEventListener('input', function () {
    let s = 0;
    if (this.value.length >= 8) s++;
    if (/[A-Z]/.test(this.value)) s++;
    if (/[0-9]/.test(this.value)) s++;
    if (/[^A-Za-z0-9]/.test(this.value)) s++;
    s = Math.min(s - 1, 3);
    const bar = document.getElementById('pw-bar');
    bar.style.width = ['25%','50%','75%','100%'][s] || '0%';
});

function handleLogin() {
    const id = document.getElementById('li-id').value.trim();
    const pw = document.getElementById('li-pw').value;

    const users = JSON.parse(localStorage.getItem('mingle_users') || '[]');
    const user  = users.find(u => (u.email === id || u.username === id) && u.password === pw);

    if (!user) return showMsg('Incorrect credentials.', 'error');

    localStorage.setItem('mingle_session', JSON.stringify({ username: user.username }));
    window.location.href = 'app.html';
}

function handleSignup() {
    const first    = document.getElementById('su-first').value.trim();
    const last     = document.getElementById('su-last').value.trim();
    const username = document.getElementById('su-user').value.trim();
    const email    = document.getElementById('su-email').value.trim();
    const pw       = document.getElementById('su-pw').value;

    const users = JSON.parse(localStorage.getItem('mingle_users') || '[]');

    const newUser = { first, last, username, email, password: pw };
    users.push(newUser);

    localStorage.setItem('mingle_users', JSON.stringify(users));
    localStorage.setItem('mingle_session', JSON.stringify({ username }));

    window.location.href = 'app.html';
}

function googleStub() {
    showMsg('Google sign-in requires backend.', 'error');
}