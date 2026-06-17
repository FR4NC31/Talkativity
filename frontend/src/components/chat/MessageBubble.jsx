import { withTransform } from "../../lib/imagekit";
import { MessageVideo } from "./MessageVideo";
import { useCallStore } from "../../store/useCallStore";
import { PhoneCallIcon, PhoneMissedIcon, PhoneIcon, VideoIcon } from "lucide-react";

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
  const isOwnMessage = message.role === "me";
  const hasImage = Boolean(message.imageUrl);
  const hasVideo = Boolean(message.videoUrl);
  const isCallMessage = message.type === "call";
  const callAgain = useCallStore((s) => s.callAgain);

  const callIcon = message.callStatus === "missed" ? PhoneMissedIcon : PhoneCallIcon;
  const CallIcon = callIcon;
  const TypeIcon = message.callType === "video" ? VideoIcon : PhoneIcon;

  let callDurationLabel = null;
  if (message.callStatus === "ended" && message.callDuration > 0) {
    callDurationLabel = formatDuration(message.callDuration);
  }

  const otherUserId =
    message.role === "me" ? String(message.receiverId) : String(message.senderId);

  return (
    <div className={`flex w-full ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(90%,28rem)] rounded-2xl px-3 py-2 text-[15px] leading-snug sm:max-w-[min(75%,28rem)] sm:px-3.5 ${
          isCallMessage && message.callStatus === "missed"
            ? "rounded-br-md bg-surface"
            : isOwnMessage
              ? "rounded-br-md bg-accent text-accent-foreground"
              : "rounded-bl-md bg-surface"
        }`}
      >
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

        {!isCallMessage && message.text ? (
          <p className="whitespace-pre-wrap wrap-break-word">{renderTextWithLinks(message.text)}</p>
        ) : null}

        <p
          className={`mt-1 text-[11px] tabular-nums ${
            isOwnMessage ? "text-accent-foreground/75" : "text-muted"
          }`}
        >
          {message.time}
        </p>
      </div>
    </div>
  );
}
