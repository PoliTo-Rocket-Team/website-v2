import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * A dashboard page's own copy of a list or value the server sent, for a page
 * that changes it in place after a save (issue #984). It starts as `server`
 * and takes every new value the server sends, so the fresh props a refresh
 * brings after a write, or the props of a page the router kept mounted, are
 * always what the page shows. A local change stands until the next value from
 * the server replaces it.
 *
 * A plain `useState(server)` reads its prop once and ignores every later one,
 * which kept old rows on screen until a reload.
 */
export function useServerState<T>(server: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(server);
  const [from, setFrom] = useState(server);
  if (!Object.is(from, server)) {
    // React's pattern for state that follows a prop: set during render, so the old value never paints.
    setFrom(server);
    setState(server);
  }
  return [state, setState];
}
