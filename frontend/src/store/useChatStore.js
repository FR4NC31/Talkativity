import { create } from "zustand";
import { persist } from "zustand/middleware";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

export const useChatStore = create(
  persist(
    (set, get) => ({
      users: [],
      conversations: [],
      messages: [],
      selectedUser: null,
      isConversationsLoading: false,
      isUsersLoading: false,
      isMessagesLoading: false,
      activeConversationId: null,
      searchQuery: "",
      sidebarTab: "chats",
      composerText: "",
      isSoundEnabled: true,
      isSendingMedia: false,
      replyingTo: null,
      isOtherTyping: false,
      unreadCount: 0,

      getUsers: async () => {
        set({ isUsersLoading: true });
        try {
          const res = await axiosInstance.get("/messages/users");
          set((state) => ({
            users: res.data,
            selectedUser:
              state.selectedUser && res.data.some((user) => user._id === state.selectedUser._id)
                ? state.selectedUser
                : null,
          }));
        } catch (error) {
          console.log("Error in get Users", error.message);
        } finally {
          set({ isUsersLoading: false });
        }
      },

      getConversations: async () => {
        set({ isConversationsLoading: true });
        try {
          const res = await axiosInstance.get("/messages/conversations");
          set({ conversations: res.data });
        } catch (error) {
          console.log("Error in getConversations", error.message);
        } finally {
          set({ isConversationsLoading: false });
        }
      },

      getMessages: async (userId) => {
        if (!userId) return;
        set({ isMessagesLoading: true });
        try {
          const res = await axiosInstance.get(`/messages/${userId}`);
          set({ messages: res.data });
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to load messages");
        } finally {
          set({ isMessagesLoading: false });
        }
      },

      sendMessage: async (messageData) => {
        const { selectedUser } = get();
        if (!selectedUser) return false;

        try {
          const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
          // read fresh state after the await to avoid racing with socket events
          const { messages } = get();
          const exists = messages.some((m) => String(m._id) === String(res.data._id));
          if (!exists) {
            get().setMessages([...messages, res.data]);
            set({ composerText: "" });
          } else {
            set({ composerText: "" });
          }
          get().getConversations();
          return true;
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to send message");
          return false;
        }
      },

      subscribeToMessages: (userId) => {
        if (!userId) return;

        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off("newMessage");
        socket.off("message:edited");
        socket.off("message:deleted");

        socket.on("newMessage", (newMessage) => {
          get().getConversations();

          const isRelevant =
            String(newMessage.senderId) === String(userId) ||
            String(newMessage.receiverId) === String(userId);

          if (!isRelevant) return;

          const exists = get().messages.some(
            (m) => String(m._id) === String(newMessage._id),
          );
          if (!exists) {
            get().setMessages([...get().messages, newMessage]);
          }

          if (String(newMessage.senderId) === String(userId)) {
            get().emitMessagesSeen(userId);
          }
        });

        socket.on("message:edited", (edited) => {
          const isRelevant =
            String(edited.senderId) === String(userId) ||
            String(edited.receiverId) === String(userId);
          if (!isRelevant) return;

          const { messages } = get();
          get().setMessages(
            messages.map((m) => (String(m._id) === String(edited._id) ? edited : m)),
          );
        });

        socket.on("message:deleted", ({ _id }) => {
          const { messages } = get();
          get().setMessages(messages.filter((m) => String(m._id) !== String(_id)));
        });
      },

      unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("newMessage");
        socket.off("message:edited");
        socket.off("message:deleted");
      },

      subscribeToTyping: (userId) => {
        if (!userId) return;
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off("typing:start");
        socket.off("typing:stop");

        socket.on("typing:start", ({ from }) => {
          if (String(from) === String(userId)) {
            set({ isOtherTyping: true });
          }
        });

        socket.on("typing:stop", ({ from }) => {
          if (String(from) === String(userId)) {
            set({ isOtherTyping: false });
          }
        });
      },

      unsubscribeFromTyping: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("typing:start");
        socket.off("typing:stop");
        set({ isOtherTyping: false });
      },

      emitTypingStart: (conversationId) => {
        const socket = useAuthStore.getState().socket;
        if (socket) socket.emit("typing:start", { to: conversationId });
      },

      emitTypingStop: (conversationId) => {
        const socket = useAuthStore.getState().socket;
        if (socket) socket.emit("typing:stop", { to: conversationId });
      },

      setSelectedUser: (selectedUser) => set({ selectedUser }),

      setActiveConversationId: (activeConversationId) => {
        set((state) => ({
          activeConversationId,
          selectedUser:
            state.users.find((user) => user._id === activeConversationId) ||
            state.conversations.find((user) => user._id === activeConversationId) ||
            null,
          messages: activeConversationId ? state.messages : [],
        }));
        get().resetUnread();
      },

      setMessages: (messages) => {
        const seen = new Set();
        set({
          messages: messages.filter((m) => {
            const key = String(m._id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        });
      },
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setComposerText: (composerText) => set({ composerText }),
      setSoundEnabled: (isSoundEnabled) => set({ isSoundEnabled }),
      setReplyingTo: (replyingTo) => set({ replyingTo }),
      incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
      resetUnread: () => set({ unreadCount: 0 }),
      setMessagesSeen: (seenBy) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            String(m.receiverId) === String(seenBy) && !m.seenAt
              ? { ...m, seenAt: new Date().toISOString() }
              : m,
          ),
        }));
      },
      emitMessagesSeen: (conversationId) => {
        const socket = useAuthStore.getState().socket;
        if (socket) {
          socket.emit("messages:seen", { conversationId });
        }
      },

      editMessage: async (messageId, newText) => {
        try {
          const res = await axiosInstance.put(`/messages/${messageId}`, { text: newText });
          const { messages } = get();
          get().setMessages(
            messages.map((m) => (String(m._id) === String(messageId) ? res.data : m)),
          );
          return true;
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to edit message");
          return false;
        }
      },

      deleteMessage: async (messageId) => {
        try {
          await axiosInstance.delete(`/messages/${messageId}`);
          const { messages } = get();
          get().setMessages(messages.filter((m) => String(m._id) !== String(messageId)));
          get().getConversations();
          toast.success("Message deleted");
          return true;
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to delete message");
          return false;
        }
      },

      forwardMessage: async (message, receiverId) => {
        try {
          const payload = {
            text: message.text || "",
            forwarded: true,
          };
          if (message.imageUrl) payload.imageUrl = message.imageUrl;
          if (message.videoUrl) payload.videoUrl = message.videoUrl;

          await axiosInstance.post(`/messages/send/${receiverId}`, payload);
          get().getConversations();
          toast.success("Message forwarded");
          return true;
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to forward message");
          return false;
        }
      },

      sendTextMessage: async (conversationId) => {
        const messageText = get().composerText.trim();
        if (!conversationId || !messageText) return false;

        const { replyingTo } = get();
        const payload = replyingTo
          ? { text: messageText, replyTo: replyingTo.id }
          : { text: messageText };

        set({ replyingTo: null });
        get().emitTypingStop(conversationId);
        return get().sendMessage(payload);
      },

      sendMediaMessage: async ({ conversationId, file }) => {
        if (!conversationId || !file) return false;

        const { replyingTo } = get();
        const formData = new FormData();
        formData.append("media", file);
        if (replyingTo) {
          formData.append("replyTo", replyingTo.id);
        }

        set({ replyingTo: null, isSendingMedia: true });
        try {
          return await get().sendMessage(formData);
        } finally {
          set({ isSendingMedia: false });
        }
      },
    }),
    {
      name: "talkativity-storage",
      partialize: (state) => ({ isSoundEnabled: state.isSoundEnabled }),
    },
  ),
);
