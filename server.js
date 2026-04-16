const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ─── ADMIN CONFIG ────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this!
const ADMIN_TOKEN = Buffer.from(ADMIN_PASSWORD).toString('base64');

// ─── IN-MEMORY DATA STORE ────────────────────────────────────────────────────
const rooms = {};        // roomId -> { id, name, createdBy, createdAt, users: Set }
const messages = {};     // roomId -> [{ username, text, time, type }]
const userSockets = {};  // socketId -> { username, roomId }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function ensureRoom(roomId) {
  if (!messages[roomId]) messages[roomId] = [];
  if (!rooms[roomId]) {
    rooms[roomId] = {
      id: roomId,
      name: roomId,
      createdBy: 'unknown',
      createdAt: new Date().toISOString(),
      users: new Set(),
    };
  }
}

function logMessage(roomId, username, text, type = 'chat') {
  ensureRoom(roomId);
  messages[roomId].push({
    username,
    text,
    type,
    time: new Date().toISOString(),
  });
}

// ─── MULTER (file uploads) ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ─── STATIC FILES ─────────────────────────────────────────────────────────────
app.use(express.static('public'));
app.use(express.json());

// ─── ADMIN AUTH MIDDLEWARE ────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─── ADMIN API ROUTES ─────────────────────────────────────────────────────────

// Verify admin password
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Get overview stats
app.get('/admin/stats', adminAuth, (req, res) => {
  const totalMessages = Object.values(messages).reduce((a, m) => a + m.length, 0);
  const activeUsers = new Set(Object.values(userSockets).map(u => u.username)).size;

  res.json({
    totalRooms: Object.keys(rooms).length,
    totalMessages,
    activeUsers,
    activeRooms: Object.values(rooms).filter(r => r.users.size > 0).length,
  });
});

// Get all rooms
app.get('/admin/rooms', adminAuth, (req, res) => {
  const roomList = Object.values(rooms).map(r => ({
    id: r.id,
    name: r.name,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    activeUsers: r.users.size,
    messageCount: (messages[r.id] || []).length,
    currentUsers: Array.from(r.users),
  }));
  res.json(roomList);
});

// Get messages for a specific room
app.get('/admin/rooms/:roomId/messages', adminAuth, (req, res) => {
  const { roomId } = req.params;
  const roomMessages = messages[roomId] || [];
  const room = rooms[roomId];
  res.json({
    room: room ? {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      createdAt: room.createdAt,
    } : null,
    messages: roomMessages,
  });
});

// Delete a room's chat history
app.delete('/admin/rooms/:roomId/messages', adminAuth, (req, res) => {
  const { roomId } = req.params;
  messages[roomId] = [];
  res.json({ success: true });
});

// Kick all users from a room
app.post('/admin/rooms/:roomId/kick', adminAuth, (req, res) => {
  const { roomId } = req.params;
  io.to(roomId).emit('kicked', { reason: 'Admin action' });
  res.json({ success: true });
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // User creates or joins a room
  socket.on('create-room', ({ roomId, username }) => {
    ensureRoom(roomId);
    rooms[roomId].createdBy = username;
    rooms[roomId].name = roomId;
    rooms[roomId].users.add(username);
    userSockets[socket.id] = { username, roomId };

    socket.join(roomId);
    logMessage(roomId, username, `${username} created the room`, 'system');
    socket.emit('room-created', { roomId });
    io.to(roomId).emit('user-joined', { username, users: Array.from(rooms[roomId].users) });
    console.log(`[ROOM] ${username} created room: ${roomId}`);
  });

  socket.on('join-room', ({ roomId, username }) => {
    ensureRoom(roomId);
    rooms[roomId].users.add(username);
    userSockets[socket.id] = { username, roomId };

    socket.join(roomId);
    logMessage(roomId, username, `${username} joined the room`, 'system');
    io.to(roomId).emit('user-joined', { username, users: Array.from(rooms[roomId].users) });

    // Send existing messages to new joiner
    socket.emit('message-history', messages[roomId] || []);
    console.log(`[ROOM] ${username} joined room: ${roomId}`);
  });

  // Chat message
  socket.on('chat-message', ({ roomId, username, message }) => {
    logMessage(roomId, username, message, 'chat');
    io.to(roomId).emit('chat-message', {
      username,
      message,
      time: new Date().toISOString(),
    });
  });

  // File/image share
  socket.on('file-message', ({ roomId, username, url, fileName }) => {
    logMessage(roomId, username, `[File: ${fileName}] ${url}`, 'file');
    io.to(roomId).emit('file-message', { username, url, fileName });
  });

  // Typing indicator
  socket.on('typing', ({ roomId, username }) => {
    socket.to(roomId).emit('typing', { username });
  });

  socket.on('stop-typing', ({ roomId, username }) => {
    socket.to(roomId).emit('stop-typing', { username });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = userSockets[socket.id];
    if (user) {
      const { username, roomId } = user;
      if (rooms[roomId]) {
        rooms[roomId].users.delete(username);
        logMessage(roomId, username, `${username} left the room`, 'system');
        io.to(roomId).emit('user-left', { username, users: Array.from(rooms[roomId].users) });
      }
      delete userSockets[socket.id];
      console.log(`[-] ${username} disconnected from room: ${roomId}`);
    }
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 FLOW Chat running on http://localhost:${PORT}`);
  console.log(`🔐 Admin panel at http://localhost:${PORT}/admin`);
  console.log(`   Password: ${ADMIN_PASSWORD}\n`);
});
