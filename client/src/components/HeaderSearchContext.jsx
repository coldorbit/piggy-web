import { createContext, useContext } from 'react';

export const EMPTY_HEADER_SEARCH = {
  isVisible: false,
  placeholder: 'Search',
  value: '',
  onChange: () => {},
};

const HeaderSearchContext = createContext({
  search: EMPTY_HEADER_SEARCH,
  setSearch: () => {},
});

export function HeaderSearchProvider({ children, value }) {
  return (
    <HeaderSearchContext.Provider value={value}>
      {children}
    </HeaderSearchContext.Provider>
  );
}

export function useHeaderSearch() {
  return useContext(HeaderSearchContext);
}
