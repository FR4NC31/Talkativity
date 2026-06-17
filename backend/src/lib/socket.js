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
});

function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// online users map = { userId: socketId }
const userSocketMap = {};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) userSocketMap[userId] = socket.id;

  // io.emit() sends event to everyone - broadcast
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // socket.on is used to listen for events
  socket.on("disconnect", () => {
    if (userId) delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
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
});

export { app, server, io, getReceiverSocketId };
