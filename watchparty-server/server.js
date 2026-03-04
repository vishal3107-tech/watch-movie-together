const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Configure Socket.io with CORS so our React frontend can connect
const io = new Server(server, {
    cors: {
        origin: "*", // Allows any frontend URL to connect during development
        methods: ["GET", "POST"]
    }
});

// We keep a simple mapping of socket IDs to Room IDs so we know who is where
const socketToRoom = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- 1. ROOM MANAGEMENT & WEBRTC SIGNALING ---

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;

        // Get all users currently in this room (excluding the one who just joined)
        const usersInRoom = io.sockets.adapter.rooms.get(roomId);
        const users = [];
        if (usersInRoom) {
            for (const clientId of usersInRoom) {
                if (clientId !== socket.id) {
                    users.push(clientId);
                }
            }
        }

        // Send the list of existing users to the new user so they can initiate WebRTC peers
        socket.emit('all-users', users);
        console.log(`User ${socket.id} joined room ${roomId}. Existing users in room:`, users);
    });

    // Relay the WebRTC offer (signal) from the new user to an existing user
    socket.on('sending-signal', (payload) => {
        io.to(payload.userToSignal).emit('user-joined', {
            signal: payload.signal,
            callerID: payload.callerID
        });
    });

    // Relay the WebRTC answer (signal) from the existing user back to the new user
    socket.on('returning-signal', (payload) => {
        io.to(payload.callerID).emit('receiving-returned-signal', {
            signal: payload.signal,
            id: socket.id
        });
    });

    // --- 2. SYNCHRONIZED VIDEO EVENTS ---

    socket.on('video-event', (data) => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            // Broadcast the video event (play, pause, seek) to everyone ELSE in the room
            socket.to(roomId).emit('video-event', data);
        }
    });

    // --- 3. REAL-TIME CHAT ---

    socket.on('send-chat-message', (messageData) => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            // Broadcast chat message to everyone in the room
            io.in(roomId).emit('chat-message', {
                senderId: socket.id,
                text: messageData.text,
                timestamp: new Date().toISOString()
            });
        }
    });

    // --- 4. DISCONNECTION HANDLING ---

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            // Notify others in the room so they can remove the video element/peer connection
            socket.to(roomId).emit('user-disconnected', socket.id);
            delete socketToRoom[socket.id];
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});