import mongoose from 'mongoose'

export async function connectDB() {
    try {
        const mongoUri = process.env.MONGO_URI

        if(!mongoUri) {
            throw new Error('MONGO_URI is not defined')
        }
        const conn = await mongoose.connect(mongoUri)

        console.log(`MongoDB Connected: ${conn.connection.host}`)
    } catch (error) {
        console.error("MONGODB CONNECTION ERROR: ", error.message)
        process.exit(1)
    }
}