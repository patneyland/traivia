import type { Server, Socket } from "socket.io";
import {
  CreateRoomSchema,
  JoinRoomSchema,
  SubmitAnswerSchema,
  SubmitInterestsSchema,
  UpdateSettingsSchema,
} from "@trivia/shared";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@trivia/shared";
import {
  advanceQuestion,
  allPlayersAnswered,
  allPlayersSubmitted,
  clearInterests,
  clearTimer,
  createRoom,
  getAnsweredCount,
  getRoomByCode,
  getRoomForPlayer,
  joinRoom,
  recordAnswer,
  removePlayer,
  resetForNewRound,
  setPlayerInterests,
  setRoomQuestions,
  setRoomState,
  startTimer,
  updateSettings,
} from "./room-manager";
import { generateQuestions } from "./ai/pipeline";

function publicRoom(room: ReturnType<typeof getRoomByCode>) {
  if (!room) return null;
  // Always compute the live answered count
  const answeredCount = getAnsweredCount(room);
  if (room.state !== "playing") return { ...room, answeredCount };
  return {
    ...room,
    answeredCount,
    questions: room.questions.map((question) => ({
      ...question,
      answer: "",
    })),
    answers: {},
  };
}

function emitRoom(io: Server, roomCode: string) {
  const room = getRoomByCode(roomCode);
  if (!room) return;
  io.to(roomCode).emit("room_updated", { room: publicRoom(room)! });
}

function scoreAnswer(
  isCorrect: boolean,
  timeMs: number,
  timerSeconds: number
): number {
  if (!isCorrect) return 0;
  const maxMs = timerSeconds * 1000;
  const ratio = Math.min(Math.max(timeMs / maxMs, 0), 1);
  const score = Math.round(1000 * (1 - ratio));
  return Math.max(0, score);
}

function revealCurrentQuestion(
  room: NonNullable<ReturnType<typeof getRoomByCode>>
): void {
  clearTimer(room.code);
  const question = room.questions[room.currentQuestion];
  if (!question) return;

  const key = String(room.currentQuestion);
  const answers = room.answers[key] ?? {};
  room.players = room.players.map((player) => {
    const submission = answers[player.id];
    if (!submission) return player;
    const earned = scoreAnswer(
      submission.choice === question.answer,
      submission.timeMs,
      room.timerSeconds
    );
    return { ...player, score: player.score + earned };
  });

  setRoomState(room, "revealing");
}

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) {
  socket.on("create_room", (payload) => {
    const parsed = CreateRoomSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", { message: "Invalid player name." });
      return;
    }
    const room = createRoom(socket.id, parsed.data.playerName);
    socket.join(room.code);
    socket.emit("room_joined", { room: publicRoom(room)!, playerId: socket.id });
  });

  socket.on("join_room", (payload) => {
    const parsed = JoinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", { message: "Invalid room code or name." });
      return;
    }
    const code = parsed.data.code.toUpperCase();
    const room = joinRoom(code, socket.id, parsed.data.playerName);
    if (!room) {
      socket.emit("error", { message: "Room not found." });
      return;
    }
    socket.join(code);
    socket.emit("room_joined", { room: publicRoom(room)!, playerId: socket.id });
    emitRoom(io, code);
  });

  socket.on("update_settings", (payload) => {
    const parsed = UpdateSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", { message: "Invalid settings." });
      return;
    }
    const room = getRoomForPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    updateSettings(room, parsed.data);
    emitRoom(io, room.code);
  });

  socket.on("collect_interests", () => {
    const room = getRoomForPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.state === "results") {
      resetForNewRound(room);
    }
    clearInterests(room);
    setRoomState(room, "collecting_interests");
    emitRoom(io, room.code);
  });

  socket.on("submit_interests", (payload) => {
    const parsed = SubmitInterestsSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", { message: "Invalid interests." });
      return;
    }
    const room = getRoomForPlayer(socket.id);
    if (!room) return;
    setPlayerInterests(room, socket.id, parsed.data.interests);
    emitRoom(io, room.code);
  });

  socket.on("start_game", async () => {
    const room = getRoomForPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (!allPlayersSubmitted(room)) {
      socket.emit("error", { message: "All players must submit interests." });
      return;
    }
    setRoomState(room, "generating");
    emitRoom(io, room.code);

    const interests = room.players.flatMap((player) => player.interests);
    try {
      const questions = await generateQuestions(
        interests,
        room.questionCount,
        (progress) => {
          io.to(room.code).emit("generation_progress", progress);
        }
      );
      setRoomQuestions(room, questions);
      setRoomState(room, "ready");
      emitRoom(io, room.code);
    } catch (error) {
      console.error("[start_game] Question generation failed:", error);
      setRoomState(room, "lobby");
      emitRoom(io, room.code);
      io.to(room.code).emit("generation_error", {
        message: "Failed to generate questions.",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("submit_answer", (payload) => {
    const parsed = SubmitAnswerSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", { message: "Invalid answer submission." });
      return;
    }
    const room = getRoomForPlayer(socket.id);
    if (!room || room.state !== "playing") return;
    const key = String(room.currentQuestion);
    if (room.answers[key]?.[socket.id]) return;
    recordAnswer(room, room.currentQuestion, socket.id, parsed.data);

    // Auto-reveal when all players have answered
    if (allPlayersAnswered(room)) {
      revealCurrentQuestion(room);
    }

    emitRoom(io, room.code);
  });

  socket.on("reveal_answer", () => {
    const room = getRoomForPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== "playing") return;
    revealCurrentQuestion(room);
    emitRoom(io, room.code);
  });

  socket.on("next_question", () => {
    const room = getRoomForPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== "revealing") return;
    if (room.currentQuestion + 1 >= room.questions.length) {
      setRoomState(room, "results");
    } else {
      advanceQuestion(room);
      setRoomState(room, "ready");
    }
    emitRoom(io, room.code);
  });

  socket.on("start_question", () => {
    const room = getRoomForPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== "ready") return;

    setRoomState(room, "playing");
    startTimer(room, () => {
      // Timer expired — auto-reveal, scoring unanswered players as 0
      revealCurrentQuestion(room);
      emitRoom(io, room.code);
    });
    emitRoom(io, room.code);
  });

  socket.on("disconnect", () => {
    const roomCode = getRoomForPlayer(socket.id)?.code;
    const room = removePlayer(socket.id);
    if (!room && roomCode) {
      // Room was deleted (last player left) — clean up timer
      clearTimer(roomCode);
      return;
    }
    if (!room) return;
    emitRoom(io, room.code);
  });
}
