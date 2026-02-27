"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitAnswerSchema = exports.SubmitInterestsSchema = exports.UpdateSettingsSchema = exports.JoinRoomSchema = exports.CreateRoomSchema = exports.RoomSchema = exports.RoomStateSchema = exports.QuestionSchema = exports.PlayerSchema = void 0;
const zod_1 = require("zod");
exports.PlayerSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    score: zod_1.z.number(),
    interests: zod_1.z.array(zod_1.z.string()),
    isHost: zod_1.z.boolean(),
    hasSubmittedInterests: zod_1.z.boolean(),
});
exports.QuestionSchema = zod_1.z.object({
    text: zod_1.z.string(),
    options: zod_1.z.array(zod_1.z.string()).length(4),
    answer: zod_1.z.string(),
});
exports.RoomStateSchema = zod_1.z.enum([
    "lobby",
    "collecting_interests",
    "generating",
    "ready",
    "playing",
    "revealing",
    "results",
]);
exports.RoomSchema = zod_1.z.object({
    code: zod_1.z.string(),
    hostId: zod_1.z.string(),
    state: exports.RoomStateSchema,
    players: zod_1.z.array(exports.PlayerSchema),
    questions: zod_1.z.array(exports.QuestionSchema),
    currentQuestion: zod_1.z.number(),
    questionCount: zod_1.z.number(),
    timerSeconds: zod_1.z.number(),
    timerStartedAt: zod_1.z.number(),
    answeredCount: zod_1.z.number(),
    answers: zod_1.z.record(zod_1.z.record(zod_1.z.object({
        choice: zod_1.z.string(),
        timeMs: zod_1.z.number(),
    }))),
});
exports.CreateRoomSchema = zod_1.z.object({
    playerName: zod_1.z.string().min(1).max(24),
});
exports.JoinRoomSchema = zod_1.z.object({
    code: zod_1.z.string().length(6),
    playerName: zod_1.z.string().min(1).max(24),
});
exports.UpdateSettingsSchema = zod_1.z.object({
    questionCount: zod_1.z.number().int().min(5).max(50),
    timerSeconds: zod_1.z.number().int().min(10).max(45),
});
exports.SubmitInterestsSchema = zod_1.z.object({
    interests: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(5),
});
exports.SubmitAnswerSchema = zod_1.z.object({
    choice: zod_1.z.string(),
    timeMs: zod_1.z.number().nonnegative(),
});
