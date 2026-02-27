import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import type { Room as RoomType } from "@trivia/shared";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { PlayerBadge } from "../components/PlayerBadge";
import { ProgressBar } from "../components/ProgressBar";
import { AnswerButton } from "../components/AnswerButton";
import { socket, pendingJoin, clearPendingJoin } from "../lib/socket";

const COLORS: Array<"red" | "blue" | "yellow" | "green"> = [
  "red",
  "blue",
  "yellow",
  "green",
];

export function Room() {
  const [, params] = useRoute("/room/:code");
  const [, navigate] = useLocation();
  const [room, setRoom] = useState<RoomType | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [progress, setProgress] = useState({ message: "", percent: 0 });
  const [error, setError] = useState<string>("");
  const [interests, setInterests] = useState(["", "", ""]);
  const [selectedChoice, setSelectedChoice] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [questionStart, setQuestionStart] = useState<number>(0);

  useEffect(() => {
    // If the room_joined event fired before this component mounted,
    // pick up the cached payload immediately.
    if (pendingJoin) {
      setRoom(pendingJoin.room);
      setPlayerId(pendingJoin.playerId);
      clearPendingJoin();
    }

    const handleJoined = (payload: { room: RoomType; playerId: string }) => {
      setRoom(payload.room);
      setPlayerId(payload.playerId);
      clearPendingJoin();
    };
    const handleUpdated = (payload: { room: RoomType }) => {
      setRoom(payload.room);
    };
    const handleProgress = (payload: { message: string; percent: number }) => {
      setProgress(payload);
    };
    const handleError = (payload: { message: string }) => {
      setError(payload.message);
    };

    socket.on("room_joined", handleJoined);
    socket.on("room_updated", handleUpdated);
    socket.on("generation_progress", handleProgress);
    socket.on("generation_error", handleError);
    socket.on("error", handleError);
    return () => {
      socket.off("room_joined", handleJoined);
      socket.off("room_updated", handleUpdated);
      socket.off("generation_progress", handleProgress);
      socket.off("generation_error", handleError);
      socket.off("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (!params?.code) return;
    if (!room) return;
    if (room.code !== params.code.toUpperCase()) {
      navigate("/");
    }
  }, [params, room, navigate]);

  useEffect(() => {
    if (!room || room.state !== "playing") return;
    if (!room.timerStartedAt) return;
    setSelectedChoice("");
    setQuestionStart(room.timerStartedAt);

    const tick = () => {
      const elapsed = (Date.now() - room.timerStartedAt) / 1000;
      const remaining = Math.max(room.timerSeconds - elapsed, 0);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
      }
    };
    tick(); // set initial value immediately
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [room?.state, room?.currentQuestion]);

  useEffect(() => {
    if (room?.state === "results") {
      confetti({
        particleCount: 140,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [room?.state]);

  const me = useMemo(
    () => room?.players.find((player) => player.id === playerId),
    [room, playerId]
  );

  const isHost = room?.hostId === playerId;
  const question = room?.questions[room.currentQuestion];
  const answers = room?.answers[String(room.currentQuestion)] ?? {};

  if (!room) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <Card>
          <h2 className="font-display text-2xl font-bold">Connecting...</h2>
          <p className="mt-2 text-foreground/70">
            Waiting for room data.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto flex max-w-6xl flex-col gap-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div>
          <h2 className="font-display text-3xl font-bold">Room {room.code}</h2>
          <p className="text-foreground/70">
            {room.state.replace("_", " ")} · {room.players.length} players
          </p>
        </div>
        <div className="rounded-pill border-4 border-foreground bg-white px-4 py-2 text-lg font-bold">
          {me?.name ?? "Guest"} {me?.isHost ? "★" : ""}
        </div>
      </div>

      {room.state === "lobby" && (
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Card>
            <h3 className="font-display text-2xl font-bold">Lobby</h3>
            <p className="mt-2 text-foreground/70">
              Share the room code and get ready.
            </p>
            <div className="mt-4 grid gap-3">
              {room.players.map((player) => (
                <PlayerBadge key={player.id} player={player} />
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-display text-xl font-bold">Host Controls</h3>
            {isHost ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-semibold">
                    Questions: {room.questionCount}
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    value={room.questionCount}
                    className="mt-2 w-full accent-secondary"
                    onChange={(event) =>
                      socket.emit("update_settings", {
                        questionCount: Number(event.target.value),
                        timerSeconds: room.timerSeconds,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">
                    Timer: {room.timerSeconds}s
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={45}
                    value={room.timerSeconds}
                    className="mt-2 w-full accent-accent"
                    onChange={(event) =>
                      socket.emit("update_settings", {
                        questionCount: room.questionCount,
                        timerSeconds: Number(event.target.value),
                      })
                    }
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => socket.emit("collect_interests")}
                >
                  Collect Interests
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-foreground/70">
                Waiting for host to start.
              </p>
            )}
          </Card>
        </div>
      )}

      {room.state === "collecting_interests" && (
        <Card>
          <h3 className="font-display text-2xl font-bold">
            Share Your Interests
          </h3>
          <p className="mt-2 text-foreground/70">
            Add a few things you love. AI will build questions from them.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              {interests.map((interest, index) => (
                <Input
                  key={index}
                  placeholder={`Interest #${index + 1}`}
                  value={interest}
                  onChange={(event) => {
                    const next = [...interests];
                    next[index] = event.target.value;
                    setInterests(next);
                  }}
                />
              ))}
              <Button
                onClick={() =>
                  socket.emit("submit_interests", {
                    interests: interests.filter((item) => item.trim().length > 0),
                  })
                }
              >
                Submit Interests
              </Button>
            </div>
            <div className="space-y-3">
              {room.players.map((player) => (
                <PlayerBadge
                  key={player.id}
                  player={player}
                  status={player.hasSubmittedInterests ? "ready" : "thinking"}
                />
              ))}
              {isHost && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => socket.emit("start_game")}
                >
                  Start Game
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {room.state === "generating" && (
        <Card className="text-center">
          <h3 className="font-display text-2xl font-bold">
            Generating Trivia...
          </h3>
          <p className="mt-2 text-foreground/70">{progress.message}</p>
          <div className="mt-4">
            <ProgressBar value={progress.percent} />
          </div>
        </Card>
      )}

      {room.state === "ready" && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <span className="rounded-pill border-2 border-foreground bg-accent px-4 py-1 text-sm font-bold">
                Question {room.currentQuestion + 1} of {room.questions.length}
              </span>
              <h3 className="mt-6 font-display text-3xl font-bold">
                Get Ready!
              </h3>
              <p className="mt-2 text-foreground/70">
                {isHost
                  ? "Press the button below when everyone is ready."
                  : "Waiting for the host to start the question..."}
              </p>
              {isHost && (
                <Button
                  className="mt-6"
                  onClick={() => socket.emit("start_question")}
                >
                  Start Question
                </Button>
              )}
            </motion.div>
          </Card>

          <Card>
            <h4 className="font-display text-xl font-bold">Scores</h4>
            <div className="mt-4 space-y-3">
              {room.players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-3xl border-2 border-foreground bg-white px-4 py-2 font-semibold"
                  >
                    <span>{player.name}</span>
                    <span>{player.score}</span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {room.state === "playing" && question && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <div className="flex items-center justify-between">
              <span className="rounded-pill border-2 border-foreground bg-accent px-3 py-1 text-xs font-bold">
                {room.currentQuestion + 1}/{room.questions.length}
              </span>
              <span className="text-lg font-semibold">
                {Math.ceil(timeLeft)}s left
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar value={(timeLeft / room.timerSeconds) * 100} />
            </div>
            <h3 className="mt-6 font-display text-2xl font-bold">
              {question.text}
            </h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {question.options.map((option, index) => (
                <AnswerButton
                  key={option}
                  label={option}
                  color={COLORS[index]}
                  selected={selectedChoice === option}
                  disabled={!!selectedChoice}
                  onClick={() => {
                    const elapsed = Date.now() - questionStart;
                    setSelectedChoice(option);
                    socket.emit("submit_answer", { choice: option, timeMs: elapsed });
                  }}
                />
              ))}
            </div>
          </Card>

          <Card>
            <h4 className="font-display text-xl font-bold">Answers</h4>
            <div className="mt-4 flex items-center justify-center">
              <div className="text-center">
                <div className="font-display text-4xl font-bold">
                  {room.answeredCount}/{room.players.length}
                </div>
                <p className="mt-1 text-sm text-foreground/70">
                  players answered
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {room.players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-3xl border-2 border-foreground bg-white px-4 py-2 font-semibold"
                  >
                    <span>{player.name}</span>
                    <span>{player.score}</span>
                  </div>
                ))}
            </div>
            {isHost && (
              <Button
                variant="secondary"
                className="mt-6 w-full"
                onClick={() => socket.emit("reveal_answer")}
              >
                Skip Timer
              </Button>
            )}
          </Card>
        </div>
      )}

      {room.state === "revealing" && question && (
        <Card>
          <h3 className="font-display text-2xl font-bold">Answer Reveal</h3>
          <p className="mt-2 text-foreground/70">Correct answer:</p>
          <div className="mt-3 rounded-pill border-4 border-foreground bg-accent px-6 py-3 text-xl font-bold">
            {question.answer}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {question.options.map((option) => {
              const count = Object.values(answers).filter(
                (entry) => entry.choice === option
              ).length;
              return (
                <div
                  key={option}
                  className="flex items-center justify-between rounded-3xl border-2 border-foreground bg-white px-4 py-2"
                >
                  <span className="font-semibold">{option}</span>
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}
          </div>
          {isHost && (
            <Button
              className="mt-6 w-full"
              onClick={() => socket.emit("next_question")}
            >
              {room.currentQuestion + 1 >= room.questions.length
                ? "See Results"
                : "Next Question"}
            </Button>
          )}
        </Card>
      )}

      {room.state === "results" && (
        <Card className="text-center">
          <h3 className="font-display text-3xl font-bold">Final Results</h3>
          <p className="mt-2 text-foreground/70">
            Thanks for playing! Top scorers below.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {room.players
              .slice()
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
              .map((player, index) => (
                <div
                  key={player.id}
                  className="rounded-3xl border-4 border-foreground bg-white px-4 py-4"
                >
                  <div className="text-4xl font-bold">{index + 1}</div>
                  <div className="mt-2 text-xl font-semibold">
                    {player.name}
                  </div>
                  <div className="text-lg">{player.score} pts</div>
                </div>
              ))}
          </div>
          <div className="mt-6 space-y-2">
            {room.players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-3xl border-2 border-foreground bg-white px-4 py-2"
                >
                  <span>{player.name}</span>
                  <span>{player.score}</span>
                </div>
              ))}
          </div>
          {isHost && (
            <Button
              className="mt-6"
              onClick={() => {
                socket.emit("collect_interests");
              }}
            >
              Play Again
            </Button>
          )}
        </Card>
      )}

      {error && (
        <div className="rounded-3xl border-4 border-foreground bg-destructive/20 px-4 py-3 text-center font-semibold">
          {error}
        </div>
      )}
    </motion.div>
  );
}
