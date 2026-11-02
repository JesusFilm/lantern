import { useEffect, useRef, useState } from "react";
import type { CoachRecord } from "../../shared/coach.js";
import { api } from "../workspace/api.js";

/** Prevent superseded reads from replacing a save or another focus's record. */
export function useFocusRecord(id?: string, version?: number) {
  const [record, setRecord] = useState<CoachRecord>(),
    [error, setError] = useState("");
  const revision = useRef(0),
    currentId = useRef(id);
  currentId.current = id;
  function accept(next: CoachRecord) {
    if (next.focus.id !== currentId.current) return;
    revision.current++;
    setRecord(next);
    setError("");
  }
  async function refresh() {
    const n = ++revision.current;
    if (!id) return;
    try {
      const r = await api<CoachRecord>("/api/coach/focuses/" + id);
      if (n === revision.current) accept(r);
    } catch (e) {
      if (n === revision.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    setRecord(undefined);
    setError("");
    void refresh();
    return () => {
      revision.current++;
    };
  }, [id, version]);
  return {
    record: record?.focus.id === id ? record : undefined,
    error,
    accept,
    refresh,
  };
}
