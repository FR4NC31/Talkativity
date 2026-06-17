import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { axiosInstance } from "../lib/axios";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

const RING_TIMEOUT = 30000;

export const useCallStore = create((set, get) => ({
  status: "idle",
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  peerInfo: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isVideoCall: true,
  isRemoteVideoEnabled: false,
  pendingCandidates: [],
  pendingOffer: null,
  callStartTime: null,
  callTimeoutId: null,

  saveCallLog: async (callStatus, callDuration) => {
    const state = get();
    const authUser = useAuthStore.getState().authUser;
    const peerInfo = state.peerInfo;
    if (!peerInfo || !authUser) return;

    try {
      const res = await axiosInstance.post(`/messages/send/${peerInfo.userId}`, {
        type: "call",
        callStatus,
        callDuration: callDuration || 0,
        callType: state.isVideoCall ? "video" : "audio",
      });
      const chatStore = useChatStore.getState();
      chatStore.setMessages([...chatStore.messages, res.data]);
      chatStore.getConversations();
    } catch (error) {
      console.error("[WebRTC] Failed to save call log:", error);
    }
  },

  setupListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("call:incoming", ({ from, offer, peerInfo, isVideo }) => {
      console.log(`[WebRTC] Incoming call from ${peerInfo?.name || from} (video: ${!!isVideo})`);
      if (get().status !== "idle") {
        console.log("[WebRTC] Busy — sending busy signal");
        socket.emit("call:busy", { to: from });
        return;
      }
      set({
        status: "ringing",
        peerInfo: { userId: from, ...peerInfo },
        pendingOffer: offer,
        pendingCandidates: [],
        isVideoCall: !!isVideo,
      });
    });

    socket.on("call:answered", ({ answer }) => {
      console.log("[WebRTC] Call answered — setting remote description");
      const state = get();
      const pc = state.peerConnection;
      if (!pc || state.status !== "calling") {
        console.log("[WebRTC] Ignoring answer — not in calling state");
        return;
      }

      if (state.callTimeoutId) {
        clearTimeout(state.callTimeoutId);
      }

      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          console.log("[WebRTC] Remote description set, flushing pending ICE candidates");
          get().pendingCandidates.forEach((c) =>
            pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}),
          );
          set({
            pendingCandidates: [],
            status: "connected",
            callStartTime: Date.now(),
            callTimeoutId: null,
          });
          console.log("[WebRTC] Call connected");
        })
        .catch((err) => console.error("[WebRTC] Failed to set remote description:", err));
    });

    socket.on("call:ice-candidate", ({ candidate }) => {
      const pc = get().peerConnection;
      if (!pc) return;
      if (!pc.remoteDescription) {
        console.log("[WebRTC] Buffering ICE candidate (remote description not set yet)");
        set((s) => ({ pendingCandidates: [...s.pendingCandidates, candidate] }));
        return;
      }
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) =>
        console.error("[WebRTC] Failed to add ICE candidate:", err),
      );
    });

    socket.on("call:ended", () => {
      console.log("[WebRTC] Call ended by peer");
      get().endCall(true);
    });
    socket.on("call:busy", () => {
      console.log("[WebRTC] Peer is busy");
      get().saveCallLog("missed", 0);
      get().endCall(true);
    });
    socket.on("call:rejected", () => {
      console.log("[WebRTC] Call rejected by peer");
      get().saveCallLog("missed", 0);
      get().endCall(true);
    });
    socket.on("call:timedout", () => {
      console.log("[WebRTC] Call timed out");
      get().endCall(true);
    });
  },

  removeListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("call:incoming");
    socket.off("call:answered");
    socket.off("call:ice-candidate");
    socket.off("call:ended");
    socket.off("call:busy");
    socket.off("call:rejected");
    socket.off("call:timedout");
  },

  createPeerConnection: () => {
    console.log("[WebRTC] Creating RTCPeerConnection");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      console.log("[WebRTC] Sending ICE candidate");
      const socket = useAuthStore.getState().socket;
      const peerInfo = get().peerInfo;
      if (socket && peerInfo) {
        socket.emit("call:ice-candidate", {
          to: peerInfo.userId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track (kind: ${event.track.kind})`);
      set({
        remoteStream: event.streams[0],
        isRemoteVideoEnabled: event.track.kind === "video",
      });
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);
      const state = pc.connectionState;
      if (state === "disconnected" || state === "failed") {
        console.log("[WebRTC] Connection lost — ending call");
        get().endCall(false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);
    };

    return pc;
  },

  startCall: async (peerInfo, isVideo = true) => {
    console.log(`[WebRTC] Starting ${isVideo ? "video" : "audio"} call with ${peerInfo.name}`);
    try {
      console.log("[WebRTC] Requesting user media...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      stream.getTracks().forEach((t) =>
        console.log(`[WebRTC] Local track: ${t.kind} (${t.label}, enabled: ${t.enabled})`),
      );

      const pc = get().createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      set({
        localStream: stream,
        peerConnection: pc,
        status: "calling",
        peerInfo,
        isVideoEnabled: isVideo,
        isVideoCall: isVideo,
        pendingCandidates: [],
      });

      const timeoutId = setTimeout(() => {
        if (get().status === "calling") {
          console.log("[WebRTC] Call not answered — saving missed call log");
          get().saveCallLog("missed", 0);
          const socket = useAuthStore.getState().socket;
          const peer = get().peerInfo;
          if (socket && peer) {
            socket.emit("call:timedout", { to: peer.userId });
          }
          get().endCall(true);
        }
      }, RING_TIMEOUT);
      set({ callTimeoutId: timeoutId });

      console.log("[WebRTC] Creating SDP offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[WebRTC] Sending offer to peer");

      const socket = useAuthStore.getState().socket;
      const authUser = useAuthStore.getState().authUser;
      if (socket && authUser) {
        socket.emit("call:offer", {
          to: peerInfo.userId,
          offer: pc.localDescription,
          isVideo,
          peerInfo: {
            userId: authUser._id,
            name: authUser.fullName,
            avatarUrl: authUser.profilePic,
          },
        });
      }
    } catch (error) {
      console.error("[WebRTC] Failed to start call:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        console.error("[WebRTC] Camera/mic permission denied");
      } else if (error.name === "NotFoundError") {
        console.error("[WebRTC] No camera/mic found on this device");
      }
      get().endCall(true);
    }
  },

  answerCall: async (isVideo = true) => {
    const offer = get().pendingOffer;
    if (!offer) {
      console.warn("[WebRTC] No pending offer to answer");
      get().endCall(true);
      return;
    }

    try {
      console.log(`[WebRTC] Answering call (video: ${isVideo})`);
      console.log("[WebRTC] Requesting user media...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      stream.getTracks().forEach((t) =>
        console.log(`[WebRTC] Local track: ${t.kind} (${t.label}, enabled: ${t.enabled})`),
      );

      const pc = get().createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      console.log("[WebRTC] Setting remote description (offer)...");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      console.log("[WebRTC] Creating SDP answer...");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("[WebRTC] Flushing pending ICE candidates");
      get().pendingCandidates.forEach((c) =>
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}),
      );

      const socket = useAuthStore.getState().socket;
      const peerInfo = get().peerInfo;
      if (socket && peerInfo) {
        console.log("[WebRTC] Sending answer to peer");
        socket.emit("call:answer", {
          to: peerInfo.userId,
          answer: pc.localDescription,
        });
      }

      set({
        localStream: stream,
        peerConnection: pc,
        status: "connected",
        pendingCandidates: [],
        pendingOffer: null,
        isVideoEnabled: isVideo,
        callStartTime: Date.now(),
      });
      console.log("[WebRTC] Call connected");
    } catch (error) {
      console.error("[WebRTC] Failed to answer call:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        console.error("[WebRTC] Camera/mic permission denied");
      } else if (error.name === "NotFoundError") {
        console.error("[WebRTC] No camera/mic found on this device");
      }
      get().endCall(true);
    }
  },

  rejectCall: () => {
    const peerName = get().peerInfo?.name || "Unknown";
    console.log(`[WebRTC] Rejecting call from ${peerName}`);
    const socket = useAuthStore.getState().socket;
    const peerInfo = get().peerInfo;
    if (socket && peerInfo) {
      socket.emit("call:rejected", { to: peerInfo.userId });
    }
    if (get().callTimeoutId) {
      clearTimeout(get().callTimeoutId);
    }
    set({
      status: "idle",
      peerInfo: null,
      pendingCandidates: [],
      pendingOffer: null,
      callTimeoutId: null,
    });
  },

  endCall: (isRemote = false) => {
    const state = get();
    if (state.status === "idle") return;

    const peerName = state.peerInfo?.name || "Unknown";
    console.log(`[WebRTC] Ending call with ${peerName} (remote: ${isRemote})`);

    if (state.callTimeoutId) {
      clearTimeout(state.callTimeoutId);
    }

    if (!isRemote && state.callStartTime && state.status === "connected") {
      const duration = Math.floor((Date.now() - state.callStartTime) / 1000);
      get().saveCallLog("ended", duration);
    }

    if (!isRemote) {
      const socket = useAuthStore.getState().socket;
      if (socket && state.peerInfo) {
        socket.emit("call:end", { to: state.peerInfo.userId });
      }
    }

    if (state.peerConnection) {
      console.log("[WebRTC] Closing peer connection");
      state.peerConnection.close();
    }
    if (state.localStream) {
      console.log("[WebRTC] Stopping local tracks");
      state.localStream.getTracks().forEach((t) => t.stop());
    }
    if (state.remoteStream) {
      console.log("[WebRTC] Stopping remote tracks");
      state.remoteStream.getTracks().forEach((t) => t.stop());
    }

    set({
      status: "idle",
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      peerInfo: null,
      isAudioEnabled: true,
      isVideoEnabled: true,
      isVideoCall: true,
      isRemoteVideoEnabled: false,
      pendingCandidates: [],
      pendingOffer: null,
      callStartTime: null,
      callTimeoutId: null,
    });
  },

  callAgain: (peerId) => {
    const chatStore = useChatStore.getState();
    const user =
      chatStore.users.find((u) => u._id === peerId) ||
      chatStore.conversations.find((u) => u._id === peerId);
    if (!user) {
      console.warn("[WebRTC] Cannot call again — user not found");
      return;
    }
    const initials = user.fullName
      ?.split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("") || "?";
    get().startCall(
      {
        userId: user._id,
        name: user.fullName,
        avatarUrl: user.profilePic,
        initials,
      },
      true,
    );
  },

  toggleAudio: () => {
    const track = get().localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    set({ isAudioEnabled: track.enabled });
    console.log(`[WebRTC] Audio ${track.enabled ? "unmuted" : "muted"}`);
  },

  toggleVideo: () => {
    const track = get().localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    set({ isVideoEnabled: track.enabled });
    console.log(`[WebRTC] Video ${track.enabled ? "enabled" : "disabled"}`);
  },
}));
