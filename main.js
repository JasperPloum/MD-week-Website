// mingle.js (volledig Firebase + Firestore + Auth)
// Zorg dat dit script als type="module" wordt ingeladen in je HTML.

// ── Firebase imports ──────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── Firebase config ───────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyD4wHOK7kuKajerzWbAtkq_OA9WxBAr_-4",
    authDomain: "mingle-cc989.firebaseapp.com",
    projectId: "mingle-cc989",
    storageBucket: "mingle-cc989.firebasestorage.app",
    messagingSenderId: "940121174961",
    appId: "1:940121174961:web:a9d748d7ce892176dcc390"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── State ─────────────────────────────────────────────────────────────────
let user  = null;   // ingelogde user (uit Firestore)
let posts = [];     // huidige feed

const FAKE_USERS = [
    { first: "Alex", last: "Rivera", username: "alexr",    color: "#5b6ef5" },
    { first: "Mia",  last: "Chen",   username: "mia_chen", color: "#4caf86" },
    { first: "Sam",  last: "Torres", username: "samT",     color: "#e8c44a" },
];

const DEFAULT_POSTS = [
    {
        username: "alexr",
        name: "Alex Rivera",
        color: "#5b6ef5",
        body: "Hey ik heb zin om een keertje te gaan wandelen in het bos maar ik kan niemand vinden om mee te gaan, is er iemand die mee wilt gaan? laat het me dan effe weten!",
        likes: 14,
        likedBy: []
    },
    {
        username: "mia_chen",
        name: "Mia Chen",
        color: "#4caf86",
        body: "Working on a new design system — clean grids, fewer components, more clarity. Less is genuinely more.",
        likes: 31,
        likedBy: []
    },
    {
        username: "samT",
        name: "Sam Torres",
        color: "#e8c44a",
        body: "Hot take: the best productivity tool is a long walk with no phone. Change my mind.",
        likes: 52,
        likedBy: []
    }
];

let toastTimer;

// ── Boot: check auth + load user + start feed ────────────────────────────
onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
        // geen sessie → terug naar login
        window.location.replace("index.html");
        return;
    }

    try {
        // User‑document ophalen op basis van uid
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap    = await getDoc(userRef);

        if (!snap.exists()) {
            // Als er geen user‑document is, stuur terug naar login/registratie
            console.warn("User document not found for uid:", firebaseUser.uid);
            window.location.replace("index.html");
            return;
        }

        user = { id: snap.id, ...snap.data() };

        renderNav();
        renderSuggestions();

        await ensureSeedPosts();
        listenToFeed();
    } catch (err) {
        console.error(err);
        toast("Er ging iets mis bij het laden van je profiel.");
    }
});

// ── Seed: standaard posts in Firestore als er nog geen zijn ──────────────
async function ensureSeedPosts() {
    const q = query(collection(db, "posts"), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const now = Date.now();
    const offsets = [-2 * 60 * 60 * 1000, -5 * 60 * 60 * 1000, -11 * 60 * 60 * 1000];

    for (let i = 0; i < DEFAULT_POSTS.length; i++) {
        const base = DEFAULT_POSTS[i];
        await addDoc(collection(db, "posts"), {
            ...base,
            time: new Date(now + offsets[i]),
        });
    }
}

// ── Realtime feed listener ────────────────────────────────────────────────
function listenToFeed() {
    const q = query(collection(db, "posts"), orderBy("time", "desc"));

    onSnapshot(q, (snapshot) => {
        posts = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data
            };
        });
        renderFeed();
        const active = document.querySelector(".view.active");
        if (active && active.id === "view-profile") renderProfile();
    });
}

// ── UI rendering ─────────────────────────────────────────────────────────
function renderNav() {
    const av = document.getElementById("nav-avatar");
    av.textContent = user.first[0].toUpperCase();
    av.style.background = user.color;

    const ca = document.getElementById("compose-av");
    ca.textContent = user.first[0].toUpperCase();
    ca.style.background = user.color;
}

function renderSuggestions() {
    document.getElementById("suggestions").innerHTML = FAKE_USERS.map((u, i) => `
    <div class="suggest-row">
      <div class="sug-av" style="background:${u.color}">${u.first[0]}</div>
      <div class="sug-info">
        <div class="sug-name">${u.first} ${u.last}</div>
        <div class="sug-handle">@${u.username}</div>
      </div>
      <button class="btn-sug" id="sug${i}" onclick="toggleFollow(${i})">Volgen</button>
    </div>
  `).join("");
}

function renderFeed() {
    document.getElementById("feed-list").innerHTML =
        posts.map(postHTML).join("");
}

function renderProfile() {
    document.getElementById("p-av").textContent = user.first[0].toUpperCase();
    document.getElementById("p-av").style.background = user.color;
    document.getElementById("p-name").textContent = user.first + " " + user.last;
    document.getElementById("p-handle").textContent = "@" + user.username;
    document.getElementById("p-joined").textContent = user.joined
        ? new Date(user.joined).toLocaleDateString()
        : "Recently";

    const mine = posts
        .filter(p => p.username === user.username)
        .sort((a, b) => b.time?.toMillis?.() ?? b.time - (a.time?.toMillis?.() ?? a.time));

    document.getElementById("p-posts").textContent = mine.length;

    const list  = document.getElementById("p-posts-list");
    const empty = document.getElementById("p-empty");

    if (!mine.length) {
        list.innerHTML = "";
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";
    list.innerHTML = mine.map(postHTML).join("");
}

function postHTML(p) {
    const isOwner = user && p.username === user.username;
    const likedBy = p.likedBy || [];
    const liked   = likedBy.includes(user.username);

    const deleteBtn = isOwner ? `
    <button class="post-action post-delete" onclick="deletePost('${p.id}')" title="Delete post">
      <svg viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/>
        <path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
    </button>` : "";

    const ts = p.time?.toMillis ? p.time.toMillis() : p.time;

    return `
    <div class="post" id="post-${p.id}">
      <div class="post-header">
        <div class="post-avatar" style="background:${p.color}">${p.name[0]}</div>
        <div class="post-meta">
          <div class="post-author">
            ${p.name}
            <span style="color:var(--muted);font-weight:400;font-size:12px">@${p.username}</span>
          </div>
          <div class="post-time">${timeAgo(ts)}</div>
        </div>
        ${deleteBtn}
      </div>
      <div class="post-body">${esc(p.body)}</div>
      <div class="post-actions">
        <button class="post-action ${liked ? "liked" : ""}" onclick="like('${p.id}')">
          <svg viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>${p.likes ?? 0}
        </button>
        <button class="post-action" onclick="toast('Replies coming soon!')">
          <svg viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>Reageren
        </button>
        <button class="post-action" onclick="toast('Link copied!')">
          <svg viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>Delen
        </button>
      </div>
    </div>
  `;
}

// ── Actions ───────────────────────────────────────────────────────────────
window.toggleFollow = function(i) {
    const btn = document.getElementById("sug" + i);
    const f = btn.classList.toggle("following");
    btn.textContent = f ? "Following" : "Follow";
    toast(f ? `Following @${FAKE_USERS[i].username}` : `Unfollowed @${FAKE_USERS[i].username}`);
};

window.submitPost = async function () {
    const ta = document.getElementById("compose-text");
    const body = ta.value.trim();
    if (!body) {
        toast("Write something first!");
        return;
    }

    try {
        await addDoc(collection(db, "posts"), {
            username: user.username,
            name: user.first + " " + user.last,
            color: user.color,
            body,
            time: serverTimestamp(),
            likes: 0,
            likedBy: []
        });

        ta.value = "";
        toast("Posted!");
    } catch (err) {
        console.error(err);
        toast("Posten is mislukt.");
    }
};

window.like = async function (id) {
    try {
        const ref = doc(db, "posts", id);
        const p   = posts.find(p => p.id === id);
        if (!p) return;

        const likedBy = p.likedBy || [];
        const already = likedBy.includes(user.username);

        await updateDoc(ref, {
            likedBy: already ? arrayRemove(user.username) : arrayUnion(user.username),
            likes: already ? (p.likes || 0) - 1 : (p.likes || 0) + 1
        });
    } catch (err) {
        console.error(err);
        toast("Like aanpassen mislukt.");
    }
};

window.deletePost = async function (id) {
    if (!confirm("Delete this post?")) return;
    try {
        await deleteDoc(doc(db, "posts", id));
        toast("Post deleted.");
    } catch (err) {
        console.error(err);
        toast("Verwijderen mislukt.");
    }
};

window.showView = function (v) {
    document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
    document.getElementById("view-" + v).classList.add("active");
    document.getElementById("sl-home").classList.toggle("active",    v === "feed");
    document.getElementById("sl-profile").classList.toggle("active", v === "profile");
    if (v === "profile") renderProfile();
};

window.logout = async function () {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (err) {
        console.error(err);
        toast("Uitloggen mislukt.");
    }
};

// ── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(ts) {
    if (!ts) return "";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return "nu net";
    if (s < 3600)  return Math.floor(s / 60) + "m geleden";
    if (s < 86400) return Math.floor(s / 3600) + "h geleden";
    return Math.floor(s / 86400) + "d geleden";
}

function esc(t) {
    return String(t)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

window.toast = function (msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
};
