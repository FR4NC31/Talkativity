import { Avatar, Button } from "@heroui/react";
import { PhoneIcon, PhoneOffIcon, VideoIcon } from "lucide-react";
import { useCallStore } from "../../store/useCallStore";

function getInitials(name) {
  return name
    ?.split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("") || "?";
}

export function IncomingCallModal() {
  const peerInfo = useCallStore((s) => s.peerInfo);
  const isVideoCall = useCallStore((s) => s.isVideoCall);
  const answerCall = useCallStore((s) => s.answerCall);
  const rejectCall = useCallStore((s) => s.rejectCall);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-80 flex-col items-center gap-6 rounded-2xl bg-surface p-8 shadow-2xl">
        <Avatar className="size-20">
          <Avatar.Image src={peerInfo?.avatarUrl} alt={peerInfo?.name} />
          <Avatar.Fallback className="text-2xl font-medium">
            {getInitials(peerInfo?.name)}
          </Avatar.Fallback>
        </Avatar>

        <div className="text-center">
          <p className="text-lg font-semibold">{peerInfo?.name || "Unknown"}</p>
          <p className="text-sm text-muted">
            {isVideoCall ? "Incoming video call..." : "Incoming audio call..."}
          </p>
        </div>

        <div className="flex gap-6">
          <Button
            isIconOnly
            className="size-14 rounded-full bg-red-500 text-white"
            onPress={rejectCall}
          >
            <PhoneOffIcon className="size-6" />
          </Button>

          <Button
            isIconOnly
            className="size-14 rounded-full bg-green-500 text-white"
            onPress={() => answerCall(isVideoCall)}
          >
            {isVideoCall ? <VideoIcon className="size-6" /> : <PhoneIcon className="size-6" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
