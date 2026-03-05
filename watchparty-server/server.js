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

// THE FIX: users object now stores arrays of { id, name } objects instead of just strings
const users = {}; 
const socketToRoom = {};

io.on('connection', socket => {

  socket.on('check-room', (roomID, callback) => {
    if (users[roomID] && users[roomID].length > 0) {
      callback({ exists: true });
    } else {
      callback({ exists: false });
    }
  });

  socket.on('join-room', ({ roomID, userName }) => {
    socket.join(roomID); 
    
    // THE FIX: Create a user object containing both the socket ID and the Name
    const userObj = { id: socket.id, name: userName };
    
    if (users[roomID]) {
      users[roomID].push(userObj); // Push the object
    } else {
      users[roomID] = [userObj];   // Initialize with the object
    }
    socketToRoom[socket.id] = roomID;
    
    // THE FIX: Filter out the current user by checking u.id instead of just the string
    const usersInThisRoom = users[roomID].filter(u => u.id !== socket.id);
    
    // Send the array of objects to the frontend
    socket.emit('all-users', usersInThisRoom);

    socket.to(roomID).emit('system-message', {
      text: `${userName} joined the room 👋`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // WebRTC Signaling
  socket.on('sending-signal', payload => {
    // Passing callerName along with the signal so the receiving end knows who is calling
    io.to(payload.userToSignal).emit('user-joined', { 
      signal: payload.signal, 
      callerID: payload.callerID, 
      callerName: payload.callerName 
    });
  });

  socket.on('returning-signal', payload => {
    io.to(payload.callerID).emit('receiving-returned-signal', { signal: payload.signal, id: socket.id });
  });

  // Syncing Events
  socket.on('video-event', (data) => {
    const roomID = socketToRoom[socket.id];
    socket.to(roomID).emit('video-event', data);
  });

  socket.on('chat-message', (data) => {
    const roomID = socketToRoom[socket.id];
    socket.to(roomID).emit('chat-message', data);
  });

  socket.on('start-file-share', (data) => {
    const roomID = socketToRoom[socket.id];
    socket.to(roomID).emit('start-file-share', data);
  });

  // Disconnect & Cleanup
  socket.on('disconnect', () => {
    const roomID = socketToRoom[socket.id];
    if (roomID && users[roomID]) {
      // THE FIX: Filter by u.id when someone disconnects
      users[roomID] = users[roomID].filter(u => u.id !== socket.id);
      
      if (users[roomID].length === 0) {
        delete users[roomID]; 
      }
      
      socket.broadcast.to(roomID).emit('user-disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));