const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const users = {}; // Now stores: { roomID: [{ id: socket.id, name: userName }] }
const socketToRoom = {};

io.on('connection', socket => {

  socket.on('check-room', (roomID, callback) => {
    if (users[roomID] && users[roomID].length > 0) callback({ exists: true });
    else callback({ exists: false });
  });

  socket.on('join-room', ({ roomID, userName }) => {
    socket.join(roomID); 
    const userObj = { id: socket.id, name: userName };
    
    if (users[roomID]) users[roomID].push(userObj);
    else users[roomID] = [userObj];
    
    socketToRoom[socket.id] = roomID;
    
    // Filter out self, and send the array of {id, name} objects
    const usersInThisRoom = users[roomID].filter(u => u.id !== socket.id);
    socket.emit('all-users', usersInThisRoom);

    socket.to(roomID).emit('system-message', {
      text: `${userName} joined the room 👋`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Include callerName in the payload!
  socket.on('sending-signal', payload => {
    io.to(payload.userToSignal).emit('user-joined', { 
      signal: payload.signal, callerID: payload.callerID, callerName: payload.callerName 
    });
  });

  socket.on('returning-signal', payload => {
    io.to(payload.callerID).emit('receiving-returned-signal', { signal: payload.signal, id: socket.id });
  });

  socket.on('video-event', (data) => socket.to(socketToRoom[socket.id]).emit('video-event', data));
  socket.on('chat-message', (data) => socket.to(socketToRoom[socket.id]).emit('chat-message', data));
  socket.on('start-file-share', (data) => socket.to(socketToRoom[socket.id]).emit('start-file-share', data));

  socket.on('disconnect', () => {
    const roomID = socketToRoom[socket.id];
    if (roomID && users[roomID]) {
      users[roomID] = users[roomID].filter(u => u.id !== socket.id);
      if (users[roomID].length === 0) delete users[roomID];
      socket.broadcast.to(roomID).emit('user-disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));