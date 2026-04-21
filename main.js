// ── Storage helpers (Persistent Storage API > localStorage fallback) ───────
const DB = {
    async get(key) {
        try {
            const r = await window.storage.get(key);
            return r ? JSON.parse(r.value) : null;
        } catch { return JSON.parse(localStorage.getItem(key) || 'null'); }
    },
    async set(key, val) {
        const s = JSON.stringify(val);
        try { await window.storage.set(key, s); } catch {}
        localStorage.setItem(key, s);
    },
    async remove(key) {
        try { await window.storage.delete(key); } catch {}
        localStorage.removeItem(key);
    }
};

// ── Guard: redirect to login if no session ────────────────────────────────
(async function () {
    const session = await DB.get('mingle_session');
    const users   = await DB.get('mingle_users') || [];
    if (!session || !users.find(u => u.username === session.username)) {
        window.location.replace('index.html');
    }
})();

// ── State ─────────────────────────────────────────────────────────────────
const FAKE_USERS = [
    { first:'Alex',  last:'Rivera', username:'alexr',    color:'#5b6ef5' },
    { first:'Mia',   last:'Chen',   username:'mia_chen', color:'#4caf86' },
    { first:'Sam',   last:'Torres', username:'samT',     color:'#e8c44a' },
];
const DEFAULT_POSTS = [
    { id:'f1', username:'alexr',    name:'Alex Rivera',  color:'#5b6ef5', body:'Just discovered this amazing little café downtown. The cortado here is unreal ☕', time:Date.now()-7200000,  likes:14, liked:false },
    { id:'f2', username:'mia_chen', name:'Mia Chen',     color:'#4caf86', body:'Working on a new design system — clean grids, fewer components, more clarity. Less is genuinely more.', time:Date.now()-18000000, likes:31, liked:false },
    { id:'f3', username:'samT',     name:'Sam Torres',   color:'#e8c44a', body:'Hot take: the best productivity tool is a long walk with no phone. Change my mind.', time:Date.now()-39600000, likes:52, liked:false },
];

let posts = [];
let user  = null;

// ── Boot ──────────────────────────────────────────────────────────────────
(async function () {
    const session = await DB.get('mingle_session');
    const users   = await DB.get('mingle_users') || [];
    user = users.find(u => u.username === session.username);

    const stored = await DB.get('mingle_posts');
    if (!stored) {
        posts = DEFAULT_POSTS;
        await DB.set('mingle_posts', posts);
    } else {
        posts = stored;
    }

    renderNav();
    renderSuggestions();
    renderFeed();
})();

function renderNav() {
    const av = document.getElementById('nav-avatar');
    av.textContent = user.first[0].toUpperCase();
    av.style.background = user.color;
    const ca = document.getElementById('compose-av');
    ca.textContent = user.first[0].toUpperCase();
    ca.style.background = user.color;
}

function renderSuggestions() {
    document.getElementById('suggestions').innerHTML = FAKE_USERS.map((u, i) => `
    <div class="suggest-row">
      <div class="sug-av" style="background:${u.color}">${u.first[0]}</div>
      <div class="sug-info"><div class="sug-name">${u.first} ${u.last}</div><div class="sug-handle">@${u.username}</div></div>
      <button class="btn-sug" id="sug${i}" onclick="toggleFollow(${i})">Follow</button>
    </div>`).join('');
}

function toggleFollow(i) {
    const btn = document.getElementById('sug' + i);
    const f = btn.classList.toggle('following');
    btn.textContent = f ? 'Following' : 'Follow';
    toast(f ? `Following @${FAKE_USERS[i].username}` : `Unfollowed @${FAKE_USERS[i].username}`);
}

function renderFeed() {
    document.getElementById('feed-list').innerHTML =
        [...posts].sort((a,b)=>b.time-a.time).map(postHTML).join('');
}

function renderProfile() {
    document.getElementById('p-av').textContent    = user.first[0];
    document.getElementById('p-av').style.background = user.color;
    document.getElementById('p-name').textContent   = user.first + ' ' + user.last;
    document.getElementById('p-handle').textContent = '@' + user.username;
    document.getElementById('p-joined').textContent = user.joined || 'Recently';
    const mine = posts.filter(p => p.username === user.username).sort((a,b)=>b.time-a.time);
    document.getElementById('p-posts').textContent = mine.length;
    const list = document.getElementById('p-posts-list');
    const empty = document.getElementById('p-empty');
    if (!mine.length) { list.innerHTML=''; empty.style.display='block'; return; }
    empty.style.display = 'none';
    list.innerHTML = mine.map(postHTML).join('');
}

function postHTML(p) {
    const isOwner = user && p.username === user.username;
    const deleteBtn = isOwner ? `
      <button class="post-action post-delete" onclick="deletePost('${p.id}')" title="Delete post">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : '';

    return `<div class="post" id="post-${p.id}">
    <div class="post-header">
      <div class="post-avatar" style="background:${p.color}">${p.name[0]}</div>
      <div class="post-meta">
        <div class="post-author">${p.name} <span style="color:var(--muted);font-weight:400;font-size:12px">@${p.username}</span></div>
        <div class="post-time">${timeAgo(p.time)}</div>
      </div>
      ${deleteBtn}
    </div>
    <div class="post-body">${esc(p.body)}</div>
    <div class="post-actions">
      <button class="post-action ${p.liked?'liked':''}" onclick="like('${p.id}')">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${p.likes}
      </button>
      <button class="post-action" onclick="toast('Replies coming soon!')">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Reply
      </button>
      <button class="post-action" onclick="toast('Link copied!')">
        <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share
      </button>
    </div>
  </div>`;
}

async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    posts = posts.filter(p => p.id !== id);
    await DB.set('mingle_posts', posts);
    renderFeed();
    const active = document.querySelector('.view.active');
    if (active && active.id === 'view-profile') renderProfile();
    toast('Post deleted.');
}

async function like(id) {
    const p = posts.find(p => p.id === id);
    if (!p) return;
    p.liked = !p.liked; p.likes += p.liked ? 1 : -1;
    await DB.set('mingle_posts', posts);
    renderFeed();
    const active = document.querySelector('.view.active');
    if (active && active.id === 'view-profile') renderProfile();
}

async function submitPost() {
    const ta = document.getElementById('compose-text');
    const body = ta.value.trim();
    if (!body) { toast('Write something first!'); return; }
    posts.unshift({ id:'p'+Date.now(), username:user.username, name:user.first+' '+user.last, color:user.color, body, time:Date.now(), likes:0, liked:false });
    await DB.set('mingle_posts', posts);
    ta.value = '';
    renderFeed();
    toast('Posted!');
}

function showView(v) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + v).classList.add('active');
    document.getElementById('sl-home').classList.toggle('active',    v === 'feed');
    document.getElementById('sl-profile').classList.toggle('active', v === 'profile');
    if (v === 'profile') renderProfile();
}

async function logout() {
    await DB.remove('mingle_session');
    window.location.href = 'index.html';
}

function timeAgo(ts) {
    const s = Math.floor((Date.now()-ts)/1000);
    if (s<60) return 'just now';
    if (s<3600) return Math.floor(s/60)+'m ago';
    if (s<86400) return Math.floor(s/3600)+'h ago';
    return Math.floor(s/86400)+'d ago';
}
function esc(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let toastTimer;
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}