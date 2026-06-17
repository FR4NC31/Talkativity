# Talkativity

A real-time chat application with video/audio calling, built with React, Express, Socket.io, and MongoDB.

## Features

### Messaging
- Real-time text messaging via Socket.io
- Image and video sharing (powered by ImageKit)
- Message reply, edit, and delete
- Emoji picker
- Typing indicator
- URL auto-linking in messages

### Calling
- WebRTC-based video and audio calls
- Incoming call modal with accept/decline
- Call duration tracking
- Missed call notifications
- Call history in chat

### UI/UX
- Mobile-responsive design with Tailwind CSS v4
- Dark/light theme with accent color presets
- Chat wallpapers
- Online/offline status indicators
- Keyboard sound effects (optional)
- HeroUI component library

### Auth
- Clerk authentication (email, Google, GitHub, etc.)
- Protected routes and middleware

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, HeroUI 3 |
| Backend | Express 5, Mongoose 9, Socket.io 4 |
| Auth | Clerk |
| Media | ImageKit |
| State | Zustand |
| Real-time | Socket.io (both directions) |
| Deployment | Docker |

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB instance (local or Atlas)
- ImageKit account (for media uploads)
- Clerk account (for authentication)

### Installation

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` (frontend) and `http://localhost:3000` (backend).

### Docker

```bash
docker build -t talkativity .
docker run -p 3000:3000 talkativity
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── lib/            # Socket.io, ImageKit, etc.
│   │   ├── middleware/      # Auth, upload
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routes
│   │   ├── seeds/          # Database seed scripts
│   │   └── app.js          # Server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components (auth, call, chat)
│   │   ├── context/        # React context providers
│   │   ├── data/           # Static data (wallpapers, presets)
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities, Axios instance
│   │   ├── pages/          # Route pages
│   │   ├── store/          # Zustand stores
│   │   └── main.jsx        # App entry point
│   └── package.json
├── Dockerfile
└── README.md
```
