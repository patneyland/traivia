import dotenv from "dotenv";
import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./socket-handlers";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@trivia/shared";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== "production";
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: isDev ? true : process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  },
});

app.get("/health", (_req, res) => res.send("ok"));

if (process.env.NODE_ENV === "production") {
  const clientPath = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
