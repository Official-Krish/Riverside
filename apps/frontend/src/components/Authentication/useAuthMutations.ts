/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
import { useMutation } from "@tanstack/react-query";
import { persistAuth, setStoredName } from "../../lib/auth";
import { getHttpErrorMessage } from "../../lib/httpError";
import { useNavigate } from "react-router-dom";
import type { LoginResponse, SignupResponse } from "@repo/types/api";
import { http } from "../../https";

export function useLogin(setErrorMessage: (msg: string | null) => void) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const response = await http.post<
        LoginResponse & { code?: string; email?: string }
      >("/user/login", { email, password });
      return response.data;
    },
    onSuccess: (data) => {
      persistAuth(data.token, data.name);
      navigate("/dashboard");
    },
    onError: (error: any) => {
      const errorCode = error.response?.data?.code;
      const email = error.response?.data?.email;

      if (errorCode === "EMAIL_NOT_VERIFIED") {
        setErrorMessage(
          "Email not verified. Please check your inbox and verify your email.",
        );
        if (email) {
          setTimeout(() => {
            navigate(`/verify-pending?email=${encodeURIComponent(email)}`);
          }, 2000);
        }
      } else {
        setErrorMessage(
          getHttpErrorMessage(
            error,
            "Could not sign you in. Check your email and password.",
          ),
        );
      }
    },
  });
}

export function useSignup(setErrorMessage: (msg: string | null) => void) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
    }: {
      name: string;
      email: string;
      password: string;
    }) => {
      const response = await http.post<SignupResponse>("/user/signup", {
        name,
        email,
        password,
      });
      return response.data;
    },
    //@ts-ignore
    onSuccess: (data, variables) => {
      setStoredName(variables.name);
      navigate(`/verify-pending?email=${encodeURIComponent(variables.email)}`);
    },
    onError: (error) => {
      setErrorMessage(
        getHttpErrorMessage(
          error,
          "Could not create your account. Try a different email.",
        ),
      );
    },
  });
}

export function useVerifyEmail() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await http.post<{ message: string; token: string }>(
        "/user/verify-email",
        {
          email,
          code,
        },
      );
      return response.data;
    },
    onSuccess: (data) => {
      persistAuth(data.token, "");
      navigate("/signin");
    },
  });
}

export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await http.post<{ message: string }>(
        "/user/resend-verification-email",
        { email },
      );
      return response.data;
    },
  });
}

export function useGoogleAuth(setErrorMessage: (msg: string | null) => void) {
  const startGoogleLogin = async () => {
    try {
      const response = await http.get<{ url: string }>("/google/auth/url");
      window.location.href = response.data.url;
    } catch {
      setErrorMessage("Failed to initiate Google login.");
    }
  };

  return { startGoogleLogin };
}
