import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:3000" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    set({ isCheckingAuth: true });

    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });

      get().connectSocket(res.data);
    } catch (error) {
      console.error("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  clearAuth: () => {
    set({ authUser: null, isCheckingAuth: false, onlineUsers: [] });
    get().disconnectSocket();
  },

  connectSocket: (user) => {
    if (!user || get().socket?.connected) return;

    console.log(`[Socket] Connecting with userId:`, user._id, `(${typeof user._id})`);

    // clean up a stale socket that never connected
    const stale = get().socket;
    if (stale && !stale.connected) {
      stale.removeAllListeners();
      stale.disconnect();
    }

    const socket = io(BASE_URL, {
      query: { userId: user._id },
      timeout: 30000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
    });

    socket.on("getOnlineUsers", (userIds) => {
      console.log(`[Socket] getOnlineUsers received:`, userIds);
      const myId = get().authUser?._id;
      console.log(`[Socket] My authUser._id:`, myId, `included:`, userIds.includes(myId));
      set({ onlineUsers: userIds });
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id, "with userId:", user._id);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    set({ socket: null, onlineUsers: [] });
  },
}));
