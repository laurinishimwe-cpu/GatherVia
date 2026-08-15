"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { uploadFlyer } from "@/lib/api/flyers";
import {
  DEFAULT_SETUP_FLOW,
  persistSetupFlow,
  readSetupFlow,
  type SetupFlowState,
} from "@/lib/session/setup-flow";
import type { FlyerConfiguration } from "@/lib/types/flyer";
import type { PricingQuote } from "@/lib/types/pricing";

interface SetupFlowContextValue extends SetupFlowState {
  setGuestCapacity: (value: number) => void;
  setEventTitle: (value: string) => void;
  setFlyerDraft: (input: {
    file: File;
    previewUrl: string;
    configuration: FlyerConfiguration;
    templateId?: string | null;
    templateTitle?: string | null;
  }) => void;
  clearFlyerDraft: () => void;
  updateFlyerConfiguration: (configuration: FlyerConfiguration) => void;
  saveFlyerToBackend: () => Promise<string>;
  setPricingQuote: (quote: PricingQuote) => void;
  resetSetupFlow: () => void;
}

const SetupFlowContext = createContext<SetupFlowContextValue | undefined>(
  undefined,
);

export function SetupFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SetupFlowState>(() => readSetupFlow());
  const [draftFile, setDraftFile] = useState<File | null>(null);

  const commitState = useCallback(
    (updater: SetupFlowState | ((previous: SetupFlowState) => SetupFlowState)) => {
      setState((previous) => {
        const next =
          typeof updater === "function" ? updater(previous) : updater;
        persistSetupFlow(next);
        return next;
      });
    },
    [],
  );

  const setGuestCapacity = useCallback(
    (value: number) => {
      commitState((previous) => ({ ...previous, guestCapacity: value }));
    },
    [commitState],
  );

  const setEventTitle = useCallback(
    (value: string) => {
      commitState((previous) => ({ ...previous, eventTitle: value }));
    },
    [commitState],
  );

  const setFlyerDraft = useCallback(
    (input: {
      file: File;
      previewUrl: string;
      configuration: FlyerConfiguration;
      templateId?: string | null;
      templateTitle?: string | null;
    }) => {
      setDraftFile(input.file);
      commitState((previous) => ({
        ...previous,
        flyerConfiguration: input.configuration,
        flyerImageUrl: input.previewUrl,
        flyerTemplateId: input.templateId ?? null,
        flyerTemplateTitle: input.templateTitle ?? null,
      }));
    },
    [commitState],
  );

  const updateFlyerConfiguration = useCallback(
    (configuration: FlyerConfiguration) => {
      commitState((previous) => ({
        ...previous,
        flyerConfiguration: configuration,
      }));
    },
    [commitState],
  );

  const clearFlyerDraft = useCallback(() => {
    setDraftFile(null);
    commitState((previous) => ({
      ...previous,
      flyerId: null,
      flyerImageUrl: null,
      flyerConfiguration: null,
      flyerTemplateId: null,
      flyerTemplateTitle: null,
    }));
  }, [commitState]);

  const saveFlyerToBackend = useCallback(async () => {
    if (!draftFile || !state.flyerConfiguration) {
      throw new Error("Upload a flyer before continuing to pricing.");
    }

    const record = await uploadFlyer(draftFile, state.flyerConfiguration);
    const flyerId = record._id ?? record.id;
    if (!flyerId) {
      throw new Error("Flyer upload succeeded but no identifier was returned.");
    }

    commitState((previous) => ({
      ...previous,
      flyerId,
      flyerImageUrl: record.image_url,
      flyerConfiguration: record.configuration,
    }));

    return flyerId;
  }, [commitState, draftFile, state.flyerConfiguration]);

  const setPricingQuote = useCallback(
    (quote: PricingQuote) => {
      commitState((previous) => ({ ...previous, pricingQuote: quote }));
    },
    [commitState],
  );

  const resetSetupFlow = useCallback(() => {
    setDraftFile(null);
    commitState(DEFAULT_SETUP_FLOW);
  }, [commitState]);

  const value = useMemo<SetupFlowContextValue>(
    () => ({
      ...state,
      setGuestCapacity,
      setEventTitle,
      setFlyerDraft,
      clearFlyerDraft,
      updateFlyerConfiguration,
      saveFlyerToBackend,
      setPricingQuote,
      resetSetupFlow,
    }),
    [
      state,
      setGuestCapacity,
      setEventTitle,
      setFlyerDraft,
      clearFlyerDraft,
      updateFlyerConfiguration,
      saveFlyerToBackend,
      setPricingQuote,
      resetSetupFlow,
    ],
  );

  return (
    <SetupFlowContext.Provider value={value}>{children}</SetupFlowContext.Provider>
  );
}

export function useSetupFlow() {
  const context = useContext(SetupFlowContext);
  if (!context) {
    throw new Error("useSetupFlow must be used within a SetupFlowProvider.");
  }
  return context;
}
