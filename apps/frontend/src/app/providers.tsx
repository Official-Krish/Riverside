/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "../components/ui/sonner";
import axios from "axios";
import { handleApiError } from "@/lib/errorHandler";

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        handleApiError(error);
      },
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (
          axios.isAxiosError(error) &&
          error.response?.status &&
          error.response.status < 500
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export function AppProviders({ children }: { children: any }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
