import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { hasImageKitConfig, uploadChatMedia } from "../lib/imagekit.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export async function getUsersForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-clerkId");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getConversationsForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const conversations = await Message.aggregate([
      // 1. Keep only the messages I sent or received.
      { $match: { $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }] } },
      // 2. Collapse them into one row per chat partner, noting our latest message time.
      {
        $group: {
          // The partner is the other person on the message (not me).
          _id: { $cond: [{ $eq: ["$senderId", loggedInUserId] }, "$receiverId", "$senderId"] },
          lastMessageAt: { $max: "$createdAt" },
        },
      },
      // 3. Put the most recent conversation at the top.
      { $sort: { lastMessageAt: -1 } },
      // 4. Look up each partner's user profile (comes back as an array).
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      // 5. Drop conversations where the partner user no longer exists (e.g. deleted account).
      { $match: { "user.0": { $exists: true } } },
      // 6. Unwind the user array into the root document.
      { $unwind: "$user" },
      // 7. Replace the root with the user document.
      { $replaceRoot: { newRoot: "$user" } },
      // 8. Hide the private clerkId field from the result.
      { $project: { clerkId: 0 } },
    ]);

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error in getConversationsForSidebar:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMessages(req, res) {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function sendMessage(req, res) {
  try {
    const { text, type, callStatus, callDuration, callType, replyTo, imageUrl, videoUrl, forwarded } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let finalImageUrl = imageUrl;
    let finalVideoUrl = videoUrl;

    if (!finalImageUrl && !finalVideoUrl && req.file) {
      if (!hasImageKitConfig()) {
        return res.status(500).json({ message: "Media upload is not configured" });
      }

      const url = await uploadChatMedia(req.file);
      if (req.file.mimetype.startsWith("video/")) finalVideoUrl = url;
      else finalImageUrl = url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "",
      image: finalImageUrl,
      video: finalVideoUrl,
      type: type || "text",
      callStatus,
      callDuration,
      callType,
      replyTo: replyTo || undefined,
      forwarded: forwarded || false,
    });

    await newMessage.save();

    // emit to receiver
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
    // also emit to sender for multi-tab/session support
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function markMessagesAsSeen(req, res) {
  try {
    const { id: conversationPartnerId } = req.params;
    const myId = req.user._id;

    const result = await Message.updateMany(
      { senderId: conversationPartnerId, receiverId: myId, seenAt: null },
      { seenAt: new Date() },
    );

    const receiverSocketId = getReceiverSocketId(conversationPartnerId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messages:seen", { seenBy: myId });
    }

    res.status(200).json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error in markMessagesAsSeen:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function editMessage(req, res) {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const message = await Message.findOne({ _id: id, senderId: userId });
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.text = text || "";
    message.editedAt = new Date();
    await message.save();

    // emit to both participants
    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("message:edited", message);
    }
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("message:edited", message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in editMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteMessage(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const message = await Message.findOneAndDelete({ _id: id, senderId: userId });
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const payload = { _id: message._id, senderId: message.senderId, receiverId: message.receiverId };

    // emit to both participants
    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("message:deleted", payload);
    }
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("message:deleted", payload);
    }

    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}
