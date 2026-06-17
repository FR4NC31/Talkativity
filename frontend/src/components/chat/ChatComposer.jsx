import { Button, TextArea } from "@heroui/react";
import { ImageIcon, LoaderIcon, SendHorizontalIcon, XIcon, ReplyIcon, SmileIcon } from "lucide-react";
import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import EmojiPicker from "emoji-picker-react";
import useKeyboardSound from "../../hooks/useKeyboardSound";
import { useChatStore } from "../../store/useChatStore";
import { useSelectedConversation } from "../../hooks/useSelectedConversation";

const TYPING_TIMEOUT_MS = 2000;

export function ChatComposer() {
  const composerText = useChatStore((state) => state.composerText);
  const isSoundEnabled = useChatStore((state) => state.isSoundEnabled);
  const sendMediaMessage = useChatStore((state) => state.sendMediaMessage);
  const isSendingMedia = useChatStore((state) => state.isSendingMedia);
  const sendTextMessage = useChatStore((state) => state.sendTextMessage);
  const setComposerText = useChatStore((state) => state.setComposerText);
  const replyingTo = useChatStore((state) => state.replyingTo);
  const setReplyingTo = useChatStore((state) => state.setReplyingTo);
  const emitTypingStart = useChatStore((state) => state.emitTypingStart);
  const emitTypingStop = useChatStore((state) => state.emitTypingStop);
  const { activeConversation, activeConversationId } = useSelectedConversation();
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const mediaInputRef = useRef(null);
  const textAreaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const emojiPortalRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ bottom: 0, right: 0 });

  // auto-focus input when replying to a message
  useEffect(() => {
    if (replyingTo) {
      textAreaRef.current?.focus();
    }
  }, [replyingTo]);

  // close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e) => {
      if (
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target) &&
        (!emojiPortalRef.current || !emojiPortalRef.current.contains(e.target))
      ) {
        setShowEmojiPicker(false);
      }
    };
    // use mousedown so click fires before emoji-picker-react's internal handlers
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  // stop typing on unmount / conversation switch
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (activeConversationId) emitTypingStop(activeConversationId);
    };
  }, [activeConversationId]);

  const playSoundIfEnabled = () => {
    if (isSoundEnabled) playRandomKeyStrokeSound();
  };

  const toggleEmojiPicker = useCallback(() => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    } else {
      const rect = emojiButtonRef.current?.getBoundingClientRect();
      if (rect) {
        setEmojiPos({
          bottom: window.innerHeight - rect.top + 8,
          right: window.innerWidth - rect.right,
        });
      }
      setShowEmojiPicker(true);
    }
  }, [showEmojiPicker]);

  const onEmojiClick = (emojiObject) => {
    setComposerText(composerText + emojiObject.emoji);
    textAreaRef.current?.focus();
  };

  const handleSend = async () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    const didSendMessage = await sendTextMessage(activeConversationId);
    if (didSendMessage) playSoundIfEnabled();
  };

  const handleComposerTextChange = (event) => {
    setComposerText(event.target.value);
    playSoundIfEnabled();

    if (!activeConversationId) return;
    emitTypingStart(activeConversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(activeConversationId);
      typingTimeoutRef.current = null;
    }, TYPING_TIMEOUT_MS);
  };

  const handleMediaPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const didSendMessage = await sendMediaMessage({
      conversationId: activeConversationId,
      file,
    });

    if (didSendMessage) playSoundIfEnabled();
  };

  return (
    <footer className="shrink-0 border-t border-border px-1.5 pb-2 pt-2 sm:px-2">
      {isSendingMedia ? (
        <div className="mx-auto mb-2 flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
          <LoaderIcon
            className="size-4 shrink-0 animate-spin text-accent"
            strokeWidth={2}
            aria-hidden
          />
          <span className="truncate">Uploading media...</span>
        </div>
      ) : null}

      {/* reply preview bar */}
      {replyingTo ? (
        <div className="mx-auto mb-2 flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          <ReplyIcon className="size-4 shrink-0 text-accent" />
          <div className="flex-1 truncate">
            <span className="text-xs font-medium text-accent">
              {replyingTo.role === "me" ? "You" : activeConversation?.peer?.name || "Replying to"}
            </span>
            <p className="truncate text-muted">{replyingTo.text || "Message"}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-full items-end gap-1.5 px-0.5 sm:gap-2 sm:px-1">
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          disabled={isSendingMedia}
          tabIndex={-1}
          aria-hidden
          onChange={handleMediaPick}
        />
        <Button
          variant="ghost"
          isIconOnly
          isDisabled={isSendingMedia}
          className="size-9 shrink-0 touch-manipulation self-end text-accent"
          onPress={() => mediaInputRef.current?.click()}
        >
          <ImageIcon className="size-5 sm:size-6" strokeWidth={2} />
        </Button>

        <div ref={emojiButtonRef} className="self-end">
          <Button
            variant="ghost"
            isIconOnly
            className="size-9 shrink-0 touch-manipulation text-accent"
            onPress={toggleEmojiPicker}
          >
            <SmileIcon className="size-5 sm:size-6" strokeWidth={2} />
          </Button>
        </div>

        {showEmojiPicker
          ? createPortal(
              <div
                ref={emojiPortalRef}
                className="fixed z-[9999]"
                style={{ bottom: emojiPos.bottom, right: emojiPos.right }}
              >
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </div>,
              document.body,
            )
          : null}

        <TextArea
          ref={textAreaRef}
          fullWidth
          variant="secondary"
          placeholder={replyingTo ? "Write a reply..." : "Type a message..."}
          rows={1}
          value={composerText}
          onChange={handleComposerTextChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 rounded-full"
        />

        <Button variant="primary" isIconOnly isDisabled={!composerText.trim()} onPress={handleSend}>
          <SendHorizontalIcon className="size-5" />
        </Button>
      </div>
    </footer>
  );
}
