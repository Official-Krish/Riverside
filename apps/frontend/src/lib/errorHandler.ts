import { toast } from "sonner";
import axios from "axios";

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | undefined;
    switch (status) {
      case 400:
        return (
          (data?.message as string) ||
          (data?.errors as Array<{ message: string }>)?.[0]?.message ||
          "Invalid input"
        );
      case 401:
        return "Please sign in to continue";
      case 403:
        return "You don't have permission to do this";
      case 404:
        return "The requested resource was not found";
      case 409:
        return (
          (data?.message as string) ||
          "Conflict — this resource is already in use"
        );
      case 422:
        return (
          (data?.errors as Array<{ message: string }>)
            ?.map((e) => e.message)
            .join(". ") || "Validation failed"
        );
      case 429:
        return "Too many requests. Please wait a moment";
      case 500:
        return "Something went wrong on our end. Please try again";
      default:
        return (data?.message as string) || "An unexpected error occurred";
    }
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

export function handleApiError(
  error: unknown,
  fallback = "Something went wrong",
) {
  const message = getErrorMessage(error);
  toast.error(message || fallback);
  console.error("[API Error]", error);
}
