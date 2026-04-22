import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const auth = getAuth(app);
const db   = getFirestore(app);

// ── If already logged in, go straight to app ─────────────────────────────
onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
        window.location.replace("app.html");
    }
});

// ── UI helpers ────────────────────────────────────────────────────────────
function showMsg(text, type) {
    const el = document.getElementById("auth-msg");
    el.textContent = text;
    el.className = "msg " + type;
}

function clearMsg() {
    const el = document.getElementById("auth-msg");
    el.className = "msg";
    el.textContent = "";
}

window.togglePw = function (id) {
    const inp = document.getElementById(id);
    inp.type = inp.type === "password" ? "text" : "password";
};

// ── Tab switching ─────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        document.getElementById("panel-" + t.dataset.tab).classList.add("active");
        clearMsg();
    });
});

// ── Password strength bar ─────────────────────────────────────────────────
document.getElementById("su-pw").addEventListener("input", function () {
    let s = 0;
    if (this.value.length >= 8) s++;
    if (/[A-Z]/.test(this.value)) s++;
    if (/[0-9]/.test(this.value)) s++;
    if (/[^A-Za-z0-9]/.test(this.value)) s++;
    s = Math.min(s - 1, 3);
    const bar = document.getElementById("pw-bar");
    const colors = ["#e8654a", "#e8c44a", "#4caf86", "#2d9e6b"];
    bar.style.width  = ["25%", "50%", "75%", "100%"][Math.max(s, 0)] || "0%";
    bar.style.background = colors[Math.max(s, 0)] || colors[0];
});

// ── Avatar colors ─────────────────────────────────────────────────────────
const COLORS = ["#5b6ef5", "#4caf86", "#e8c44a", "#e5674a", "#a855f7", "#ec4899"];
function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// ── Login ─────────────────────────────────────────────────────────────────
window.handleLogin = async function () {
    const id = document.getElementById("li-id").value.trim();
    const pw = document.getElementById("li-pw").value;

    if (!id || !pw) return showMsg("Vul alle velden in.", "error");

    // Support login with username OR email
    let email = id;
    if (!id.includes("@")) {
        try {
            const q = query(collection(db, "users"), where("username", "==", id));
            const snap = await getDocs(q);
            if (snap.empty) return showMsg("Geen account gevonden met die gebruikersnaam.", "error");
            email = snap.docs[0].data().email;
        } catch (err) {
            console.error(err);
            return showMsg("Er ging iets mis. Probeer opnieuw.", "error");
        }
    }

    try {
        await signInWithEmailAndPassword(auth, email, pw);
        // onAuthStateChanged redirects to app.html
    } catch (err) {
        console.error(err);
        showMsg("Onjuist e-mailadres of wachtwoord.", "error");
    }
};

// ── Signup ────────────────────────────────────────────────────────────────
window.handleSignup = async function () {
    const first    = document.getElementById("su-first").value.trim();
    const last     = document.getElementById("su-last").value.trim();
    const username = document.getElementById("su-user").value.trim().toLowerCase();
    const email    = document.getElementById("su-email").value.trim().toLowerCase();
    const pw       = document.getElementById("su-pw").value;

    if (!first || !last || !username || !email || !pw) {
        return showMsg("Vul alle velden in.", "error");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return showMsg("Gebruikersnaam mag alleen letters, cijfers en underscores bevatten.", "error");
    }
    if (pw.length < 8) {
        return showMsg("Wachtwoord moet minimaal 8 tekens bevatten.", "error");
    }

    // Check username uniqueness
    try {
        const uq   = query(collection(db, "users"), where("username", "==", username));
        const usnap = await getDocs(uq);
        if (!usnap.empty) return showMsg("Die gebruikersnaam is al bezet.", "error");
    } catch (err) {
        console.error(err);
        return showMsg("Er ging iets mis. Probeer opnieuw.", "error");
    }

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pw);

        // Write user document — no fake/seed data, clean slate
        await setDoc(doc(db, "users", cred.user.uid), {
            first,
            last,
            username,
            email,
            color:     randomColor(),
            joined:    Date.now(),
            followers: [],
            following: []
        });

        // onAuthStateChanged will redirect to app.html
    } catch (err) {
        console.error(err);
        if (err.code === "auth/email-already-in-use") {
            showMsg("Er bestaat al een account met dit e-mailadres.", "error");
        } else {
            showMsg("Er ging iets mis. Probeer opnieuw.", "error");
        }
    }
};

// ── Google stub ───────────────────────────────────────────────────────────
window.googleStub = function () {
    showMsg("Google aanmelden vereist aanvullende configuratie.", "error");
};