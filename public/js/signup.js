// If already logged in, go rooms
const session = JSON.parse(localStorage.getItem("session") || "null");
if (session?.username) window.location.href = "/views/rooms.html";

document.getElementById("btnSignup").addEventListener("click", async () => {
    const msg = document.getElementById("msg");
    msg.textContent = "";

    const username = document.getElementById("username").value.trim();
    const firstname = document.getElementById("firstname").value.trim();
    const lastname = document.getElementById("lastname").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    if (!username || !firstname || !lastname || !password || !confirm) {
        msg.textContent = "All fields are required.";
        return;
    }

    if (password !== confirm) {
        msg.textContent = "Passwords do not match.";
        return;
    }

    const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, firstname, lastname, password })
    });

    const data = await res.json();
    if (!data.ok) {
        msg.textContent = data.message || "Signup failed.";
        return;
    }

    window.location.href = "/views/login.html";
});
