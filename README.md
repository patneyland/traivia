# Trivia AI

Real-time multiplayer trivia game where questions are generated from player interests using AI.

## Quick Start

1. Copy env file and add your Anthropic API key.
2. Install dependencies: `npm install`
3. Run dev servers: `npm run dev`

Client runs on `http://localhost:5173` and server on `http://localhost:3000` by default.

## Structure

- `client/`: React + Vite frontend
- `server/`: Express + Socket.IO backend
- `shared/`: Shared Zod schemas
- `prompts/`: AI prompt files used by the pipeline
