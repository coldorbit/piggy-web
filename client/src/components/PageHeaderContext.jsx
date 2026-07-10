import { createContext, useContext } from 'react';

export const EMPTY_PAGE_HEADER = { title: '', subtitle: '' };

const PageHeaderContext = createContext({
  pageHeader: EMPTY_PAGE_HEADER,
  setPageHeader: () => {},
});

export function PageHeaderProvider({ children, value }) {
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeader() {
  return useContext(PageHeaderContext);
}
