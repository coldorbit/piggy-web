import { createContext, useContext } from 'react';
import { ALL_WORKSPACES } from './SuperadminWorkspaceLens.jsx';

const WorkspaceFilterContext = createContext({
  activeWorkspaceId: ALL_WORKSPACES,
  setActiveWorkspaceId: () => {},
  workspaceError: null,
  workspaces: [],
  workspacesLoading: false,
});

export function WorkspaceFilterProvider({ children, value }) {
  return (
    <WorkspaceFilterContext.Provider value={value}>
      {children}
    </WorkspaceFilterContext.Provider>
  );
}

export function useWorkspaceFilter() {
  return useContext(WorkspaceFilterContext);
}
