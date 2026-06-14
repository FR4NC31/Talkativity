import express from 'express'
import "dotenv/config"

import cors from 'cors'
import { clerkMiddleware } from '@clerk/express'

import User from './models/user.model.js'
import { connectDB } from './lib/db.js'

const app = express()
const PORT = process.env.PORT
const FRONTEND_URL = process.env.FRONTEND_URL

app.use(express.json())
app.use(clerkMiddleware())
app.use(cors({origin: FRONTEND_URL, credentials: true}))

app.get("/health", (req, res) => {
    res.status(200).json({ok: true})
})

app.listen(PORT,  () => {
    connectDB()
    console.log(`Server running on port ${PORT}`)
})

