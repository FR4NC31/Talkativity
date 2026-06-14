import express from 'express'
import "dotenv/config"
import mongoose from 'mongoose'

const app = express()
const PORT = process.env.PORT 

app.listen(PORT,  () => console.log(`Server running on port ${PORT}`))


mongoose
    .connect(process.env.MONGO_URL)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.log(err))