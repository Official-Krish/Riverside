import { constants, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, type KeyObject } from "node:crypto";
import { redisPublisher } from "./redis";
import { prisma } from "@repo/db/client";

type ServerKeyPair = {
  publicKey: KeyObject;
  privateKey: KeyObject;
  publicKeyPem: string;
  publicKeyJwk: JsonWebKey;
};

let serverKeyPair: ServerKeyPair | null = null;

const WRAPPED_CEK_TTL_SECONDS = 7 * 24 * 60 * 60;

function buildWrappedCekKey(meetingId: string, participantId: string) {
    return `meeting:wrapped-cek:${meetingId}:${participantId}`;
}

export async function ensureServerKeyPair(): Promise<ServerKeyPair> {
    if (serverKeyPair) {
        return serverKeyPair;
    }

    // Try to load from database
    let keyPairRecord = await prisma.serverKeyPair.findUnique({
        where: { id: "singleton" },
    });

    // If not found, generate and store
    if (!keyPairRecord) {
        const { publicKey, privateKey } = generateKeyPairSync("rsa", {
            modulusLength: 4096,
            publicKeyEncoding: { format: "pem", type: "spki" },
            privateKeyEncoding: { format: "pem", type: "pkcs8" },
        });

        keyPairRecord = await prisma.serverKeyPair.create({
            data: {
                id: "singleton",
                publicKeyPem: publicKey,
                privateKeyPem: privateKey,
                algorithm: "RSA-OAEP-256",
                modulusLength: 4096,
            },
        });
    }

    const publicKeyObject = createPublicKey(keyPairRecord.publicKeyPem);
    const privateKeyObject = createPrivateKey(keyPairRecord.privateKeyPem);

    serverKeyPair = {
        publicKey: publicKeyObject,
        privateKey: privateKeyObject,
        publicKeyPem: keyPairRecord.publicKeyPem,
        publicKeyJwk: publicKeyObject.export({ format: "jwk" }) as JsonWebKey,
    };

    return serverKeyPair;
}

export async function getServerPublicKeyJwk(): Promise<JsonWebKey> {
    const pair = await ensureServerKeyPair();
    return pair.publicKeyJwk;
}

export async function unwrapServerCiphertext(ciphertext: Buffer): Promise<Buffer> {
    const { privateKey } = await ensureServerKeyPair();
    return privateDecrypt(
        {
            key: privateKey,
            oaepHash: "sha256",
            padding: constants.RSA_PKCS1_OAEP_PADDING,
        },
        ciphertext
    );
}

export async function storeWrappedMeetingCek(
    meetingId: string,
    participantId: string,
    wrappedCek: number[]
) {
    const key = buildWrappedCekKey(meetingId, participantId);

    await redisPublisher.hset(
        key,
        "meetingId",
        meetingId,
        "participantId",
        participantId,
        "wrappedCek",
        JSON.stringify(wrappedCek)
    );
    await redisPublisher.expire(key, WRAPPED_CEK_TTL_SECONDS);
}
