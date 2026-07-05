import { useState, useMemo } from "react";
import { SearchIcon, LoaderIcon } from "lucide-react";
import { Modal, Avatar } from "@heroui/react";
import { useChatStore } from "../../store/useChatStore";
import { useAuthStore } from "../../store/useAuthStore";
import { AvatarWithOnlineIndicator } from "./AvatarWithOnlineIndicator";
import { getInitials } from "../../hooks/useSelectedConversation";

function getAvatarUrl(user) {
  return user.profilePic || user.avatarUrl || null;
}

function UserRow({ user, onSelect, isForwarding }) {
  const onlineUsers = useAuthStore((s) => s.onlineUsers);
  const isOnline = onlineUsers.includes(user._id);

  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      disabled={isForwarding}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent-soft disabled:opacity-50"
    >
      <AvatarWithOnlineIndicator isOnline={isOnline}>
        <Avatar className="size-12 shrink-0">
          <Avatar.Image alt={user.fullName} src={getAvatarUrl(user)} />
          <Avatar.Fallback className="text-sm font-medium">
            {getInitials(user.fullName)}
          </Avatar.Fallback>
        </Avatar>
      </AvatarWithOnlineIndicator>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{user.fullName}</p>
      </div>

      {isForwarding ? (
        <LoaderIcon className="size-5 shrink-0 animate-spin text-accent" />
      ) : null}
    </button>
  );
}

export function ForwardPicker({ message, onClose }) {
  const [search, setSearch] = useState("");
  const [forwardingUserId, setForwardingUserId] = useState(null);

  const users = useChatStore((s) => s.users);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const forwardMessage = useChatStore((s) => s.forwardMessage);

  const isForwarding = forwardingUserId !== null;

  const contacts = useMemo(() => {
    const seen = new Set();
    const merged = [...conversations, ...users];
    const result = [];
    for (const user of merged) {
      const id = String(user._id);
      if (!seen.has(id) && id !== String(activeConversationId)) {
        seen.add(id);
        result.push(user);
      }
    }
    return result;
  }, [conversations, users, activeConversationId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((u) => u.fullName.toLowerCase().includes(q));
  }, [contacts, search]);

  const handleSelect = async (user) => {
    setForwardingUserId(user._id);
    const ok = await forwardMessage(message, user._id);
    setForwardingUserId(null);
    if (ok) onClose();
  };

  return (
    <Modal.Root isOpen onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop variant="opaque">
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="border border-border bg-background text-foreground shadow-2xl">
            <Modal.Header className="border-b border-border pb-3">
              <Modal.Heading className="text-lg font-semibold tracking-tight">
                Forward message
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3 pt-4">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  autoFocus
                  disabled={isForwarding}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent disabled:opacity-50"
                />
              </div>

              <div className="flex max-h-64 flex-col overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">No contacts found</p>
                ) : (
                  filtered.map((user) => (
                    <UserRow
                      key={user._id}
                      user={user}
                      onSelect={handleSelect}
                      isForwarding={forwardingUserId === user._id}
                    />
                  ))
                )}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
