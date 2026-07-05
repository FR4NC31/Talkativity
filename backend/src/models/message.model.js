import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    video: {
      type: String,
    },
    type: {
      type: String,
      enum: ["text", "call"],
      default: "text",
    },
    callStatus: {
      type: String,
      enum: ["missed", "ended"],
    },
    callDuration: {
      type: Number,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
    },
    editedAt: {
      type: Date,
    },
    seenAt: {
      type: Date,
      default: null,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    forwarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
