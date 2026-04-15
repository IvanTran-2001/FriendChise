"use client";

/**
 * Breadcrumb override context.
 *
 * Some pages (e.g. /orgs/new) render dynamic content that can't be inferred
 * from the URL alone. This context lets a client component push a custom
 * label that `PageHeader` will display instead of the URL-derived breadcrumb.
 *
 * Usage (in a client page component):
 *   const { setOverride } = useBreadcrumbOverride();
 *   useEffect(() => {
 *     setOverride("Join Franchise");
 *     return () => setOverride(null);
 *   }, []);
 */

import { createContext, useContext, useState, useCallback } from "react";

interface BreadcrumbContextValue {
  override: string | null;
  setOverride: (label: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  override: null,
  setOverride: () => {},
});

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [override, setOverrideState] = useState<string | null>(null);
  const setOverride = useCallback((label: string | null) => {
    setOverrideState(label);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ override, setOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbOverride() {
  return useContext(BreadcrumbContext);
}
