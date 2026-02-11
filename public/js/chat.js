const session = JSON.parse(localStorage.getItem("session") || "null");
const room = localStorage.getItem("room");

if (!session?.username) window.location.href = "/views/login.html";
if (!room) window.location.href = "/views/rooms.html";

const username = session.username;

// UI refs
const roomNameEl = document.getElementById("roomName");
const userNameEl = document.getElementById("userName");

const messagesDiv = document.getElementById("messages");
const sysDiv = document.getElementById("sys");
const textInput = document.getElementById("text");

const toUserSelect = document.getElementById("toUser");
const privateMessagesDiv = document.getElementById("privateMessages");
const privateTextInput = document.getElementById("privateText");
const typingEl = document.getElementById("typing");
const privateSysEl = document.getElementById("privateSys");

roomNameEl.textContent = room;
userNameEl.textContent = username;

// Helpers
function addGroupLine(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addPrivateLine(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    privateMessagesDiv.appendChild(div);
    privateMessagesDiv.scrollTop = privateMessagesDiv.scrollHeight;
}

async function loadRoomHistory() {
    const res = await fetch(`/api/messages/${encodeURIComponent(room)}`);
    const data = await res.json();
    if (!data.ok) return;

    messagesDiv.innerHTML = "";
    for (const m of data.messages) {
        addGroupLine(`<div><b>${m.from_user}:</b> ${m.message} <span class="text-muted" style="font-size:12px;">(${m.date_sent})</span></div>`);
    }
}

async function loadUsersForPrivate() {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!data.ok) {
        privateSysEl.textContent = data.message || "Could not load users.";
        return;
    }

    // Fill dropdown with everyone except me
    const others = (data.users || []).filter(u => u.username !== username);

    toUserSelect.innerHTML = "";
    for (const u of others) {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = u.username;
        toUserSelect.appendChild(opt);
    }

    if (others.length === 0) {
        privateSysEl.textContent = "No other users found. Create another account to test private chat.";
    } else {
        privateSysEl.textContent = "";
        await loadPrivateHistory(); // load for default selected user
    }
}

async function loadPrivateHistory() {
    const to_user = toUserSelect.value;
    if (!to_user) return;

    const res = await fetch(`/api/private/${encodeURIComponent(username)}/${encodeURIComponent(to_user)}`);
    const data = await res.json();
    if (!data.ok) return;

    privateMessagesDiv.innerHTML = "";
    for (const m of data.messages) {
        const who = m.from_user === username ? "Me" : m.from_user;
        addPrivateLine(`<div><b>${who}:</b> ${m.message} <span class="text-muted" style="font-size:12px;">(${m.date_sent})</span></div>`);
    }
}

// Socket.io
const socket = io();

socket.emit("register_user", { username });
socket.emit("join_room", { username, room });

// Group events
socket.on("system", (m) => {
    sysDiv.textContent = m.message || "";
});

socket.on("group_message", (m) => {
    if (m.room !== room) return;
    addGroupLine(`<div><b>${m.from_user}:</b> ${m.message} <span class="text-muted" style="font-size:12px;">(${m.date_sent})</span></div>`);
});

// Private events
socket.on("private_message", (m) => {
    // show only messages that involve me and the currently selected person
    const selected = toUserSelect.value;
    const involvesSelected =
        (m.from_user === username && m.to_user === selected) ||
        (m.from_user === selected && m.to_user === username);

    if (!involvesSelected) return;

    const who = m.from_user === username ? "Me" : m.from_user;
    addPrivateLine(`<div><b>${who}:</b> ${m.message} <span class="text-muted" style="font-size:12px;">(${m.date_sent})</span></div>`);
});

// Typing indicator
let typingTimeout = null;

socket.on("typing_private", ({ from_user }) => {
    const selected = toUserSelect.value;
    if (from_user !== selected) return;
    typingEl.textContent = `${from_user} is typing...`;
});

socket.on("stop_typing_private", ({ from_user }) => {
    const selected = toUserSelect.value;
    if (from_user !== selected) return;
    typingEl.textContent = "";
});

// Group send
document.getElementById("btnSend").addEventListener("click", () => {
    const message = textInput.value.trim();
    if (!message) return;

    socket.emit("group_message", { from_user: username, room, message });
    textInput.value = "";
    textInput.focus();
});

textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnSend").click();
});

// Private send
document.getElementById("btnSendPrivate").addEventListener("click", () => {
    const to_user = toUserSelect.value;
    const message = privateTextInput.value.trim();
    if (!to_user || !message) return;

    socket.emit("private_message", { from_user: username, to_user, message });
    privateTextInput.value = "";
    privateTextInput.focus();

    // stop typing immediately after send
    socket.emit("stop_typing_private", { from_user: username, to_user });
    typingEl.textContent = "";
});

// Private typing emit
privateTextInput.addEventListener("input", () => {
    const to_user = toUserSelect.value;
    if (!to_user) return;

    socket.emit("typing_private", { from_user: username, to_user });

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("stop_typing_private", { from_user: username, to_user });
    }, 700);
});

privateTextInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnSendPrivate").click();
});

// When user changes private "to user", reload history & clear typing text
toUserSelect.addEventListener("change", async () => {
    typingEl.textContent = "";
    await loadPrivateHistory();
});

// Leave + logout
document.getElementById("btnLeave").addEventListener("click", () => {
    socket.emit("leave_room", { username, room });
    window.location.href = "/views/rooms.html";
});

document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.removeItem("session");
    localStorage.removeItem("room");
    window.location.href = "/views/login.html";
});

// Initial loads
loadRoomHistory();
loadUsersForPrivate();
