const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get chat history between two users
router.get('/:userId/:otherId', async (req, res) => {
    try {
        const { userId, otherId } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: userId, recipient: otherId },
                { sender: otherId, recipient: userId }
            ]
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Toggle Chat Actions (Pin, Favorite, Archive, Mute)
router.post('/action', async (req, res) => {
    try {
        const { userId, targetId, type, action } = req.body;
        // type: 'pin', 'favorite', 'archive', 'mute'
        // action: 'add' or 'remove'

        const User = require('../models/User');
        const fieldMap = {
            'pin': 'pinnedChats',
            'favorite': 'favorites',
            'archive': 'archivedChats',
            'mute': 'mutedChats'
        };

        const field = fieldMap[type];
        if (!field) return res.status(400).json({ message: 'Invalid action type' });

        const update = action === 'add'
            ? { $addToSet: { [field]: targetId } }
            : { $pull: { [field]: targetId } };

        const user = await User.findByIdAndUpdate(userId, update, { new: true });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Toggle Pin Chat
router.post('/pin', async (req, res) => {
    try {
        const { userId, targetId, action } = req.body; // action: 'pin' or 'unpin'
        const User = require('../models/User');

        const update = action === 'pin'
            ? { $addToSet: { pinnedChats: targetId } }
            : { $pull: { pinnedChats: targetId } };

        const user = await User.findByIdAndUpdate(userId, update, { new: true });
        res.json(user.pinnedChats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Chat History
router.delete('/:userId/:otherId', async (req, res) => {
    try {
        const { userId, otherId } = req.params;
        // In a real app, we might just hide them for one user, but for now we delete the docs where sender/recipient matches
        // Wait, deleting for ONE user usually limits queries. 
        // For this simple clone, let's delete ALL messages between them (simpler but aggressive)
        // OR better: we can't easily "hide" without a 'deletedBy' array in Message.
        // Let's go with "Clear Chat" (deletes for both) for simplicity, or complex 'deletedFor'.
        // User asked to "delete any chats".

        // Simple implementation: Delete all messages between these two.
        await Message.deleteMany({
            $or: [
                { sender: userId, recipient: otherId },
                { sender: otherId, recipient: userId }
            ]
        });

        res.json({ message: 'Chat cleared' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
