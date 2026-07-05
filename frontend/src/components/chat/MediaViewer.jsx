import { useEffect, useCallback } from "react";
import { XIcon } from "lucide-react";
import { withTransform } from "../../lib/imagekit";

const FULL_IMAGE_TRANSFORM = "q-auto,f-auto";
const FULL_VIDEO_TRANSFORM = "q-80";

export function MediaViewer({ mediaUrl, mediaType, onClose }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  if (!mediaUrl) return null;

  const fullSrc =
    mediaType === "video"
      ? withTransform(mediaUrl, FULL_VIDEO_TRANSFORM)
      : withTransform(mediaUrl, FULL_IMAGE_TRANSFORM);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        aria-label="Close media viewer"
      >
        <XIcon className="size-6" />
      </button>

      {mediaType === "video" ? (
        <video
          src={fullSrc}
          controls
          autoPlay
          playsInline
          className="max-h-[90vh] max-w-[90vw] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={fullSrc}
          alt=""
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
