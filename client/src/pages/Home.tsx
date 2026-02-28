import { useLocation } from "wouter";
import { Brain, Crown, Users } from "lucide-react";

export function Home() {
  const [, navigate] = useLocation();

  return (
    <div className="h-screen overflow-hidden bg-gray-50 p-4">
      <div className="mx-auto flex h-full w-full max-w-lg items-center justify-center">
        <div className="w-full space-y-3">
          <div className="space-y-1 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border-[3px] border-gray-800">
                <Brain className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Trivia Quiz</h1>
            <p className="text-sm text-gray-600">
              AI-generated questions based on your interests
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/create-room")}
              className="space-y-2 rounded-lg border-[3px] border-gray-800 bg-white p-4 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-800">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h2 className="mb-0.5 font-semibold">Host a Game</h2>
                <p className="text-xs text-gray-600">
                  Create a room and manage the trivia session
                </p>
              </div>
            </button>

            <button
              onClick={() => navigate("/join-room")}
              className="space-y-2 rounded-lg border-[3px] border-gray-800 bg-white p-4 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-800">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="mb-0.5 font-semibold">Join as Player</h2>
                <p className="text-xs text-gray-600">
                  Enter a room code to play trivia
                </p>
              </div>
            </button>
          </div>

          <div className="space-y-2 rounded-lg border-2 border-gray-800 bg-white p-3">
            <h3 className="text-sm font-semibold">How it works</h3>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-gray-800 text-xs">
                  1
                </div>
                <p className="text-sm">Create or join a room with friends</p>
              </li>
              <li className="flex items-center gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-gray-800 text-xs">
                  2
                </div>
                <p className="text-sm">Share 3 topics you&apos;re interested in</p>
              </li>
              <li className="flex items-center gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-gray-800 text-xs">
                  3
                </div>
                <p className="text-sm">Answer AI-generated trivia questions</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
