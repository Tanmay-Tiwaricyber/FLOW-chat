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
const chatRoomInfo = document.getElementById('chatRoomInfo');
const userList = document.getElementById('userList');
const userContainer = document.querySelector('.user-container'); // New element reference
const fileInput = document.getElementById('fileInput'); // New element reference
const fileUploadButton = document.getElementById('fileUploadButton'); // New element reference

joinRoomButton.addEventListener('click', handleJoinRoom);
createRoomButton.addEventListener('click', handleCreateRoom);
form.addEventListener('submit', handleSendMessage);
toggleThemeButton.addEventListener('click', toggleTheme);
fileUploadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);

let selectedProfilePic = null;
let currentUser = null;
let selectedUserForChat = null; // Variable to store the selected user for one-to-one chat

// Function to handle joining a room
function handleJoinRoom() {
  const userName = userNameInput.value.trim();
  const authCode = authCodeInput.value.trim();
  const profilePic = profilePicInput.files[0];

  if (userName && authCode && (profilePic || selectedProfilePic)) {
    if (profilePic) {
      const formData = new FormData();
      formData.append('profilePic', profilePic);

      fetch('/upload', {
          method: 'POST',
          body: formData
        })
        .then(response => response.json())
        .then(data => {
          currentUser = {
            userName,
            profilePic: data.filePath
          };
          socket.emit('join room', {
            authCode,
            userName,
            profilePic: data.filePath
          });
          switchToChat(authCode);
        })
        .catch(error => {
          console.error('Error uploading profile picture:', error);
        });
    } else {
      currentUser = {
        userName,
        profilePic: selectedProfilePic
      };
      socket.emit('join room', {
        authCode,
        userName,
        profilePic: selectedProfilePic
      });
      switchToChat(authCode);
    }
  } else {
    alert('Please enter your name, the room code, and select a profile picture.');
  }
}

// Function to handle creating a room
function handleCreateRoom() {
  socket.emit('create room');
}

// Function to handle sending a message
// Function to handle sending a message
function handleSendMessage(e) {
  e.preventDefault();
  const msg = input.value.trim();
  if (msg) {
    if (msg.includes('@group')) {
      socket.emit('group message', {
        msg,
        from: currentUser.userName,
        profilePic: currentUser.profilePic
      });
    } else if (selectedUserForChat) {
      socket.emit('chat message', {
        to: selectedUserForChat.userName,
        msg,
        from: currentUser.userName,
        profilePic: currentUser.profilePic
      });
    } else {
      alert('Please select a user to chat with or use @group to send a message to all.');
    }
    input.value = '';
  }
}

// Function to handle file upload
function handleFileUpload() {
  const file = fileInput.files[0];
  if (file && selectedUserForChat) {
    const formData = new FormData();
    formData.append('file', file);

    fetch('/uploadFile', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        socket.emit('file message', {
          to: selectedUserForChat.userName,
          filePath: data.filePath,
          fileName: file.name,
          from: currentUser.userName,
          profilePic: currentUser.profilePic
        });
      })
      .catch(error => {
        console.error('Error uploading file:', error);
      });
  } else if (!selectedUserForChat) {
    alert('Please select a user to chat with.');
  }
}

// Function to toggle theme
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  toggleThemeButton.textContent = document.body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
}

// Function to switch to chat view
function switchToChat(authCode) {
  authContainer.classList.add('hidden');
  chatContainer.classList.remove('hidden');
  userContainer.classList.remove('hidden'); // Show the user container after joining the chat
  chatRoomInfo.textContent = `Chat-Room Code: ${authCode}`; // Update chat room info with authCode
  requestNotificationPermission();
}

// Function to request notification permission
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') {
        alert('Notification permission denied. You will not receive desktop notifications.');
      }
    });
  }
}

// Function to show desktop notification
function showNotification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Chat App', {
      body: message,
      icon: 'chat-icon.png'
    });
  }
}

// Default profile pictures
const defaultProfilePics = document.querySelector('.default-pics-grid');
const defaultPics = [
  'images/default1.gif',
  'images/default2.gif',
  'images/default3.gif',
  'images/default4.gif',
  'images/default5.gif',
  'images/default6.gif',
];

defaultPics.forEach(pic => {
  const img = document.createElement('img');
  img.src = pic;
  img.classList.add('default-pic');
  img.addEventListener('click', () => {
    selectedProfilePic = pic;
    document.querySelectorAll('.default-pic').forEach(p => p.classList.remove('selected'));
    img.classList.add('selected');
  });
  defaultProfilePics.appendChild(img);
});

// Function to update user list
function updateUserList(users) {
  userList.innerHTML = '';
  users.forEach(user => {
    const userItem = document.createElement('li');
    userItem.textContent = user.userName;
    userItem.addEventListener('click', () => {
      selectedUserForChat = user;
      alert(`You are now chatting with ${user.userName}`);
    });
    userList.appendChild(userItem);
  });
}

// Socket event handlers
socket.on('room created', handleRoomCreated);
socket.on('chat message', handleChatMessage);
socket.on('file message', handleFileMessage); // New event handler for file messages
socket.on('notification', handleNotification);
socket.on('mention notification', handleMentionNotification);
socket.on('room data', handleRoomData);
socket.on('user list update', updateUserList); // New event handler

// Function to handle room creation
function handleRoomCreated(authCode) {
  alert(`Room created with code: ${authCode}`);
  authCodeInput.value = authCode;
}

// Function to handle incoming chat messages
function handleChatMessage({
  from,
  profilePic,
  msg,
  color
}) {
  const item = document.createElement('div');
  const coloredMsg = msg.replace(/@(\w+)/g, `<span style="color: ${color};">@\$1</span>`);
  item.innerHTML = `<img src="${profilePic}" alt="${from}" class="profile-pic"><strong>${from}:</strong> ${coloredMsg}`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  showNotification(`${from}: ${msg}`);
}

// Function to handle incoming file messages
function handleFileMessage({
  from,
  profilePic,
  filePath,
  fileName,
  color
}) {
  const item = document.createElement('div');
  item.innerHTML = `<img src="${profilePic}" alt="${from}" class="profile-pic"><strong>${from}:</strong> <a href="${filePath}" download="${fileName}" style="color:${color}">${fileName}</a>`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  showNotification(`${from} sent a file: ${fileName}`);
}

// Function to handle general notifications
function handleNotification(msg) {
  const item = document.createElement('div');
  item.textContent = msg;
  item.style.fontStyle = 'italic';
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  showNotification(msg);
}

// Function to handle mention notifications
function handleMentionNotification(msg) {
  alert(msg);
  showNotification(msg);
}

// Function to handle room data (display chat ID and update user list)
function handleRoomData({
  authCode,
  users
}) {
  switchToChat(authCode);
  updateUserList(users);
}

function redirectToWebsite() {
  window.location.href = 'https://temp-about.netlify.app/'; // Replace with the URL you want to redirect to
}

