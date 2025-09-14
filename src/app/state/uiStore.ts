/**
 * MapMyHealth UI State Store
 *
 * Zustand store for managing UI state like panel visibility, modals, etc.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  isPanelOpen: boolean;
}

interface UIActions {
  togglePanel: () => void;
  setPanel: (open: boolean) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      isPanelOpen: false,

      // Actions
      togglePanel: () =>
        set((state) => ({ isPanelOpen: !state.isPanelOpen })),

      setPanel: (open: boolean) =>
        set({ isPanelOpen: open }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({ isPanelOpen: state.isPanelOpen }),
    }
  )
);