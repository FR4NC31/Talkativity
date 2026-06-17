import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

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

  setupListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("call:incoming", ({ from, offer, peerInfo, isVideo }) => {
      if (get().status !== "idle") {
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
      const state = get();
      const pc = state.peerConnection;
      if (!pc || state.status !== "calling") return;

      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          get().pendingCandidates.forEach((c) =>
            pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}),
          );
          set({ pendingCandidates: [], status: "connected" });
        })
        .catch(console.error);
    });

    socket.on("call:ice-candidate", ({ candidate }) => {
      const pc = get().peerConnection;
      if (!pc) return;
      if (!pc.remoteDescription) {
        set((s) => ({ pendingCandidates: [...s.pendingCandidates, candidate] }));
        return;
      }
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });

    socket.on("call:ended", () => get().endCall(true));
    socket.on("call:busy", () => get().endCall(true));
    socket.on("call:rejected", () => get().endCall(true));
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
  },

  createPeerConnection: () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
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
      set({
        remoteStream: event.streams[0],
        isRemoteVideoEnabled: event.track.kind === "video",
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "disconnected" || state === "failed") {
        get().endCall(true);
      }
    };

    return pc;
  },

  startCall: async (peerInfo, isVideo = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });

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

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

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
      console.error("Failed to start call:", error);
      get().endCall(true);
    }
  },

  answerCall: async (isVideo = true) => {
    const offer = get().pendingOffer;
    if (!offer) {
      get().endCall(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });

      const pc = get().createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      get().pendingCandidates.forEach((c) =>
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}),
      );

      const socket = useAuthStore.getState().socket;
      const peerInfo = get().peerInfo;
      if (socket && peerInfo) {
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
      });
    } catch (error) {
      console.error("Failed to answer call:", error);
      get().endCall(true);
    }
  },

  rejectCall: () => {
    const socket = useAuthStore.getState().socket;
    const peerInfo = get().peerInfo;
    if (socket && peerInfo) {
      socket.emit("call:rejected", { to: peerInfo.userId });
    }
    set({ status: "idle", peerInfo: null, pendingCandidates: [], pendingOffer: null });
  },

  endCall: (isRemote = false) => {
    const state = get();

    if (!isRemote) {
      const socket = useAuthStore.getState().socket;
      if (socket && state.peerInfo) {
        socket.emit("call:end", { to: state.peerInfo.userId });
      }
    }

    if (state.peerConnection) {
      state.peerConnection.close();
    }
    if (state.localStream) {
      state.localStream.getTracks().forEach((t) => t.stop());
    }
    if (state.remoteStream) {
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
    });
  },

  toggleAudio: () => {
    const track = get().localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    set({ isAudioEnabled: track.enabled });
  },

  toggleVideo: () => {
    const track = get().localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    set({ isVideoEnabled: track.enabled });
  },
}));
