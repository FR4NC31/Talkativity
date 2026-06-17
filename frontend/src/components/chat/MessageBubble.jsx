import { useState, useRef, useEffect } from "react";
import { withTransform } from "../../lib/imagekit";
import { MessageVideo } from "./MessageVideo";
import { useChatStore } from "../../store/useChatStore";
import { useCallStore } from "../../store/useCallStore";
import { Button, Modal, useOverlayState } from "@heroui/react";
import {
  PhoneCallIcon,
  PhoneMissedIcon,
  PhoneIcon,
  VideoIcon,
  MoreHorizontalIcon,
  ReplyIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
} from "lucide-react";

const IMAGE_TRANSFORM = "q-auto,w-640,f-auto";

const URL_PATTERN = /(\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)}\]"'»]|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,}(?:\/[^\s<]*[^\s<.,;:!?)}\]"'»])?)/gi;

function renderTextWithLinks(text) {
  const parts = [];
  let lastIndex = 0;
  let match;

  URL_PATTERN.lastIndex = 0;

  while ((match = URL_PATTERN.exec(text)) !== null) {
    const url = match[0];
    const index = match.index;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 decoration-from-font hover:opacity-80"
      >
        {url}
      </a>,
    );

    lastIndex = index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export function MessageBubble({ message }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const menuRef = useRef(null);
  const longPressTimer = useRef(null);
  const BUBBLE_LONG_PRESS_MS = 500;

  const deleteModal = useOverlayState();

  const editMessage = useChatStore((s) => s.editMessage);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);

  const isOwnMessage = message.role === "me";
  const hasImage = Boolean(message.imageUrl);
  const hasVideo = Boolean(message.videoUrl);
  const isCallMessage = message.type === "call";
  const callAgain = useCallStore((s) => s.callAgain);

  // close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  const callIcon = message.callStatus === "missed" ? PhoneMissedIcon : PhoneCallIcon;
  const CallIcon = callIcon;
  const TypeIcon = message.callType === "video" ? VideoIcon : PhoneIcon;

  let callDurationLabel = null;
  if (message.callStatus === "ended" && message.callDuration > 0) {
    callDurationLabel = formatDuration(message.callDuration);
  }

  const otherUserId =
    message.role === "me" ? String(message.receiverId) : String(message.senderId);

  const handleReply = () => {
    setShowMenu(false);
    setReplyingTo(message);
  };

  const handleEdit = () => {
    setShowMenu(false);
    setEditText(message.text);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.text) {
      setIsEditing(false);
      return;
    }
    const ok = await editMessage(message.id, trimmed);
    if (ok) setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(message.text);
  };

  const handleDelete = () => {
    setShowMenu(false);
    deleteModal.open();
  };

  const confirmDelete = async () => {
    deleteModal.close();
    await deleteMessage(message.id);
  };

  const handleTouchStart = (e) => {
    if (e.target.closest("button, textarea, a, input")) return;
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, BUBBLE_LONG_PRESS_MS);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className={`group flex w-full ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[min(90%,28rem)] sm:max-w-[min(75%,28rem)]">
        {/* 3-dot menu */}
        <div ref={menuRef} className={`absolute top-1 z-10 ${isOwnMessage ? "-left-8" : "-right-8"}`}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="flex size-7 items-center justify-center rounded-full max-sm:hidden sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Message actions"
          >
            <MoreHorizontalIcon className="size-4 text-muted" />
          </button>

          {showMenu ? (
            <div
              className={`absolute top-0 z-50 flex w-36 flex-col overflow-hidden rounded-xl border border-border bg-background py-1 shadow-xl ${
                isOwnMessage ? "left-0" : "right-0"
              }`}
            >
              <button
                type="button"
                onClick={handleReply}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent-soft"
              >
                <ReplyIcon className="size-4" />
                Reply
              </button>
              {isOwnMessage && !isCallMessage ? (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent-soft"
                >
                  <PencilIcon className="size-4" />
                  Edit
                </button>
              ) : null}
              {isOwnMessage ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
                >
                  <Trash2Icon className="size-4" />
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          className={`rounded-2xl px-3 py-2 text-[15px] leading-snug sm:px-3.5 ${
            isEditing
              ? "w-full bg-surface"
              : isCallMessage && message.callStatus === "missed"
                ? "rounded-br-md bg-surface"
                : isOwnMessage
                  ? "rounded-br-md bg-accent text-accent-foreground"
                  : "rounded-bl-md bg-surface"
          }`}
        >
          {/* reply preview */}
          {message.replyText ? (
            <div
              className={`mb-1.5 rounded-lg border-l-2 px-2.5 py-1.5 text-xs ${
                isOwnMessage ? "border-accent-foreground/30 bg-accent-foreground/10" : "border-accent/30 bg-accent/5"
              }`}
            >
              <p className={`truncate text-[10px] font-semibold uppercase tracking-wider ${isOwnMessage ? "text-accent-foreground/80" : "text-accent"}`}>
                {message.replySenderName}
              </p>
              <p className={`truncate ${isOwnMessage ? "text-accent-foreground/70" : "text-foreground/70"}`}>
                {message.replyText}
              </p>
            </div>
          ) : null}

          {hasImage ? (
            <img
              src={withTransform(message.imageUrl, IMAGE_TRANSFORM)}
              alt=""
              className="mb-1.5 max-h-40 max-w-full rounded-lg object-cover sm:max-h-52 sm:rounded-xl"
            />
          ) : null}
          {hasVideo ? <MessageVideo src={message.videoUrl} /> : null}

          {isCallMessage ? (
            <div className="flex items-center gap-2.5 py-1">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  isOwnMessage
                    ? "bg-accent-foreground/15"
                    : message.callStatus === "missed"
                      ? "bg-danger/10"
                      : "bg-accent/10"
                }`}
              >
                <TypeIcon
                  className={`size-4.5 ${
                    isOwnMessage
                      ? "text-accent-foreground"
                      : message.callStatus === "missed"
                        ? "text-danger"
                        : "text-accent"
                  }`}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <CallIcon
                    className={`size-4 ${
                      isOwnMessage
                        ? "text-accent-foreground/80"
                        : message.callStatus === "missed"
                          ? "text-danger"
                          : "text-foreground"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {message.callType === "video" ? "Video call" : "Audio call"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {message.callStatus === "missed" ? (
                    <span className="text-xs font-medium text-danger">Missed</span>
                  ) : null}
                  {callDurationLabel ? (
                    <span className="text-xs text-muted">{callDurationLabel}</span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => callAgain(otherUserId)}
                className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isOwnMessage
                    ? "bg-accent-foreground/15 hover:bg-accent-foreground/25"
                    : "bg-accent/10 hover:bg-accent/20"
                }`}
                aria-label="Call again"
              >
                <PhoneIcon className="size-4" />
              </button>
            </div>
          ) : null}

          {/* edit mode */}
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full resize-none rounded-lg border border-border bg-background p-2 text-[15px] text-foreground outline-none"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === "Escape") handleCancelEdit();
                }}
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <XIcon className="size-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  <CheckIcon className="size-3.5" />
                  Save
                </button>
              </div>
            </div>
          ) : !isCallMessage && message.text ? (
            <p className="whitespace-pre-wrap wrap-break-word">{renderTextWithLinks(message.text)}</p>
          ) : null}

          <p
            className={`mt-1 flex items-center gap-1 text-[11px] tabular-nums ${
              isOwnMessage ? "text-accent-foreground/75" : "text-muted"
            }`}
          >
            {message.editedAt ? <span className="text-[10px] italic">edited</span> : null}
            {message.time}
          </p>
        </div>
      </div>

      <Modal.Root state={deleteModal}>
        <Modal.Backdrop variant="opaque">
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog className="border border-border bg-background text-foreground shadow-2xl">
              <Modal.Header className="border-b border-border pb-3">
                <Modal.Heading className="text-lg font-semibold tracking-tight">
                  Delete message?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="pt-4">
                <p className="text-sm text-muted">
                  This message will be permanently removed for both you and the other person.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex gap-2 border-t border-border pt-3">
                <Button variant="ghost" onPress={() => deleteModal.close()}>
                  Cancel
                </Button>
                <Button variant="solid" className="bg-danger text-white" onPress={confirmDelete}>
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </div>
  );
}
