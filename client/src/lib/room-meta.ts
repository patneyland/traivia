type RoomMeta = {
  roomName?: string;
};

const ROOM_META_PREFIX = "trivia-room-meta:";

export function setRoomMeta(code: string, meta: RoomMeta) {
  try {
    window.sessionStorage.setItem(
      `${ROOM_META_PREFIX}${code.toUpperCase()}`,
      JSON.stringify(meta)
    );
  } catch {
    // Ignore storage failures so gameplay is never blocked.
  }
}

export function getRoomMeta(code: string): RoomMeta | null {
  try {
    const raw = window.sessionStorage.getItem(
      `${ROOM_META_PREFIX}${code.toUpperCase()}`
    );
    if (!raw) return null;
    return JSON.parse(raw) as RoomMeta;
  } catch {
    return null;
  }
}
