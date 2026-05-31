import { createContext, useContext } from 'react';

const BidWorkspaceContext = createContext(null);

export function BidWorkspaceProvider({ children, value }) {
  return (
    <BidWorkspaceContext.Provider value={value}>
      {children}
    </BidWorkspaceContext.Provider>
  );
}

export function useBidWorkspace() {
  const context = useContext(BidWorkspaceContext);
  if (!context) throw new Error('useBidWorkspace must be used inside BidWorkspaceProvider');
  return context;
}
