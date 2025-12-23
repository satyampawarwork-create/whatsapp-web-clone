const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For 1:1
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // For groups
    content: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
