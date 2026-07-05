import { useWallpaper } from "../context/wallpaper";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import { useSelectedConversation } from "../hooks/useSelectedConversation";
import { useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import ChatSidebar from "../components/chat/ChatSidebar";
import { ChatHeader } from "../components/chat/ChatHeader";
import { MessageList } from "../components/chat/MessageList";
import { ChatComposer } from "../components/chat/ChatComposer";
import { IncomingCallModal } from "../components/call/IncomingCallModal";
import { ActiveCallOverlay } from "../components/call/ActiveCallOverlay";
import { BottomTabNav } from "../components/navigation/BottomTabNav";

function ChatPage() {
  const { frameStyle } = useWallpaper();

  const getConversations = useChatStore((state) => state.getConversations);
  const getMessages = useChatStore((state) => state.getMessages);
  const getUsers = useChatStore((state) => state.getUsers);
  const subscribeToMessages = useChatStore((state) => state.subscribeToMessages);
  const unsubscribeFromMessages = useChatStore((state) => state.unsubscribeFromMessages);

  const callStatus = useCallStore((state) => state.status);

  const sidebarTab = useChatStore((state) => state.sidebarTab);
  const setSidebarTab = useChatStore((state) => state.setSidebarTab);
  const unreadCount = useChatStore((state) => state.unreadCount);
  const setMessagesSeen = useChatStore((state) => state.setMessagesSeen);
  const emitMessagesSeen = useChatStore((state) => state.emitMessagesSeen);

  const socket = useAuthStore((state) => state.socket);

  const { activeConversation, activeConversationId, isLargeScreen } = useSelectedConversation();

  useEffect(() => {
    getUsers();
    getConversations();
  }, [getConversations, getUsers]);

  useEffect(() => {
    if (!activeConversationId) return;

    getMessages(activeConversationId);
    subscribeToMessages(activeConversationId);

    axiosInstance.put(`/messages/seen/${activeConversationId}`).catch(() => {});
    emitMessagesSeen(activeConversationId);

    return () => unsubscribeFromMessages();
  }, [getMessages, activeConversationId, subscribeToMessages, unsubscribeFromMessages, emitMessagesSeen]);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ seenBy }) => setMessagesSeen(seenBy);
    socket.on("messages:seen", handler);
    return () => socket.off("messages:seen", handler);
  }, [socket, setMessagesSeen]);

  useEffect(() => {
    const prefix = unreadCount > 0 ? `(${unreadCount}) ` : "";
    const title = activeConversation
      ? `${activeConversation.peer.name} — Talkativity`
      : "Talkativity";
    document.title = `${prefix}${title}`;
  }, [activeConversation, unreadCount]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden p-2 sm:p-3 md:p-8" style={frameStyle}>
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground lg:flex-row">
        <div className="flex flex-1 overflow-hidden">
          <ChatSidebar />

          <div
            className={`flex-1 flex-col overflow-hidden ${
              !isLargeScreen && !activeConversationId ? "hidden lg:flex" : "flex"
            }`}
          >
            <ChatHeader />
            <MessageList />

            {activeConversation ? <ChatComposer /> : null}
          </div>
        </div>

        {!isLargeScreen && !activeConversationId ? (
          <BottomTabNav activeTab={sidebarTab} onTabChange={setSidebarTab} />
        ) : null}

        {callStatus === "ringing" ? <IncomingCallModal /> : null}
        {callStatus === "calling" || callStatus === "connected" ? <ActiveCallOverlay /> : null}
      </div>
    </div>
  );
}
export default ChatPage;
