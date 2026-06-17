import { useRef, useEffect } from "react";
import { Button } from "@heroui/react";
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
  LoaderIcon,
} from "lucide-react";
import { useCallStore } from "../../store/useCallStore";

export function ActiveCallOverlay() {
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  const status = useCallStore((s) => s.status);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const peerInfo = useCallStore((s) => s.peerInfo);
  const isAudioEnabled = useCallStore((s) => s.isAudioEnabled);
  const isVideoEnabled = useCallStore((s) => s.isVideoEnabled);
  const isRemoteVideoEnabled = useCallStore((s) => s.isRemoteVideoEnabled);
  const toggleAudio = useCallStore((s) => s.toggleAudio);
  const toggleVideo = useCallStore((s) => s.toggleVideo);
  const endCall = useCallStore((s) => s.endCall);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log("[WebRTC] Attaching remote stream to video element");
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("[WebRTC] Attaching local stream to video element");
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black">
      {/* Remote video */}
      {remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <LoaderIcon className="mx-auto mb-3 size-8 animate-spin text-white/70" />
            <p className="text-lg font-semibold text-white">{peerInfo?.name}</p>
            <p className="text-sm text-white/60">
              {status === "calling" ? "Calling..." : "Connecting..."}
            </p>
          </div>
        </div>
      )}

      {/* No remote video placeholder */}
      {remoteStream && !isRemoteVideoEnabled ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-white/10">
              <VideoOffIcon className="size-8 text-white/60" />
            </div>
            <p className="text-lg font-semibold text-white">{peerInfo?.name}</p>
            <p className="text-sm text-white/60">Camera is off</p>
          </div>
        </div>
      ) : null}

      {/* Local video PIP */}
      {localStream && isVideoEnabled ? (
        <div className="absolute right-4 top-4 z-10 h-48 w-36 overflow-hidden rounded-xl border-2 border-white/30 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4">
        <Button
          isIconOnly
          className={`size-12 rounded-full ${
            isAudioEnabled
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-red-500 text-white"
          }`}
          onPress={toggleAudio}
        >
          {isAudioEnabled ? (
            <MicIcon className="size-5" />
          ) : (
            <MicOffIcon className="size-5" />
          )}
        </Button>

        <Button
          isIconOnly
          className="size-14 rounded-full bg-red-500 text-white hover:bg-red-600"
          onPress={() => endCall(false)}
        >
          <PhoneOffIcon className="size-6" />
        </Button>

        <Button
          isIconOnly
          className={`size-12 rounded-full ${
            isVideoEnabled
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-red-500 text-white"
          }`}
          onPress={toggleVideo}
        >
          {isVideoEnabled ? (
            <VideoIcon className="size-5" />
          ) : (
            <VideoOffIcon className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
