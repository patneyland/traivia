import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { socket } from "../lib/socket";

export function Home() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleJoined = (payload: { room: { code: string } }) => {
      navigate(`/room/${payload.room.code}`);
    };

    const handleError = (payload: { message: string }) => {
      setError(payload.message);
    };

    socket.on("room_joined", handleJoined);
    socket.on("error", handleError);
    return () => {
      socket.off("room_joined", handleJoined);
      socket.off("error", handleError);
    };
  }, [navigate]);

  return (
    <motion.div
      className="mx-auto flex max-w-5xl flex-col gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="text-center">
        <h1 className="font-display text-5xl font-bold text-foreground md:text-7xl">
          TRIVIA AI
        </h1>
        <p className="mt-2 text-lg text-foreground/70">
          Every round is made just for your crew.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl font-bold">Create a Room</h2>
          <p className="mt-2 text-foreground/70">
            Start a new game and invite friends.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Your display name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => socket.emit("create_room", { playerName: name })}
            >
              Create Room
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl font-bold">Join a Room</h2>
          <p className="mt-2 text-foreground/70">
            Enter the room code from your host.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Room code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Input
              placeholder="Your display name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                socket.emit("join_room", { code: code.toUpperCase(), playerName: name })
              }
            >
              Join Room
            </Button>
          </div>
        </Card>
      </div>

      {error && (
        <div className="rounded-3xl border-4 border-foreground bg-destructive/20 px-4 py-3 text-center font-semibold">
          {error}
        </div>
      )}
    </motion.div>
  );
}
