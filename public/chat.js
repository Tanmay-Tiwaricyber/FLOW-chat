// chat.js
const socket = io();

const userNameInput = document.getElementById('userNameInput');
const authCodeInput = document.getElementById('authCodeInput');
const profilePicInput = document.getElementById('profilePicInput');
const joinRoomButton = document.getElementById('joinRoomButton');
const createRoomButton = document.getElementById('createRoomButton');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const authContainer = document.querySelector('.auth-container');
const chatContainer = document.querySelector('.chat-container');
const toggleThemeButton = document.getElementById('toggleThemeButton');

joinRoomButton.addEventListener('click', () => {
    const userName = userNameInput.value.trim();
    const authCode = authCodeInput.value.trim();
    const profilePic = profilePicInput.files[0];
    
    if (userName && authCode && profilePic) {
        const formData = new FormData();
        formData.append('profilePic', profilePic);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            socket.emit('join room', { authCode, userName, profilePic: data.filePath });
            switchToChat();
        })
        .catch(error => {
            console.error('Error uploading profile picture:', error);
        });
    } else {
        alert('Please enter your name, the room code, and select a profile picture.');
    }
});

createRoomButton.addEventListener('click', () => {
    socket.emit('create room');
});

socket.on('room created', (authCode) => {
    alert(`Room created with code: ${authCode}`);
    authCodeInput.value = authCode;
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (msg) {
        socket.emit('chat message', msg);
        input.value = '';
    }
});

socket.on('chat message', ({ userName, profilePic, msg }) => {
    const item = document.createElement('div');
    item.innerHTML = `<img src="${profilePic}" alt="${userName}" class="profile-pic"><strong>${userName}:</strong> ${msg}`;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
});

socket.on('notification', (msg) => {
    const item = document.createElement('div');
    item.textContent = msg;
    item.style.fontStyle = 'italic';
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
});

toggleThemeButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    toggleThemeButton.textContent = document.body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
});

function switchToChat() {
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
}
