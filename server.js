// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './public/uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('profilePic'), (req, res) => {
    res.json({ filePath: `/uploads/${req.file.filename}` });
});

const generateAuthCode = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
};

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join room', ({ authCode, userName, profilePic }) => {
        if (!rooms[authCode]) {
            rooms[authCode] = [];
        }

        socket.join(authCode);
        rooms[authCode].push({ id: socket.id, userName, profilePic });

        socket.to(authCode).emit('notification', `${userName} has joined room ${authCode}`);

        socket.on('chat message', (msg) => {
            io.to(authCode).emit('chat message', { userName, profilePic, msg });
        });

        socket.on('disconnect', () => {
            const user = rooms[authCode].find(u => u.id === socket.id);
            rooms[authCode] = rooms[authCode].filter(u => u.id !== socket.id);
            if (rooms[authCode].length === 0) {
                delete rooms[authCode];
            } else {
                socket.to(authCode).emit('notification', `${user.userName} has left room ${authCode}`);
            }
        });
    });

    socket.on('create room', () => {
        const authCode = generateAuthCode();
        socket.emit('room created', authCode);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
