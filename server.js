// server.js
require("dotenv").config();

const path = require("path");
const http = require("http");

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const { Server } = require("socket.io");

const User = require("./models/User");
const GroupMessage = require("./models/GroupMessage");
const PrivateMessage = require("./models/PrivateMessage");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// serve /public (js, css, images)
app.use(express.static(path.join(__dirname, "public")));

// optional: serve /views directly (so you can go /views/login.html)
app.use("/views", express.static(path.join(__dirname, "views")));

// ===== MongoDB Connection =====
async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ Missing MONGODB_URI in .env");
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
        process.exit(1);
    }
}
connectDB();

// ===== Simple page routes (optional) =====
app.get("/", (req, res) => {
    // default page
    res.sendFile(path.join(__dirname, "views", "login.html"));
    });

    // ===== Helpers =====
    function nowString() {
    return new Date().toLocaleString();
    }

    // ===== API Routes =====

    // Health check
    app.get("/api/health", (req, res) => res.json({ ok: true }));

    // Rooms (you can also hardcode these on the frontend)
    const ROOMS = ["devops", "cloud computing", "covid19", "sports", "nodeJS"];
    app.get("/api/rooms", (req, res) => res.json({ ok: true, rooms: ROOMS }));

    // Signup: create user in MongoDB (username must be unique)
    app.post("/api/signup", async (req, res) => {
    try {
        const { username, firstname, lastname, password } = req.body || {};

        if (!username || !firstname || !lastname || !password) {
        return res.status(400).json({ ok: false, message: "All fields are required." });
        }

        const u = String(username).trim();
        const fn = String(firstname).trim();
        const ln = String(lastname).trim();

        // Check existing username
        const exists = await User.findOne({ username: u }).lean();
        if (exists) {
        return res.status(409).json({ ok: false, message: "Username already exists." });
        }

        // Hash password
        const saltRounds = 10;
        const hashed = await bcrypt.hash(password, saltRounds);

        const user = await User.create({
        username: u,
        firstname: fn,
        lastname: ln,
        password: hashed,
        createon: nowString(),
        });

        return res.json({
        ok: true,
        user: { username: user.username, firstname: user.firstname, lastname: user.lastname },
        });
    } catch (err) {
        // Handle duplicate key error from MongoDB (unique index)
        if (err && err.code === 11000) {
        return res.status(409).json({ ok: false, message: "Username already exists." });
        }
        console.error("Signup error:", err);
        return res.status(500).json({ ok: false, message: "Server error (signup)." });
    }
});

// Login: validate username/password and return user basic data
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
        return res.status(400).json({ ok: false, message: "Username and password are required." });
        }

        const u = String(username).trim();
        const user = await User.findOne({ username: u });
        if (!user) {
        return res.status(401).json({ ok: false, message: "Invalid username or password." });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
        return res.status(401).json({ ok: false, message: "Invalid username or password." });
        }

        return res.json({ ok: true, user: { username: user.username } });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ ok: false, message: "Server error (login)." });
    }
});

// Get users list (for private chat dropdown)
app.get("/api/users", async (req, res) => {
    try {
        // return only public fields
        const users = await User.find({}, { _id: 0, username: 1, firstname: 1, lastname: 1 })
        .sort({ username: 1 })
        .lean();
        return res.json({ ok: true, users });
    } catch (err) {
        console.error("Users list error:", err);
        return res.status(500).json({ ok: false, message: "Server error (users)." });
    }
});

// Load group chat history for a room
app.get("/api/messages/:room", async (req, res) => {
    try {
        const room = String(req.params.room || "").trim();
        if (!room) return res.status(400).json({ ok: false, message: "Room is required." });

        const messages = await GroupMessage.find({ room })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();

        return res.json({ ok: true, room, messages });
    } catch (err) {
        console.error("Room messages error:", err);
        return res.status(500).json({ ok: false, message: "Server error (messages)." });
    }
});

// Load private chat history between two users (optional but useful)
app.get("/api/private/:u1/:u2", async (req, res) => {
    try {
        const u1 = String(req.params.u1 || "").trim();
        const u2 = String(req.params.u2 || "").trim();
        if (!u1 || !u2) return res.status(400).json({ ok: false, message: "Two users required." });

        const messages = await PrivateMessage.find({
        $or: [
            { from_user: u1, to_user: u2 },
            { from_user: u2, to_user: u1 },
        ],
        })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();

        return res.json({ ok: true, users: [u1, u2], messages });
    } catch (err) {
        console.error("Private history error:", err);
        return res.status(500).json({ ok: false, message: "Server error (private history)." });
    }
});

// ===== Socket.io (rooms + private) =====

// Map usernames to socket ids (for 1-to-1)
const userToSocketId = new Map();

io.on("connection", (socket) => {
    console.log("🔌 socket connected:", socket.id);

    // Client should send this once after connect:
    // socket.emit("register_user", { username })
    socket.on("register_user", ({ username }) => {
        const u = String(username || "").trim();
        if (!u) return;
        userToSocketId.set(u, socket.id);
        socket.data.username = u;
    });

    // Join room
    socket.on("join_room", ({ username, room }) => {
        const u = String(username || "").trim();
        const r = String(room || "").trim();
        if (!u || !r) return;

        socket.join(r);
        socket.data.username = u;
        socket.data.room = r;

        // optional broadcast
        socket.to(r).emit("system", { message: `${u} joined ${r}`, date_sent: nowString() });
    });

    // Leave room
    socket.on("leave_room", ({ username, room }) => {
        const u = String(username || "").trim();
        const r = String(room || "").trim();
        if (!u || !r) return;

        socket.leave(r);
        socket.to(r).emit("system", { message: `${u} left ${r}`, date_sent: nowString() });
    });

    // Group message (save to MongoDB then broadcast to room)
    socket.on("group_message", async ({ from_user, room, message }) => {
        try {
        const u = String(from_user || "").trim();
        const r = String(room || "").trim();
        const m = String(message || "").trim();
        if (!u || !r || !m) return;

        const doc = await GroupMessage.create({
            from_user: u,
            room: r,
            message: m,
            date_sent: nowString(),
        });

        io.to(r).emit("group_message", {
            from_user: doc.from_user,
            room: doc.room,
            message: doc.message,
            date_sent: doc.date_sent,
        });
        } catch (err) {
        console.error("group_message error:", err);
        }
    });

    // Private message (save to MongoDB then send to receiver + sender)
    socket.on("private_message", async ({ from_user, to_user, message }) => {
        try {
        const from = String(from_user || "").trim();
        const to = String(to_user || "").trim();
        const m = String(message || "").trim();
        if (!from || !to || !m) return;

        const doc = await PrivateMessage.create({
            from_user: from,
            to_user: to,
            message: m,
            date_sent: nowString(),
        });

        const payload = {
            from_user: doc.from_user,
            to_user: doc.to_user,
            message: doc.message,
            date_sent: doc.date_sent,
        };

        const toSocket = userToSocketId.get(to);
        const fromSocket = userToSocketId.get(from);

        if (toSocket) io.to(toSocket).emit("private_message", payload);
        if (fromSocket) io.to(fromSocket).emit("private_message", payload);
        } catch (err) {
        console.error("private_message error:", err);
        }
    });

    // Typing indicators (private)
    socket.on("typing_private", ({ from_user, to_user }) => {
        const from = String(from_user || "").trim();
        const to = String(to_user || "").trim();
        const toSocket = userToSocketId.get(to);
        if (toSocket) io.to(toSocket).emit("typing_private", { from_user: from });
    });

    socket.on("stop_typing_private", ({ from_user, to_user }) => {
        const from = String(from_user || "").trim();
        const to = String(to_user || "").trim();
        const toSocket = userToSocketId.get(to);
        if (toSocket) io.to(toSocket).emit("stop_typing_private", { from_user: from });
    });

    socket.on("disconnect", () => {
        const u = socket.data.username;
        if (u && userToSocketId.get(u) === socket.id) userToSocketId.delete(u);
        console.log("❌ socket disconnected:", socket.id);
    });
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
