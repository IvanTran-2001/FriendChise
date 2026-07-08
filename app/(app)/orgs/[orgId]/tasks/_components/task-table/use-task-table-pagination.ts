"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, type RefObject } from "react";
import type { SortOption } from "../tasks-config";
import type { Task } from "./task-types";

type TaskUpdater = Task[] | ((prev: Task[]) => Task[]);

type PaginationState = {
  tasks: Task[];
  nextCursor: string | null;
  isFetching: boolean;
  initialLoad: boolean;
};

type PaginationAction =
  | { type: "loaded"; tasks: Task[]; nextCursor: string | null }
  | { type: "load_error" }
  | { type: "load_more" }
  | { type: "more_loaded"; tasks: Task[]; nextCursor: string | null }
  | { type: "more_done" }
  | { type: "set_tasks"; tasks: Task[] };

interface UseTaskTablePaginationProps {
  orgId: string;
  mode: "list" | "available" | "shared";
  sort: SortOption;
  filterRoleId: string | null;
  filterTagId: string | null;
  initialTasks: Task[];
  initialNextCursor: string | null;
  debouncedSearch: string;
  scrollRootRef?: RefObject<HTMLDivElement | null>;
}

export function useTaskTablePagination({
  orgId,
  mode,
  sort,
  filterRoleId,
  filterTagId,
  initialTasks,
  initialNextCursor,
  debouncedSearch,
  scrollRootRef,
}: UseTaskTablePaginationProps) {
  function pageReducer(state: PaginationState, action: PaginationAction): PaginationState {
    switch (action.type) {
      case "loaded":
        return {
          ...state,
          tasks: action.tasks,
          nextCursor: action.nextCursor,
          isFetching: false,
          initialLoad: false,
        };
      case "load_error":
        return { ...state, isFetching: false, initialLoad: false };
      case "load_more":
        return { ...state, isFetching: true };
      case "more_loaded":
        return { ...state, tasks: [...state.tasks, ...action.tasks], nextCursor: action.nextCursor };
      case "more_done":
        return { ...state, isFetching: false };
      case "set_tasks":
        return { ...state, tasks: action.tasks };
      default:
        return state;
    }
  }

  const [{ tasks, nextCursor, isFetching, initialLoad }, dispatch] = useReducer(
    pageReducer,
    {
      tasks: initialTasks,
      nextCursor: initialNextCursor,
      isFetching: false,
      initialLoad: initialTasks.length === 0 && initialNextCursor === null,
    },
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const resetKeyRef = useRef(0);
  const pageCacheRef = useRef<Record<string, { tasks: Task[]; nextCursor: string | null }>>({});
  const stateRef = useRef<PaginationState>({
    tasks: initialTasks,
    nextCursor: initialNextCursor,
    isFetching: false,
    initialLoad: initialTasks.length === 0 && initialNextCursor === null,
  });
  const initialQueryKeyRef = useRef(
    [mode, sort, filterRoleId ?? "", filterTagId ?? "", ""].join("|")
  );
  const queryKey = useMemo(
    () => [mode, sort, filterRoleId ?? "", filterTagId ?? "", debouncedSearch].join("|"),
    [mode, sort, filterRoleId, filterTagId, debouncedSearch],
  );
  const queryKeyRef = useRef(queryKey);

  useEffect(() => {
    queryKeyRef.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    stateRef.current = { tasks, nextCursor, isFetching, initialLoad };
  }, [tasks, nextCursor, isFetching, initialLoad]);

  useEffect(() => {
    pageCacheRef.current[initialQueryKeyRef.current] = {
      tasks: initialTasks,
      nextCursor: initialNextCursor,
    };
  }, [initialTasks, initialNextCursor]);

  const buildUrl = useCallback(
    (cursor: string | null | undefined) => {
      const url = new URL(
        `/api/orgs/${orgId}/tasks/paginated`,
        window.location.origin,
      );
      url.searchParams.set("mode", mode);
      url.searchParams.set("sort", sort);
      if (filterRoleId) url.searchParams.set("roleId", filterRoleId);
      if (filterTagId) url.searchParams.set("tagId", filterTagId);
      if (debouncedSearch) url.searchParams.set("search", debouncedSearch);
      if (cursor) url.searchParams.set("cursor", cursor);
      return url.toString();
    },
    [orgId, mode, sort, filterRoleId, filterTagId, debouncedSearch],
  );

  useEffect(() => {
    const key = ++resetKeyRef.current;

    const cachedPage = pageCacheRef.current[queryKey];
    if (cachedPage) {
      dispatch({
        type: "loaded",
        tasks: cachedPage.tasks,
        nextCursor: cachedPage.nextCursor,
      });
      return;
    }

    dispatch({ type: "load_more" });

    let cancelled = false;
    fetch(buildUrl(null))
      .then((r) => r.json() as Promise<{ tasks: Task[]; nextCursor: string | null }>)
      .then((data) => {
        if (cancelled || resetKeyRef.current !== key) return;
        pageCacheRef.current[queryKey] = {
          tasks: data.tasks,
          nextCursor: data.nextCursor,
        };
        dispatch({ type: "loaded", tasks: data.tasks, nextCursor: data.nextCursor });
      })
      .catch(() => {
        if (!cancelled && resetKeyRef.current === key) dispatch({ type: "load_error" });
      });

    return () => {
      cancelled = true;
    };
  }, [buildUrl, queryKey]);

  const loadMore = useCallback(() => {
    if (isFetching || !nextCursor) return;
    const key = resetKeyRef.current;
    dispatch({ type: "load_more" });
    fetch(buildUrl(nextCursor))
      .then((r) => r.json() as Promise<{ tasks: Task[]; nextCursor: string | null }>)
      .then((data) => {
        if (resetKeyRef.current !== key) return;
        pageCacheRef.current[queryKeyRef.current] = {
          tasks: [...stateRef.current.tasks, ...data.tasks],
          nextCursor: data.nextCursor,
        };
        dispatch({ type: "more_loaded", tasks: data.tasks, nextCursor: data.nextCursor });
      })
      .catch(() => {
        /* swallow, next intersection will retry */
      })
      .finally(() => {
        if (resetKeyRef.current === key) dispatch({ type: "more_done" });
      });
  }, [isFetching, nextCursor, buildUrl]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      {
        root: scrollRootRef?.current ?? null,
        rootMargin: "200px",
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, scrollRootRef]);

  return {
    tasks,
    nextCursor,
    isFetching,
    initialLoad,
    sentinelRef,
    setTasks(updater: TaskUpdater) {
      const nextTasks = typeof updater === "function" ? updater(stateRef.current.tasks) : updater;
      pageCacheRef.current[queryKeyRef.current] = {
        tasks: nextTasks,
        nextCursor: stateRef.current.nextCursor,
      };
      dispatch({ type: "set_tasks", tasks: nextTasks });
    },
  };
}
