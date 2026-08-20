import {
    createContext,
    useContext,
} from 'react';

type AppGateContextValue = {
  refreshProfileGate:
    () => Promise<void>;
};

export const AppGateContext =
  createContext<
    AppGateContextValue | null
  >(null);

export function useAppGate() {
  const context =
    useContext(
      AppGateContext
    );

  if (!context) {
    throw new Error(
      'useAppGate must be used inside AppGateContext.Provider'
    );
  }

  return context;
}