import jwt from "jsonwebtoken";

export function getWorkerServiceJwtSecret(): string {
    const secret = process.env.WORKER_SERVICE_JWT_SECRET || process.env.WORKER_SERVICE_TOKEN;
    if (!secret || secret === "WORKER_SERVICE_TOKEN" || secret === "WORKER_SERVICE_JWT_SECRET") {
        throw new Error("Worker service JWT secret must be configured and must not use the default placeholder value.");
    }
    return secret;
}

export function getBackendServiceToken(): string {
    return jwt.sign(
        { scope: "worker-service" },
        getWorkerServiceJwtSecret(),
        {
            algorithm: "HS256",
            expiresIn: "60s",
            audience: "weave-backend",
            issuer: "weave-worker",
        },
    );
}

export function getPositiveIntegerEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    if (!Number.isInteger(value) || value < 1) {
        return fallback;
    }
    return value;
}

export function getEnv(key: string, fallback: string): string {
    return process.env[key] || fallback;
}

export function getEnvNumber(key: string, fallback: number): number {
    return Number(process.env[key] || fallback);
}

export function getBackendUrl(): string {
    return process.env.BACKEND_URL || "http://localhost:3000/api/v1";
}