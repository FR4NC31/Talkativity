import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/express/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const evt = await verifyWebhook(req);

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;

      const email =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
        u.email_addresses?.[0]?.email_address;

      if (!email) {
        console.warn("Clerk webhook: no email for user", u.id);
        res.status(200).json({ received: true });
        return;
      }

      const fullName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || email.split("@")[0];

      await User.findOneAndUpdate(
        { clerkId: u.id },
        { clerkId: u.id, email, fullName, profilePic: u.image_url },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      console.log(`Clerk webhook: ${evt.type} — ${email} (${u.id})`);
    }

    if (evt.type === "user.deleted") {
      if (evt.data.id) {
        await User.findOneAndDelete({ clerkId: evt.data.id });
        console.log("Clerk webhook: user.deleted —", evt.data.id);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Clerk webhook verification failed:", error.message);
    res.status(400).json({ message: "Webhook verification failed" });
  }
});

export default router;