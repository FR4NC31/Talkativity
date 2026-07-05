import { Play } from "lucide-react";
import { isImageKitUrl, withTransform } from "../../lib/imagekit";

const VIDEO_TRANSFORM = "q-80,w-640";
const POSTER_TRANSFORM = "q-80,w-640";

function buildPosterUrl(url) {
  if (!isImageKitUrl(url)) return undefined;
  const [path] = url.split("?");
  return withTransform(`${path}/ik-thumbnail.jpg`, POSTER_TRANSFORM);
}

export function MessageVideo({ src, onClick }) {
  const optimizedSrc = withTransform(src, VIDEO_TRANSFORM);
  const posterSrc = buildPosterUrl(src);

  return (
    <div className="relative mb-1.5 max-h-52 max-w-full overflow-hidden rounded-lg sm:max-h-64 sm:rounded-xl">
      <video
        src={optimizedSrc}
        poster={posterSrc}
        controls
        playsInline
        preload="metadata"
        className="max-h-52 max-w-full object-contain sm:max-h-64"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={onClick}
          className="pointer-events-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/70"
          aria-label="View video"
        >
          <Play className="size-7 fill-white" />
        </button>
      </div>
    </div>
  );
}
