const MEETING_CEK_STORAGE_PREFIX = "weave-meeting-cek:";

/** Always use the trimmed room id so persist/read keys match. */
export function getMeetingCekStorageId(meetingIdOrRoom: string): string {
  return meetingIdOrRoom.trim();
}

export function generateMeetingCek() {
  const cek = new Uint8Array(32);
  window.crypto.getRandomValues(cek);
  return cek;
}

export function persistMeetingCek(meetingId: string, cek: Uint8Array) {
  const storageId = getMeetingCekStorageId(meetingId);
  window.sessionStorage.setItem(
    `${MEETING_CEK_STORAGE_PREFIX}${storageId}`,
    JSON.stringify(Array.from(cek)),
  );
}

export function readMeetingCek(meetingId: string) {
  const storageId = getMeetingCekStorageId(meetingId);
  const stored = window.sessionStorage.getItem(
    `${MEETING_CEK_STORAGE_PREFIX}${storageId}`,
  );
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as number[];
    return new Uint8Array(parsed);
  } catch {
    return null;
  }
}

export async function wrapMeetingCek(publicKey: JsonWebKey, cek: Uint8Array) {
  const importedKey = await window.crypto.subtle.importKey(
    "jwk",
    publicKey,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"],
  );

  const cekBuffer = cek.buffer.slice(
    cek.byteOffset,
    cek.byteOffset + cek.byteLength,
  ) as ArrayBuffer;

  const wrapped = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    importedKey,
    cekBuffer,
  );

  return Array.from(new Uint8Array(wrapped));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

/**
 * Deterministic IV per chunk. Uses auth user id (stable) + sequence — not Jitsi ids.
 */
async function deriveChunkIv(authUserId: string, sequenceNumber: number) {
  const payload = `${authUserId}:${sequenceNumber}`;
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return new Uint8Array(digest).slice(0, 12);
}

export async function encryptMeetingChunk({
  meetingId,
  authUserId,
  sequenceNumber,
  chunk,
}: {
  meetingId: string;
  authUserId: string;
  sequenceNumber: number;
  chunk: Blob;
}) {
  const storageId = getMeetingCekStorageId(meetingId);
  const cek = readMeetingCek(storageId);
  if (!cek) {
    throw new Error(
      "Meeting CEK not found. Rejoin the meeting to continue recording.",
    );
  }

  if (cek.length !== 32) {
    throw new Error(
      "Invalid meeting CEK length. Rejoin the meeting to continue recording.",
    );
  }

  const key = await window.crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const iv = await deriveChunkIv(authUserId, sequenceNumber);
  const plaintext = await chunk.arrayBuffer();

  if (plaintext.byteLength === 0) {
    throw new Error("Cannot encrypt an empty recording chunk");
  }

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    plaintext,
  );

  return {
    encryptedChunk: new Blob([encrypted], { type: "application/octet-stream" }),
    ivBase64: bytesToBase64(iv),
    algorithm: "AES-GCM" as const,
    tagBits: 128,
    sourceMimeType: chunk.type || "video/webm",
  };
}
