# Relay 💬

A real-time chat application built with FastAPI and React, similar to Discord/Slack.

## Features

- **Authentication** — Register and login with JWT-based auth
- **Rooms** — Create, join, and leave chat rooms
- **Real-time messaging** — Instant messages via WebSockets
- **Active users** — See who is online in each room in real time
- **Typing indicators** — See when others are typing
- **Unread messages** — Unread count badge and new message divider
- **Message deletion** — Delete your own messages
- **Markdown formatting** — Bold, italic, code blocks, quotes in messages
- **Message search** — Search messages with jump-to-message
- **Room discovery** — Browse available rooms and join/leave freely

## Tech Stack

**Backend**
- FastAPI — async Python web framework
- SQLAlchemy — ORM for database models
- SQLite — lightweight persistent database
- JWT — stateless authentication
- WebSockets — real-time bidirectional communication

**Frontend**
- React + Vite — fast frontend tooling
- Tailwind CSS — utility-first styling
- Axios — HTTP client with JWT interceptor
- react-markdown — markdown rendering in messages

## Design Decisions

- **WebSockets for presence** — Active users are tracked via live WebSocket connections. When a user connects to a room they are added to the connection manager, and removed on disconnect. This is broadcast to all room members in real time.
- **SQLite for persistence** — Messages survive server restarts. In production this would be replaced with PostgreSQL for better concurrency and scale.
- **JWT authentication** — Stateless auth passed as a query param on WebSocket connections since WebSocket headers are not easily customizable in browsers.
- **Separation of concerns** — Backend is split into routers, models, schemas, and a WebSocket connection manager for clean maintainability.
- **Single unread divider** — Unread position is stored per user per room in a LastRead table, allowing accurate divider placement across sessions.

## Running Locally

### Prerequisites
- Python 3.9+
- Node.js 18+

### Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

### Frontend
cd frontend
npm install
npm run dev

Open http://localhost:5173

## What I'd Improve With More Time

- Complete Read Reciept implementation - IN PROGRESS
- Replace SQLite with PostgreSQL for production scale
- Add file and image upload support
- Add end-to-end encryption
- Deploy to cloud (Railway/Render for backend, Vercel for frontend)
- Add unit and integration tests
- Add rate limiting on messages to prevent spam
- Add user avatars and profiles