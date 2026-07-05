import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const frontendUrl = process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(frontendUrl ? [frontendUrl] : []),
];

const io = new Server(server, {
  cors: {
    origin: isProduction ? true : allowedOrigins,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// online users map = { userId: Set<socketId> }
const userSocketMap = {};

function getReceiverSocketId(userId) {
  const sockets = userSocketMap[userId];
  if (sockets && sockets.size > 0) {
    return sockets.values().next().value;
  }
  return undefined;
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  console.log(`[Socket] Connection: userId=${userId}, socketId=${socket.id}`);

  if (userId) {
    if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
    userSocketMap[userId].add(socket.id);
  }

  console.log(`[Socket] Online users:`, Object.keys(userSocketMap));

  // io.emit() sends event to everyone - broadcast
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // socket.on is used to listen for events
  socket.on("disconnect", (reason) => {
    console.log(`[Socket] Disconnect: userId=${userId}, socketId=${socket.id}, reason=${reason}`);
    if (userId) {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) delete userSocketMap[userId];
    }
    const remaining = Object.keys(userSocketMap);
    console.log(`[Socket] Online users after disconnect:`, remaining);
    io.emit("getOnlineUsers", remaining);
  });

  // WebRTC signaling
  socket.on("call:offer", ({ to, offer, peerInfo, isVideo }) => {
    console.log(`[WebRTC] ${userId} -> ${to}: call:offer (video: ${!!isVideo})`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:incoming", { from: userId, offer, peerInfo, isVideo });
    } else {
      console.log(`[WebRTC] ${to} is offline, cannot forward offer`);
    }
  });

  socket.on("call:answer", ({ to, answer }) => {
    console.log(`[WebRTC] ${userId} -> ${to}: call:answer`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:answered", { from: userId, answer });
    }
  });

  socket.on("call:ice-candidate", ({ to, candidate }) => {
    console.log(`[WebRTC] ${userId} -> ${to}: ice-candidate (sdpMLineIndex: ${candidate.sdpMLineIndex})`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:ice-candidate", { from: userId, candidate });
    }
  });

  socket.on("call:end", ({ to }) => {
    console.log(`[WebRTC] ${userId} -> ${to}: call:end`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:ended", { from: userId });
    }
  });

  socket.on("call:busy", ({ to }) => {
    console.log(`[WebRTC] ${userId} -> ${to}: call:busy`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:busy", { from: userId });
    }
  });

  socket.on("call:rejected", ({ to }) => {
    console.log(`[WebRTC] ${userId} -> ${to}: call:rejected`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:rejected", { from: userId });
    }
  });

  socket.on("call:timedout", ({ to }) => {
    console.log(`[WebRTC] ${userId} -> ${to}: call:timedout`);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:timedout", { from: userId });
    }
  });

  // read receipts
  socket.on("messages:seen", async ({ conversationId }) => {
    const { default: Message } = await import("../models/message.model.js");
    try {
      await Message.updateMany(
        { senderId: conversationId, receiverId: userId, seenAt: null },
        { seenAt: new Date() },
      );
    } catch (err) {
      console.error("[Socket] Error marking messages as seen:", err.message);
    }
    const targetSocketId = getReceiverSocketId(conversationId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("messages:seen", { seenBy: userId });
    }
  });

  // typing indicator
  socket.on("typing:start", ({ to }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing:start", { from: userId });
    }
  });

  socket.on("typing:stop", ({ to }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing:stop", { from: userId });
    }
  });
});

export { app, server, io, getReceiverSocketId };
