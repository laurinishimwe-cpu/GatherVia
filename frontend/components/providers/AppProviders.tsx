"use client";

import { ThemeProvider } from "./ThemeProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/context/AuthContext";
import { EventProvider } from "@/context/EventContext";
import { SetupFlowProvider } from "@/context/SetupFlowContext";
import { ToastProvider } from "./ToastProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  return (
  <ToastProvider>
    <ThemeProvider>
      <GoogleOAuthProvider clientId={clientId}>
        <AuthProvider>
          <EventProvider>
            <SetupFlowProvider>
              {children}
            </SetupFlowProvider>
          </EventProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  </ToastProvider>
  );
}
