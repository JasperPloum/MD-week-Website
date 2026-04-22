// main.js (Firebase + Firestore + Auth — Activity feed)
// Load as type="module" in your HTML.

// ── Firebase imports ──────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    orderBy,
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
let user       = null;
let activities = [];
let toastTimer;

// Activity category options
const CATEGORIES = [
    "Bioscoop","Sport","Wandelen","Eten & Drinken",
    "Muziek","Gaming","Reizen","Overig"
];

// ── Boot ──────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
        window.location.replace("index.html");
        return;
    }

    try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap    = await getDoc(userRef);

        if (!snap.exists()) {
            console.warn("No user document for uid:", firebaseUser.uid);
            window.location.replace("index.html");
            return;
        }

        user = { id: snap.id, ...snap.data() };

        renderNav();
        listenToFeed();
    } catch (err) {
        console.error(err);
        toast("Er ging iets mis bij het laden van je profiel.");
    }
});

// ── Realtime feed listener ────────────────────────────────────────────────
function listenToFeed() {
    const q = query(collection(db, "posts"), orderBy("time", "desc"));

    onSnapshot(q, (snapshot) => {
        activities = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFeed();
        const active = document.querySelector(".view.active");
        if (active && active.id === "view-profile") renderProfile();
    });
}

// ── Nav ───────────────────────────────────────────────────────────────────
function renderNav() {
    const av = document.getElementById("nav-avatar");
    av.textContent = user.first[0].toUpperCase();
    av.style.background = user.color;

    const ca = document.getElementById("compose-av");
    ca.textContent = user.first[0].toUpperCase();
    ca.style.background = user.color;
}

// ── Feed ──────────────────────────────────────────────────────────────────
function renderFeed() {
    const list = document.getElementById("feed-list");
    if (!activities.length) {
        list.innerHTML = `<div class="empty">Nog geen activiteiten. Maak er een aan!</div>`;
        return;
    }
    list.innerHTML = activities.map(activityHTML).join("");
}

// ── Profile ───────────────────────────────────────────────────────────────
function renderProfile() {
    document.getElementById("p-av").textContent = user.first[0].toUpperCase();
    document.getElementById("p-av").style.background = user.color;
    document.getElementById("p-name").textContent = user.first + " " + user.last;
    document.getElementById("p-handle").textContent = "@" + user.username;
    document.getElementById("p-joined").textContent = user.joined
        ? new Date(user.joined).toLocaleDateString()
        : "Recently";

    const mine = activities.filter(a => a.username === user.username);
    document.getElementById("p-posts").textContent = mine.length;

    const list  = document.getElementById("p-posts-list");
    const empty = document.getElementById("p-empty");

    if (!mine.length) {
        list.innerHTML = "";
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";
    list.innerHTML = mine.map(activityHTML).join("");
}

// ── Activity card HTML ────────────────────────────────────────────────────
function activityHTML(a) {
    const isOwner = user && a.username === user.username;
    const joinedBy = a.joinedBy || [];
    const hasJoined = joinedBy.includes(user.username);

    // Parse date
    let dateObj = null;
    if (a.date) {
        dateObj = new Date(a.date + "T00:00:00");
    }
    const dayNum   = dateObj ? dateObj.getDate() : "?";
    const monthStr = dateObj
        ? dateObj.toLocaleDateString("nl-NL", { month: "short" })
        : "";

    const joinCount = joinedBy.length;
    const joinLabel = hasJoined ? "Aangemeld" : "Join";

    const deleteBtn = isOwner ? `
        <button class="activity-delete" onclick="deleteActivity('${a.id}')" title="Verwijder activiteit">
            <svg viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
            </svg>
        </button>` : "";

    return `
    <div class="activity-card" id="act-${a.id}">
        <div class="activity-author-row">
            <div class="activity-author-av" style="background:${a.color}">${a.name[0]}</div>
            <span class="activity-author-name">${a.name} · ${timeAgo(a.time?.toMillis ? a.time.toMillis() : a.time)}</span>
            ${deleteBtn}
        </div>
        <div class="activity-card-top">
            <div class="activity-date-badge">
                <span class="activity-date-day">${dayNum}</span>
                <span class="activity-date-month">${monthStr}</span>
            </div>
            <div class="activity-title-area">
                <div class="activity-location">${esc(a.location)}</div>
                ${a.description ? `<div class="activity-desc">${esc(a.description)}</div>` : ""}
            </div>
            <img class="activity-mascot" src="Images/Mingle-Icon.png" alt="Mingle mascot">
        </div>
        <div class="activity-card-bottom">
            <span class="activity-tag">${esc(a.category || "Activiteit")}</span>
            <span class="activity-spacer"></span>
            ${joinCount > 0 ? `<span class="activity-joined-count">${joinCount} ${joinCount === 1 ? "persoon" : "personen"}</span>` : ""}
            <button class="btn-join ${hasJoined ? "joined" : ""}" onclick="joinActivity('${a.id}')">
                ${joinLabel}
            </button>
        </div>
    </div>`;
}

// ── Actions ───────────────────────────────────────────────────────────────
window.submitPost = async function () {
    const location    = document.getElementById("compose-location").value.trim();
    const date        = document.getElementById("compose-date").value;
    const category    = document.getElementById("compose-category").value;
    const description = document.getElementById("compose-description").value.trim();

    if (!location) { toast("Vul een locatie in!"); return; }
    if (!date)     { toast("Kies een datum!");      return; }

    try {
        await addDoc(collection(db, "posts"), {
            username:    user.username,
            name:        user.first + " " + user.last,
            color:       user.color,
            location,
            date,
            category:    category || "Overig",
            description,
            time:        serverTimestamp(),
            joinedBy:    []
        });

        document.getElementById("compose-location").value    = "";
        document.getElementById("compose-date").value        = "";
        document.getElementById("compose-description").value = "";
        document.getElementById("compose-category").value    = CATEGORIES[0];

        toast("Activiteit geplaatst!");
    } catch (err) {
        console.error(err);
        toast("Plaatsen mislukt.");
    }
};

window.joinActivity = async function (id) {
    try {
        const ref = doc(db, "posts", id);
        const a   = activities.find(a => a.id === id);
        if (!a) return;

        const joinedBy  = a.joinedBy || [];
        const hasJoined = joinedBy.includes(user.username);

        await updateDoc(ref, {
            joinedBy: hasJoined
                ? arrayRemove(user.username)
                : arrayUnion(user.username)
        });

        toast(hasJoined ? "Afgemeld." : "Je bent aangemeld!");
    } catch (err) {
        console.error(err);
        toast("Aanmelden mislukt.");
    }
};

window.deleteActivity = async function (id) {
    if (!confirm("Activiteit verwijderen?")) return;
    try {
        await deleteDoc(doc(db, "posts", id));
        toast("Activiteit verwijderd.");
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
    return String(t || "")
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