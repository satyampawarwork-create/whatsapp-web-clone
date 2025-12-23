const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for now, lock down later
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const groupRoutes = require('./routes/group');
const uploadRoutes = require('./routes/upload');

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/upload', uploadRoutes);

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp_clone';
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Socket.io
let onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        onlineUsers.set(userId, socket.id);
        console.log(`User ${userId} joined as ${socket.id}`);
        io.emit('online_users', Array.from(onlineUsers.keys()));
    });

    socket.on('private_message', async (data) => {
        const { sender, recipient, content, type } = data;

        // Save to DB
        try {
            const Message = require('./models/Message'); // Lazy load
            const newMessage = new Message({ sender, recipient, content, type });
            await newMessage.save();

            // Emit to recipient if online
            const recipientSocket = onlineUsers.get(recipient);
            if (recipientSocket) {
                io.to(recipientSocket).emit('receive_message', newMessage);
            }
            // Emit back to sender for optimistic UI update (or confirm)
            socket.emit('message_sent', newMessage);

        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('join_group', (groupId) => {
        socket.join(groupId);
        console.log(`User socket ${socket.id} joined group ${groupId}`);
    });

    socket.on('group_message', async (data) => {
        const { sender, groupId, content, type } = data;
        try {
            const Message = require('./models/Message');
            const newMessage = new Message({ sender, groupId, content, type });
            await newMessage.save();

            // Broadcast to room (groupId)
            // Note: Use .to(groupId) which includes sender if they are in room, 
            // but usually we append locally. socket.to(groupId) excludes sender.
            // Let's use io.to(groupId) so everyone gets it.
            io.to(groupId).emit('receive_group_message', newMessage);
        } catch (err) {
            console.error(err);
        }
    });

    // --- Call Signaling ---
    socket.on('call_user', (data) => {
        const { userToCall, signalData, from, name } = data;
        const recipientSocket = onlineUsers.get(userToCall);
        if (recipientSocket) {
            io.to(recipientSocket).emit('call_user', { signal: signalData, from, name });
        }
    });

    socket.on('answer_call', (data) => {
        const { to, signal } = data;
        const recipientSocket = onlineUsers.get(to);
        if (recipientSocket) {
            io.to(recipientSocket).emit('call_accepted', signal);
        }
    });

    socket.on('end_call', (data) => {
        const { to } = data;
        const recipientSocket = onlineUsers.get(to);
        if (recipientSocket) {
            io.to(recipientSocket).emit('call_ended');
        }
    });

    socket.on('ice_candidate', (data) => {
        const { target, candidate } = data;
        const recipientSocket = onlineUsers.get(target);
        if (recipientSocket) {
            io.to(recipientSocket).emit('ice_candidate', { candidate });
        }
    });

    socket.on('disconnect', () => {
        // Find userId by socketId to remove
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
        io.emit('online_users', Array.from(onlineUsers.keys()));
        console.log('User disconnected:', socket.id);
    });
});

// Serve Static Files
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../server/uploads')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Default link: http://localhost:${PORT}`);
});
