const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const users = {}; 
const socketToRoom = {};

io.on('connection', socket => {

  // 1. NEW: Check if room exists before letting someone join
  socket.on('check-room', (roomID, callback) => {
    if (users[roomID] && users[roomID].length > 0) {
      callback({ exists: true });
    } else {
      callback({ exists: false });
    }
  });

  // 2. User officially joins
  socket.on('join-room', ({ roomID, userName }) => {
    socket.join(roomID); // <-- THIS WAS THE MISSING MAGIC KEY! 
    
    if (users[roomID]) {
      users[roomID].push(socket.id);
    } else {
      users[roomID] = [socket.id];
    }
    socketToRoom[socket.id] = roomID;
    
    const usersInThisRoom = users[roomID].filter(id => id !== socket.id);
    socket.emit('all-users', usersInThisRoom);

    // 3. NEW: Tell the chat tab that someone joined!
    socket.to(roomID).emit('system-message', {
      text: `${userName} joined the room 👋`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('sending-signal', payload => {
    io.to(payload.userToSignal).emit('user-joined', { signal: payload.signal, callerID: payload.callerID });
  });

  socket.on('returning-signal', payload => {
    io.to(payload.callerID).emit('receiving-returned-signal', { signal: payload.signal, id: socket.id });
  });

  socket.on('video-event', (data) => {
    const roomID = socketToRoom[socket.id];
    socket.to(roomID).emit('video-event', data);
  });

  socket.on('chat-message', (data) => {
    const roomID = socketToRoom[socket.id];
    socket.to(roomID).emit('chat-message', data); // This will now work properly!
  });

  socket.on('disconnect', () => {
    const roomID = socketToRoom[socket.id];
    if (roomID) {
      let room = users[roomID];
      if (room) {
        room = room.filter(id => id !== socket.id);
        users[roomID] = room;
        if (room.length === 0) delete users[roomID]; // Delete empty rooms
      }
      socket.broadcast.to(roomID).emit('user-disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));