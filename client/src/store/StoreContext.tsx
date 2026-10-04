import React, { createContext, useContext } from 'react';
import { RetroStore } from './RetroStore';

const RetroStoreContext = createContext<RetroStore | null>(null);

export const RetroStoreProvider: React.FC<{ store: RetroStore; children: React.ReactNode }> = ({ store, children }) => (
  <RetroStoreContext.Provider value={store}>{children}</RetroStoreContext.Provider>
);

export const useRetroStore = (): RetroStore => {
  const store = useContext(RetroStoreContext);
  if (!store) {
    throw new Error('RetroStore is not provided');
  }
  return store;
};
