import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { EventRecord } from "@/lib/types/event";

export interface WorkspaceNavigationPreparation {
  allowed: boolean;
  event?: EventRecord;
}

type BeforeNavigateHandler = () => Promise<WorkspaceNavigationPreparation>;

interface WorkspaceChromeContextValue {
  leaveWorkspace: () => Promise<void>;
  prepareNavigation: () => Promise<WorkspaceNavigationPreparation>;
  registerBeforeNavigate: (handler: BeforeNavigateHandler) => () => void;
}

const WorkspaceChromeContext = createContext<WorkspaceChromeContextValue | null>(null);

export function WorkspaceChromeProvider({
  leaveWorkspace,
  children,
}: {
  leaveWorkspace: () => void | Promise<void>;
  children: ReactNode;
}) {
  const beforeNavigateRef = useRef<BeforeNavigateHandler | null>(null);

  const registerBeforeNavigate = useCallback((handler: BeforeNavigateHandler) => {
    beforeNavigateRef.current = handler;
    return () => {
      if (beforeNavigateRef.current === handler) beforeNavigateRef.current = null;
    };
  }, []);

  const prepareNavigation = useCallback(async () => {
    return beforeNavigateRef.current
      ? beforeNavigateRef.current()
      : { allowed: true };
  }, []);

  const guardedLeaveWorkspace = useCallback(async () => {
    const preparation = await prepareNavigation();
    if (preparation.allowed) await leaveWorkspace();
  }, [leaveWorkspace, prepareNavigation]);

  const value = useMemo(() => ({
    leaveWorkspace: guardedLeaveWorkspace,
    prepareNavigation,
    registerBeforeNavigate,
  }), [guardedLeaveWorkspace, prepareNavigation, registerBeforeNavigate]);

  return (
    <WorkspaceChromeContext.Provider value={value}>
      {children}
    </WorkspaceChromeContext.Provider>
  );
}

export function useWorkspaceChrome() {
  const context = useContext(WorkspaceChromeContext);
  if (!context) throw new Error("useWorkspaceChrome must be used inside WorkspaceChromeProvider");
  return context;
}
