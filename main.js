// main.js — Mingle app (activity feed + follow + messaging)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, getDoc, getDocs, setDoc,
    collection, addDoc, query, orderBy, where,
    onSnapshot, updateDoc, deleteDoc,
    serverTimestamp, arrayUnion, arrayRemove, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signOut
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
let user         = null;   // current user from Firestore
let activities   = [];     // feed
let conversations= [];     // list of DM conversations
let activeConvId = null;   // open conversation id
let msgUnsub     = null;   // unsubscribe for message listener
let convUnsub    = null;   // unsubscribe for conversations listener
let toastTimer;
let unreadCount  = 0;

// ── Boot ──────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
        window.location.replace("index.html");
        return;
    }
    try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (!snap.exists()) {
            window.location.replace("index.html");
            return;
        }
        user = { id: snap.id, ...snap.data() };
        renderNav();
        listenToFeed();
        listenToConversations();
    } catch (err) {
        console.error(err);
        toast("Er ging iets mis bij het laden van je profiel.");
    }
});

// ── Feed ──────────────────────────────────────────────────────────────────
function listenToFeed() {
    const q = query(collection(db, "posts"), orderBy("time", "desc"));
    onSnapshot(q, (snap) => {
        activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFeed();
        const active = document.querySelector(".view.active");
        if (active?.id === "view-profile") renderProfile();
    });
}

function renderFeed() {
    const list = document.getElementById("feed-list");
    if (!activities.length) {
        list.innerHTML = `<div class="empty">Nog geen activiteiten. Maak er een aan!</div>`;
        return;
    }
    list.innerHTML = activities.map(activityHTML).join("");
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

function updateUnreadBadge() {
    const badge = document.getElementById("msg-badge");
    const sidebarBadge = document.getElementById("sidebar-msg-badge");
    if (unreadCount > 0) {
        if (badge) { badge.textContent = unreadCount; badge.style.display = "flex"; }
        if (sidebarBadge) { sidebarBadge.textContent = unreadCount; sidebarBadge.style.display = "inline-block"; }
    } else {
        if (badge) badge.style.display = "none";
        if (sidebarBadge) sidebarBadge.style.display = "none";
    }
}

// ── Activity card HTML ────────────────────────────────────────────────────
function activityHTML(a) {
    const isOwner  = user && a.username === user.username;
    const joinedBy = a.joinedBy || [];
    const hasJoined = joinedBy.includes(user.username);

    let dateObj = null;
    if (a.date) dateObj = new Date(a.date + "T00:00:00");
    const dayNum   = dateObj ? dateObj.getDate() : "?";
    const monthStr = dateObj ? dateObj.toLocaleDateString("nl-NL", { month: "short" }) : "";
    const joinCount = joinedBy.length;

    const deleteBtn = isOwner ? `
        <button class="activity-delete" onclick="deleteActivity('${a.id}')" title="Verwijder">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : "";

    const ts = a.time?.toMillis ? a.time.toMillis() : a.time;

    return `
    <div class="activity-card" id="act-${a.id}">
        <div class="activity-author-row">
            <div class="activity-author-av" style="background:${a.color}"
                onclick="openUserModal('${a.username}')">${a.name[0]}</div>
            <span class="activity-author-name"
                onclick="openUserModal('${a.username}')">${a.name} · @${a.username} · ${timeAgo(ts)}</span>
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
                ${hasJoined ? "Aangemeld" : "Join"}
            </button>
        </div>
    </div>`;
}

// ── Profile view ──────────────────────────────────────────────────────────
function renderProfile() {
    document.getElementById("p-av").textContent    = user.first[0].toUpperCase();
    document.getElementById("p-av").style.background = user.color;
    document.getElementById("p-name").textContent   = user.first + " " + user.last;
    document.getElementById("p-handle").textContent = "@" + user.username;
    document.getElementById("p-joined").textContent = user.joined
        ? new Date(user.joined).toLocaleDateString() : "Recently";

    // Follower / following counts from user doc
    const followers = (user.followers || []).length;
    const following = (user.following || []).length;
    document.getElementById("p-followers").textContent = followers;
    document.getElementById("p-following").textContent = following;

    const mine = activities.filter(a => a.username === user.username);
    document.getElementById("p-posts").textContent = mine.length;

    const list  = document.getElementById("p-posts-list");
    const empty = document.getElementById("p-empty");
    if (!mine.length) { list.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";
    list.innerHTML = mine.map(activityHTML).join("");
}

// ── User modal ────────────────────────────────────────────────────────────
window.openUserModal = async function (username) {
    // Don't open modal for own profile — go to profile view instead
    if (username === user.username) {
        showView("profile");
        return;
    }

    // Fetch the user from Firestore by username
    const q = query(collection(db, "users"), where("username", "==", username));
    const snap = await getDocs(q);
    if (snap.empty) { toast("Gebruiker niet gevonden."); return; }
    const targetUser = { id: snap.docs[0].id, ...snap.docs[0].data() };

    // Check if we follow them (stored on our own user doc)
    const mySnap = await getDoc(doc(db, "users", user.id));
    const myData = mySnap.data();
    const following = myData.following || [];
    const isFollowing = following.includes(targetUser.id);

    // Count their posts
    const postSnap = await getDocs(query(collection(db, "posts"), where("username", "==", username)));
    const postCount = postSnap.size;
    const theirFollowers = (targetUser.followers || []).length;
    const theirFollowing = (targetUser.following || []).length;

    // Build modal
    const overlay = document.getElementById("modal-overlay");
    document.getElementById("modal-av").textContent     = targetUser.first[0].toUpperCase();
    document.getElementById("modal-av").style.background = targetUser.color;
    document.getElementById("modal-name").textContent   = targetUser.first + " " + targetUser.last;
    document.getElementById("modal-handle").textContent = "@" + targetUser.username;
    document.getElementById("modal-posts").textContent  = postCount;
    document.getElementById("modal-followers").textContent = theirFollowers;
    document.getElementById("modal-following").textContent = theirFollowing;

    const followBtn = document.getElementById("modal-follow-btn");
    followBtn.textContent = isFollowing ? "Volgend" : "Volgen";
    followBtn.className   = "btn-follow" + (isFollowing ? " following" : "");
    followBtn.onclick     = () => toggleFollow(targetUser, followBtn);

    const msgBtn = document.getElementById("modal-msg-btn");
    msgBtn.onclick = () => {
        closeUserModal();
        openConversation(targetUser);
    };

    overlay.classList.remove("hidden");
};

window.closeUserModal = function () {
    document.getElementById("modal-overlay").classList.add("hidden");
};

// Close on backdrop click
document.getElementById("modal-overlay")?.addEventListener("click", function (e) {
    if (e.target === this) closeUserModal();
});

// ── Follow / Unfollow ─────────────────────────────────────────────────────
async function toggleFollow(targetUser, btn) {
    const myRef     = doc(db, "users", user.id);
    const theirRef  = doc(db, "users", targetUser.id);
    const isFollowing = btn.classList.contains("following");

    try {
        if (isFollowing) {
            await updateDoc(myRef,    { following: arrayRemove(targetUser.id) });
            await updateDoc(theirRef, { followers: arrayRemove(user.id) });
            btn.textContent  = "Volgen";
            btn.classList.remove("following");
            toast(`Je volgt @${targetUser.username} niet meer.`);
        } else {
            await updateDoc(myRef,    { following: arrayUnion(targetUser.id) });
            await updateDoc(theirRef, { followers: arrayUnion(user.id) });
            btn.textContent  = "Volgend";
            btn.classList.add("following");
            toast(`Je volgt nu @${targetUser.username}!`);
        }
        // Refresh local user state for profile stats
        const mySnap = await getDoc(myRef);
        user = { id: user.id, ...mySnap.data() };
        if (document.getElementById("view-profile").classList.contains("active")) {
            renderProfile();
        }
    } catch (err) {
        console.error(err);
        toast("Actie mislukt.");
    }
}

// ── Conversations ─────────────────────────────────────────────────────────
function listenToConversations() {
    // Conversations where current user is a participant
    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", user.id),
        orderBy("lastTime", "desc")
    );

    convUnsub = onSnapshot(q, (snap) => {
        conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderConvList();
        // Count unread
        unreadCount = conversations.filter(c => {
            const unread = c.unread || {};
            return (unread[user.id] || 0) > 0;
        }).length;
        updateUnreadBadge();
    });
}

function renderConvList() {
    const el = document.getElementById("conv-items");
    if (!conversations.length) {
        el.innerHTML = `<div class="conv-empty">Nog geen berichten.<br>Klik op iemand in de feed om te starten.</div>`;
        return;
    }
    el.innerHTML = conversations.map(c => {
        const otherId   = c.participants.find(p => p !== user.id);
        const otherInfo = c.participantInfo?.[otherId] || {};
        const unread    = (c.unread?.[user.id] || 0) > 0;
        const isActive  = c.id === activeConvId;
        return `
        <div class="conv-item ${isActive ? "active" : ""}" onclick="selectConversation('${c.id}')">
            <div class="conv-av" style="background:${otherInfo.color || "#5b6ef5"}">${(otherInfo.name || "?")[0]}</div>
            <div class="conv-info">
                <div class="conv-name">${esc(otherInfo.name || "Onbekend")}</div>
                <div class="conv-preview">${esc(c.lastMessage || "Geen berichten nog")}</div>
            </div>
            ${unread ? `<div class="conv-unread"></div>` : ""}
        </div>`;
    }).join("");
}

// Open or create a conversation with a target user
async function openConversation(targetUser) {
    showView("messages");

    // Check if conversation already exists
    const existing = conversations.find(c => c.participants.includes(targetUser.id));
    if (existing) {
        selectConversation(existing.id);
        return;
    }

    // Create new conversation document
    try {
        const convRef = await addDoc(collection(db, "conversations"), {
            participants: [user.id, targetUser.id],
            participantInfo: {
                [user.id]: { name: user.first + " " + user.last, color: user.color, username: user.username },
                [targetUser.id]: { name: targetUser.first + " " + targetUser.last, color: targetUser.color, username: targetUser.username }
            },
            lastMessage: "",
            lastTime: serverTimestamp(),
            unread: { [user.id]: 0, [targetUser.id]: 0 }
        });
        selectConversation(convRef.id);
    } catch (err) {
        console.error(err);
        toast("Kon geen gesprek starten.");
    }
}

window.selectConversation = function (convId) {
    activeConvId = convId;
    renderConvList();

    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    const otherId   = conv.participants.find(p => p !== user.id);
    const otherInfo = conv.participantInfo?.[otherId] || {};

    // Update chat header
    const headerAv = document.getElementById("chat-header-av");
    headerAv.textContent    = (otherInfo.name || "?")[0];
    headerAv.style.background = otherInfo.color || "#5b6ef5";
    document.getElementById("chat-header-name").textContent   = otherInfo.name || "Onbekend";
    document.getElementById("chat-header-handle").textContent = "@" + (otherInfo.username || "");

    // Show input row
    document.getElementById("chat-input-row").style.display = "flex";
    document.getElementById("chat-placeholder").style.display = "none";

    // Mark as read
    updateDoc(doc(db, "conversations", convId), {
        [`unread.${user.id}`]: 0
    }).catch(() => {});

    // Listen to messages
    if (msgUnsub) msgUnsub();
    const q = query(
        collection(db, "conversations", convId, "messages"),
        orderBy("time", "asc")
    );
    msgUnsub = onSnapshot(q, (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderMessages(msgs);
    });
};

function renderMessages(msgs) {
    const el = document.getElementById("chat-messages");
    if (!msgs.length) {
        el.innerHTML = `<div style="margin:auto;text-align:center;font-size:13px;color:rgba(255,255,255,0.3)">Stuur het eerste bericht!</div>`;
        return;
    }
    el.innerHTML = msgs.map(m => {
        const mine = m.senderId === user.id;
        const ts   = m.time?.toMillis ? m.time.toMillis() : (m.time || Date.now());
        return `
        <div class="msg-row">
            <div class="msg-bubble ${mine ? "mine" : "theirs"}">${esc(m.text)}</div>
            <span class="msg-time ${mine ? "" : "theirs"}">${timeStr(ts)}</span>
        </div>`;
    }).join("");
    el.scrollTop = el.scrollHeight;
}

window.sendMessage = async function () {
    const input = document.getElementById("chat-input");
    const text  = input.value.trim();
    if (!text || !activeConvId) return;

    input.value = "";

    const conv    = conversations.find(c => c.id === activeConvId);
    const otherId = conv?.participants.find(p => p !== user.id);

    try {
        await addDoc(collection(db, "conversations", activeConvId, "messages"), {
            senderId: user.id,
            text,
            time: serverTimestamp()
        });
        await updateDoc(doc(db, "conversations", activeConvId), {
            lastMessage: text,
            lastTime: serverTimestamp(),
            [`unread.${otherId}`]: (conv?.unread?.[otherId] || 0) + 1
        });
    } catch (err) {
        console.error(err);
        toast("Bericht versturen mislukt.");
    }
};

// Enter key to send
document.getElementById("chat-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── Activity actions ──────────────────────────────────────────────────────
window.submitPost = async function () {
    const location    = document.getElementById("compose-location").value.trim();
    const date        = document.getElementById("compose-date").value;
    const category    = document.getElementById("compose-category").value;
    const description = document.getElementById("compose-description").value.trim();

    if (!location) { toast("Vul een locatie in!"); return; }
    if (!date)     { toast("Kies een datum!");      return; }

    try {
        await addDoc(collection(db, "posts"), {
            username: user.username,
            name:     user.first + " " + user.last,
            color:    user.color,
            location, date, category: category || "Overig", description,
            time:     serverTimestamp(),
            joinedBy: []
        });
        document.getElementById("compose-location").value    = "";
        document.getElementById("compose-date").value        = "";
        document.getElementById("compose-description").value = "";
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
            joinedBy: hasJoined ? arrayRemove(user.username) : arrayUnion(user.username)
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

// ── View switching ────────────────────────────────────────────────────────
window.showView = function (v) {
    document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
    document.getElementById("view-" + v).classList.add("active");
    document.getElementById("sl-home").classList.toggle("active",     v === "feed");
    document.getElementById("sl-profile").classList.toggle("active",  v === "profile");
    document.getElementById("sl-messages").classList.toggle("active", v === "messages");
    if (v === "profile") renderProfile();
    if (v === "messages") renderConvList();
};

window.logout = async function () {
    try {
        if (msgUnsub)  msgUnsub();
        if (convUnsub) convUnsub();
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

function timeStr(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
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