import { useEffect, useState } from "react";
import { http } from "../https";
import { clearStoredAuth, getStoredName, getStoredToken, setStoredName } from "../lib/auth";
import type { UserProfileResponse } from "@repo/types/api";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return getStoredToken();
  });
  const [name, setName] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return getStoredName();
  });

  useEffect(() => {
    const syncAuth = () => {
      setToken(getStoredToken());
      setName(getStoredName());
    };

    window.addEventListener("weave-auth-changed", syncAuth);
    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("weave-auth-changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  useEffect(() => {
    if (!token || name) {
      return;
    }

    let cancelled = false;

    const restoreName = async () => {
      try {
        const response = await http.get<UserProfileResponse>("/user/me");
        const restoredName = response.data.user.name?.trim();

        if (!cancelled && restoredName) {
          setStoredName(restoredName);
          setName(restoredName);
        }
      } catch {
        // If the token is invalid, the HTTP interceptor will clear auth.
      }
    };

    void restoreName();

    return () => {
      cancelled = true;
    };
  }, [name, token]);

  return {
    token,
    name,
    isAuthenticated: Boolean(token),
    signOut: clearStoredAuth,
  };
}
