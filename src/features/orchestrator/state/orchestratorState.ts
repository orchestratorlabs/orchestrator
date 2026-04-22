import { useMemo, useState } from "react";

export interface OrchestratorState {
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

export function useOrchestratorState(): OrchestratorState {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return useMemo(
    () => ({
      isPanelOpen,
      togglePanel: () => setIsPanelOpen((prev) => !prev),
      openPanel: () => setIsPanelOpen(true),
      closePanel: () => setIsPanelOpen(false)
    }),
    [isPanelOpen]
  );
}
