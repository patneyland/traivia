# AI Trivia

AI builds a trivia game live from your group's interests, grounded in real web-searched facts.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

> ▶ Play live: `<ADD RAILWAY URL>`

<!--
  SCREENSHOT + GIF: add the two files below under docs/, then move the two
  image lines out of this comment so they render on GitHub.
    - docs/screenshot.png : the lobby on a TV/laptop showing the 6-char code + QR
    - docs/gameplay.gif    : a short clip of a timed question -> reveal -> leaderboard with confetti

![AI Trivia lobby with join code and QR](docs/screenshot.png)
![AI Trivia gameplay](docs/gameplay.gif)
-->

## What it does

One person hosts on a big screen. Everyone else plays on their phones.

1. The host creates a room and gets a 6-character join code plus a QR code on screen.
2. Players scan the QR (or type the code), enter a name, and join the lobby.
3. Each player types up to five things they care about: bands, sports teams, hometowns, hobbies, whatever.
4. Once everyone has submitted, the host starts the game. The AI pipeline runs and writes a fresh question set built from the combined interests.
5. Players answer multiple-choice questions against a timer. Answer faster to score more.
6. After each question the correct answer is revealed and scores update. The final results screen ranks everyone and fires confetti for the winner.

The host holds the authoritative game state. Players never see the correct answer or the timer math early: the server strips answers out of the room snapshot it broadcasts during a live question.

## The AI pipeline

This is the part worth reading the code for: `server/src/ai/pipeline.ts`.

When the host starts a game, every player's interests are pooled and run through four Claude calls in sequence. Each prompt lives as a plain text file under `prompts/` and is filled in at runtime.

```
player interests
      |
      v
[1] topic expansion        each interest -> a handful of specific subtopics
      |
      v
[2] fact extraction        web_search tool finds one verifiable fact per subtopic
      |   (live web search)
      v
[3] question formulation   facts -> clear multiple-choice question stems
      |
      v
[4] distractor generation  add three plausible wrong answers per question
      |
      v
validated questions -> the game
```

Details that matter:

- **Model:** every call uses `claude-sonnet-4-20250514` via the official Anthropic SDK (`@anthropic-ai/sdk`).
- **Live web search:** stage 2 is the only call with a tool attached. It uses Anthropic's `web_search` tool (`web_search_20250305`, capped at 5 uses) so facts come from the current web rather than the model's memory. That keeps questions specific and checkable instead of generic.
- **Zod at every stage:** each call returns JSON, which is parsed and validated against a stage-specific Zod schema before the next stage runs. The distractor stage, for example, requires exactly four options per question. A malformed response fails loudly instead of corrupting the game.
- **Cost logging:** every Claude call logs token counts and an estimated USD cost (priced at $3 / 1M input tokens, $15 / 1M output tokens), tagged with the room code and a run id. A per-run summary logs total calls, total tokens, and total cost. The full pipeline runs at temperature 0.4 with a 4096-token cap per call.

Progress events stream back to the room over Socket.IO as each stage runs, so players see "Researching facts..." and "Generating answer options..." while they wait.

## Architecture

A TypeScript monorepo with three npm workspaces:

- **`shared/`** is the source of truth. It holds the Zod schemas for rooms, players, and questions, plus the typed Socket.IO event contracts (`ClientToServerEvents` / `ServerToClientEvents`). Both the client and server import from here, so a change to the wire format is a compile error on both sides, not a runtime surprise.
- **`server/`** is Express + Socket.IO. An in-memory room manager owns all game state and timers; socket handlers validate every inbound payload with the shared schemas, run the AI pipeline, score answers, and broadcast room updates.
- **`client/`** is React + Vite with Tailwind, `wouter` for routing, `framer-motion` for animation, `qrcode.react` for the join QR, and `canvas-confetti` for the win screen.

```
phones / host screen
        |
   Socket.IO  (events typed by shared/)
        |
   socket handlers  ->  room manager (in-memory state + timers)
        |
   AI pipeline  ->  Claude (4 stages, web search in stage 2)
```

Scoring is speed-based: a correct answer earns up to 1000 points scaled down by how much of the timer elapsed before you answered. Wrong or missed answers earn zero. A question reveals as soon as every player has answered, or when the timer expires.

## Tech stack

| Area | Choice |
| --- | --- |
| Language | TypeScript 5.4 |
| Frontend | React 18, Vite 5, Tailwind 3, wouter, framer-motion |
| Realtime | Socket.IO 4.7 (client + server) |
| Backend | Node 20, Express 4 |
| AI | Anthropic SDK 0.29, model `claude-sonnet-4-20250514`, `web_search` tool |
| Validation | Zod 3 (shared schemas) |
| Build / deploy | npm workspaces, multi-stage Docker, Railway |

## Run it locally

You need Node 20+ and an Anthropic API key.

```bash
# 1. install all workspaces
npm install

# 2. set up env
cp .env.example .env
#    then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. start both dev servers
npm run dev
```

The client runs on `http://localhost:5173` and the server on `http://localhost:3000`. The only required environment variable is `ANTHROPIC_API_KEY`; `PORT`, `NODE_ENV`, and `CLIENT_ORIGIN` are optional.

To open the QR-join flow from a phone on the same network, point the phone at the machine's LAN address rather than `localhost`.

## Deploy

The repo ships a multi-stage `Dockerfile`: stage one installs the workspaces and builds shared, server, then client; stage two copies only the built artifacts and production dependencies. `railway.toml` points Railway at that Dockerfile and sets a `/health` healthcheck with an on-failure restart policy.

In production (`NODE_ENV=production`) the server serves the built client from `client/dist` and falls back to `index.html`, so a single service hosts both the API and the front end. Railway provides `PORT` at runtime.

## Known limitations

- **Rooms are in-memory.** All game state lives in `Map`s in the server process (`server/src/room-manager.ts`). A restart or redeploy drops every active room. There is no database.
- **One server process.** Because state is in-memory, the server does not scale horizontally as written; it assumes a single instance.
- **Host is a single point of failure.** If the host disconnects, the room closes for everyone.
- **No auth or persistence.** No accounts, no saved history, no reconnect-into-an-existing-game.

## License

MIT.

## Author

Built by Patrick Neyland, [Neyland Solutions](https://neylandsolutions.com).
