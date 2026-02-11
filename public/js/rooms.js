const session = JSON.parse(localStorage.getItem("session") || "null");
if (!session?.username) window.location.href = "/views/login.html";

document.getElementById("who").textContent = session.username;

document.getElementById("btnJoin").addEventListener("click", () => {
    const room = document.getElementById("room").value;
    localStorage.setItem("room", room);
    window.location.href = "/views/chat.html";
});

document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.removeItem("session");
    localStorage.removeItem("room");
    window.location.href = "/views/login.html";
});
