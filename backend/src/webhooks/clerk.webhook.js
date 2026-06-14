import express from 'express'
import User from '../models/user.model.js'
import {verifyWebhook} from '@clerk/backend/webhooks'

const router = express.Router() 

router.post("/", async (req, res) => {
   try {
     const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
    if(!signingSecret){
        res.status(503).json({ message: "Webhook secret is not provided" })
        return
    }

    const payload = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body)
    const request = new Request("http://internal/webhooks/clerk", {
        method: "POST",
        headers: new Headers(req.headers),
        body: payload
    })

    const evt = await verifyWebhook(request, { signingSecret })

    if(evt.type === "user.created" || evt.type === "user.updated"){
     const u = evt.data
     
     const email = 
     u.emailAddress?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
     u.emailAddress?.[0]?.emailAddress

     const fullName = 
     [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || email?.split("@")
     [0]

     await User.findOneAndUpdate(
        { clerkId: u.id },
        { clerkId: u.id, email, fullName, profilePic: u.imageUrl },
        { new: true, upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
     )
    }

    if(evt.type === "user.deleted"){
        if(evt.data.id) await User.findOneAndDelete({clerkId: evt.data.id})
        
        res.status(200).json({received: true})
    }
   } catch (error) {
    console.log("Error in Clerk Webhook", error)
    res.status(500).json({message: "Webhook verification failed"})
   }

})


export default router   