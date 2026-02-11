// If already logged in, go rooms
const session = JSON.parse(localStorage.getItem("session") || "null");
if (session?.username) window.location.href = "/views/rooms.html";

document.getElementById("btnLogin").addEventListener("click", async () => {
    document.getElementById("msg").textContent = "";

    const payload = {
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value
    };

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.ok) return (document.getElementById("msg").textContent = data.message || "Login failed.");

    localStorage.setItem("session", JSON.stringify({ username: data.user.username }));
    window.location.href = "/views/rooms.html";
});
