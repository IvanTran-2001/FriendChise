"use client";

import { usePersistedState } from "./use-persisted-state";

/**
 * useToolFavorites — shared favorites state for the Tool Hub grid
 * (`tools-client.tsx`) and its page sidebar (`tools-sidebar-content.tsx`),
 * so both surfaces read/write the same persisted contract (storage key +
 * toggle semantics) and can never drift apart.
 */
export function useToolFavorites(orgId: string) {
  const [favoriteIds, setFavoriteIds, hydrated] = usePersistedState<string[]>(
    `toolhub-favorites-${orgId}`,
    [],
  );

  const toggleFavorite = (toolId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
    );
  };

  return { favoriteIds, toggleFavorite, hydrated } as const;
}
