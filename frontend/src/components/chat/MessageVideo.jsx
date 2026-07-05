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
    <div
      onClick={onClick}
      className="relative mb-1.5 max-h-52 max-w-full cursor-pointer overflow-hidden rounded-lg sm:max-h-64 sm:rounded-xl"
    >
      <video
        src={optimizedSrc}
        poster={posterSrc}
        playsInline
        preload="metadata"
        className="max-h-52 max-w-full object-contain sm:max-h-64"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white">
          <Play className="size-7 fill-white" />
        </div>
      </div>
    </div>
  );
}
