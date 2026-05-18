export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000/api/v1";

export const WS_RELAYER_URL =
  import.meta.env.VITE_WS_RELAYER_URL || "ws://localhost:9093";

function normalizeJitsi(value: string | undefined) {
  const fallbackBaseUrl = "https://jitsi.krishlabs.tech";

  if (!value || !value.trim()) {
    return {
      baseUrl: fallbackBaseUrl,
      domain: "jitsi.krishlabs.tech",
    };
  }

  const trimmed = value.trim().replace(/\/$/, "");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      return {
        baseUrl: `${parsed.protocol}//${parsed.host}`,
        domain: parsed.host,
      };
    } catch {
      return {
        baseUrl: fallbackBaseUrl,
        domain: "localhost:8000",
      };
    }
  }

  return {
    baseUrl: `https://${trimmed}`,
    domain: trimmed,
  };
}

const jitsiConfig = normalizeJitsi(import.meta.env.VITE_PUBLIC_JITSI_URL);

export const JITSI_BASE_URL = jitsiConfig.baseUrl;
export const JITSI_DOMAIN = jitsiConfig.domain;
