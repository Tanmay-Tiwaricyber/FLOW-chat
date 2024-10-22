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
    res.json({ filePath: `uploads/${req.file.filename}` });
});

app.post('/uploadFile', upload.single('file'), (req, res) => {
    res.json({ filePath: `uploads/${req.file.filename}`, fileName: req.file.originalname });
});

const generateAuthCode = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
};

const generateColor = (index) => {
    const colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown', 'pink', 'cyan', 'lime', 'magenta'];
    return colors[index % colors.length];
};

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join room', ({ authCode, userName, profilePic }) => {
        if (!rooms[authCode]) {
            rooms[authCode] = [];
        }

        const userColor = generateColor(rooms[authCode].length);
        const user = { id: socket.id, userName, profilePic, color: userColor };

        rooms[authCode].push(user);

        socket.join(authCode);
        socket.to(authCode).emit('notification', `${userName} has joined room ${authCode}`);
        io.to(authCode).emit('user list update', rooms[authCode]);

        socket.on('chat message', (data) => {
            const recipient = rooms[authCode].find(user => user.userName === data.to);
            if (recipient) {
                io.to(recipient.id).emit('chat message', data);
                io.to(socket.id).emit('chat message', data); // To show the message on sender's side as well
            }
        });

        socket.on('file message', (data) => {
            const recipient = rooms[authCode].find(user => user.userName === data.to);
            if (recipient) {
                io.to(recipient.id).emit('file message', data);
                io.to(socket.id).emit('file message', data); // To show the message on sender's side as well
            }
        });

        socket.on('group message', (data) => {
            io.to(authCode).emit('chat message', data);
        });

        socket.on('disconnect', () => {
            const userIndex = rooms[authCode].findIndex(u => u.id === socket.id);
            const user = rooms[authCode][userIndex];
            rooms[authCode].splice(userIndex, 1);
            if (rooms[authCode].length === 0) {
                delete rooms[authCode];
            } else {
                socket.to(authCode).emit('notification', `${user.userName} has left room ${authCode}`);
                io.to(authCode).emit('user list update', rooms[authCode]);
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
