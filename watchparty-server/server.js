const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// These objects keep track of who is in which room
const users = {}; 
const socketToRoom = {};

io.on('connection', socket => {
  
  // 1. When a user joins a room
  socket.on('join-room', roomID => {
    if (users[roomID]) {
      users[roomID].push(socket.id);
    } else {
      users[roomID] = [socket.id];
    }
    socketToRoom[socket.id] = roomID;
    
    // Send the new user a list of everyone else already in the room
    const usersInThisRoom = users[roomID].filter(id => id !== socket.id);
    socket.emit('all-users', usersInThisRoom);
  });

  // 2. Relay the WebRTC offer to a specific user
  socket.on('sending-signal', payload => {
    io.to(payload.userToSignal).emit('user-joined', { 
      signal: payload.signal, 
      callerID: payload.callerID 
    });
  });

  // 3. Relay the WebRTC answer back to the caller
  socket.on('returning-signal', payload => {
    io.to(payload.callerID).emit('receiving-returned-signal', { 
      signal: payload.signal, 
      id: socket.id 
    });
  });

  // 4. Video Syncing & Chat Events (Keep whatever you already had here)
  socket.on('video-event', (data) => {
    const roomID = socketToRoom[socket.id];
    socket.to(roomID).emit('video-event', data);
  });

  socket.on('chat-message', (data) => {
    const roomID = socketToRoom[socket.id];
    socket.to(roomID).emit('chat-message', data);
  });

  // 5. Handle Disconnects cleanly
  socket.on('disconnect', () => {
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter(id => id !== socket.id);
      users[roomID] = room;
    }
    // Tell everyone else to remove this user's video feed
    socket.broadcast.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));