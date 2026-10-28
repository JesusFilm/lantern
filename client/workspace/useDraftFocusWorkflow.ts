import type { CoachCheckpoint } from "../../shared/coach.js";
import { useEffect, useRef, useState } from "react";
import type {
  DepartmentDirection,
  StrategicInitiative,
} from "../../shared/direction.js";
import type {
  FocusDraft,
  ObjectiveAlignmentChoice,
  ObjectiveKind,
  PositionFocus,
} from "../../shared/focus.js";
import { api } from "./api.js";

export type EditTarget =
  | { type: "create" }
  | { type: "metadata" }
  | { type: "objective"; section: number; adding?: boolean }
  | { type: "goal"; section: number; goal?: number; adding?: boolean }
  | { type: "remove-objective"; section: number }
  | { type: "remove-goal"; section: number; goal: number };

type Metadata = Pick<FocusDraft, "title" | "start" | "end">;
export type InitiativeReadiness =
  | { status: "loading" }
  | { status: "failed"; error: string }
  | { status: "ready"; choices: StrategicInitiative[] };

type PendingEdit = { key: number } & (
  | { type: "metadata"; source?: PositionFocus; values: Metadata }
  | {
      type: "objective";
      source: PositionFocus;
      section: number;
      adding?: boolean;
      text: string;
      kind: ObjectiveKind;
      alignment: ObjectiveAlignmentChoice;
      initiatives: InitiativeReadiness;
    }
  | {
      type: "goal";
      source: PositionFocus;
      section: number;
      goal?: number;
      adding?: boolean;
      text: string;
    }
  | { type: "remove-objective"; source: PositionFocus; section: number }
  | {
      type: "remove-goal";
      source: PositionFocus;
      section: number;
      goal: number;
    }
);

export type AuthoringEdit = Extract<
  PendingEdit,
  { type: "objective" | "goal" }
>;

type EditChange =
  | { type: "suggestion"; checkpoint: CoachCheckpoint }
  | { type: "metadata"; values: Partial<Metadata> }
  | { type: "text"; text: string }
  | { type: "kind"; kind: ObjectiveKind }
  | { type: "initiative"; id: string; checked: boolean }
  | { type: "other"; checked: boolean };

interface Reading {
  items: PositionFocus[];
  focus?: PositionFocus;
  direction?: DepartmentDirection;
  loading: boolean;
  error: string;
}

function selectedId() {
  return new URLSearchParams(location.search).get("focus");
}

function navigate(id?: string) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("focus", id);
  else url.searchParams.delete("focus");
  history.pushState(null, "", url);
  window.scrollTo(0, 0);
}

function draftOf(source: PositionFocus): FocusDraft {
  return {
    title: source.title,
    start: source.start,
    end: source.end,
    sections: source.sections.map((section) => ({
      ...section,
      goals: [...section.goals],
      ...(section.alignment
        ? {
            alignment: {
              other: section.alignment.other,
              initiatives: section.alignment.initiatives.map(({ id }) => ({
                id,
              })),
            },
          }
        : {}),
    })),
  };
}

export function useDraftFocusWorkflow() {
  const [reading, setReading] = useState<Reading>({
    items: [],
    loading: true,
    error: "",
  });
  const [edit, setEdit] = useState<PendingEdit>();
  const readRevision = useRef(0);
  const editRevision = useRef(0);
  const initiativeRevision = useRef(0);

  async function reload() {
    const revision = ++readRevision.current;
    const id = selectedId();
    setReading((old) => ({ ...old, loading: true, error: "" }));
    try {
      // Keep the authorized list available even when a URL points at a focus
      // that is no longer accessible after an account or membership change.
      const items = await api<PositionFocus[]>("/api/focuses");
      if (revision !== readRevision.current) return;
      setReading((old) => ({ ...old, items }));
      const direction = await api<DepartmentDirection>(
        "/api/department/direction",
      );
      if (revision !== readRevision.current) return;
      setReading((old) => ({ ...old, direction }));
      const focus = id
        ? await api<PositionFocus>("/api/focuses/" + encodeURIComponent(id))
        : undefined;
      if (revision === readRevision.current)
        setReading({ items, direction, focus, loading: false, error: "" });
    } catch (error) {
      if (revision === readRevision.current)
        setReading((old) => ({
          ...old,
          focus: undefined,
          loading: false,
          error: (error as Error).message,
        }));
    }
  }

  useEffect(() => {
    void reload();
    const pop = () => void reload();
    window.addEventListener("popstate", pop);
    return () => {
      ++readRevision.current;
      ++editRevision.current;
      ++initiativeRevision.current;
      window.removeEventListener("popstate", pop);
    };
  }, []);

  async function select(id?: string) {
    navigate(id);
    const revision = ++readRevision.current;
    setReading((old) => ({
      ...old,
      focus: undefined,
      loading: !!id,
      error: "",
    }));
    if (!id) return;
    try {
      const focus = await api<PositionFocus>(
        "/api/focuses/" + encodeURIComponent(id),
      );
      if (revision === readRevision.current)
        setReading((old) => ({ ...old, focus, loading: false }));
    } catch (error) {
      if (revision === readRevision.current)
        setReading((old) => ({
          ...old,
          loading: false,
          error: (error as Error).message,
        }));
    }
  }

  function acceptSaved(result: PositionFocus) {
    ++readRevision.current;
    setReading((old) => ({
      ...old,
      focus: result,
      loading: false,
      error: "",
      items: [
        result,
        ...old.items.filter((item) => item.id !== result.id),
      ].sort((a, b) => b.start.localeCompare(a.start)),
    }));
    navigate(result.id);
  }

  function acceptConfirmed(result: PositionFocus) {
    setReading((old) => ({
      ...old,
      focus: old.focus?.id === result.id ? result : old.focus,
      items: old.items.map((item) => (item.id === result.id ? result : item)),
    }));
  }

  async function loadInitiatives(
    pending: Extract<PendingEdit, { type: "objective" }>,
  ) {
    const attempt = ++initiativeRevision.current;
    setEdit((current) =>
      current?.key === pending.key && current.type === "objective"
        ? { ...current, initiatives: { status: "loading" } }
        : current,
    );
    try {
      const direction = await api<DepartmentDirection>(
        "/api/department/direction",
      );
      if (
        attempt !== initiativeRevision.current ||
        pending.key !== editRevision.current
      )
        return;
      const retained = pending.adding
        ? undefined
        : pending.source.sections[pending.section]?.alignment;
      const choices = direction.initiatives.filter(
        (item) =>
          !item.archived ||
          retained?.initiatives.some((choice) => choice.id === item.id),
      );
      setEdit((current) =>
        current?.key === pending.key && current.type === "objective"
          ? { ...current, initiatives: { status: "ready", choices } }
          : current,
      );
    } catch (error) {
      if (
        attempt !== initiativeRevision.current ||
        pending.key !== editRevision.current
      )
        return;
      setEdit((current) =>
        current?.key === pending.key && current.type === "objective"
          ? {
              ...current,
              initiatives: {
                status: "failed",
                error: (error as Error).message,
              },
            }
          : current,
      );
    }
  }

  function begin(target: EditTarget, sourceOverride?: PositionFocus) {
    // Every operation, including removal and metadata, captures the same immutable
    // source/version. Reading a different focus never rebases this edit.
    const source =
      target.type === "create" ? undefined : sourceOverride ?? reading.focus;
    if (target.type !== "create" && (!source || source.status !== "draft"))
      return;
    const key = ++editRevision.current;
    ++initiativeRevision.current;
    if (target.type === "metadata" || target.type === "create") {
      setEdit({
        key,
        type: "metadata",
        source,
        values: {
          title: source?.title ?? "",
          start: source?.start ?? "",
          end: source?.end ?? "",
        },
      });
    } else if (target.type === "objective") {
      const section = target.adding
        ? undefined
        : source!.sections[target.section]!;
      const pending: Extract<PendingEdit, { type: "objective" }> = {
        ...target,
        key,
        source: source!,
        text: section?.objective ?? "",
        kind: section?.kind ?? "normal",
        alignment: {
          other: section?.alignment?.other ?? false,
          initiatives:
            section?.alignment?.initiatives.map(({ id }) => ({ id })) ?? [],
        },
        initiatives: { status: "loading" },
      };
      setEdit(pending);
      void loadInitiatives(pending);
    } else if (target.type === "goal") {
      setEdit({
        ...target,
        key,
        source: source!,
        text: target.adding
          ? ""
          : source!.sections[target.section]!.goals[target.goal!]!,
      });
    } else {
      setEdit({ ...target, key, source: source! });
    }
  }

  function change(intent: EditChange) {
    setEdit((current) => {
      if (!current) return current;
      if (
        intent.type === "suggestion" &&
        (current.type === "goal" || current.type === "objective")
      ) {
        const c = intent.checkpoint;
        if (current.type === "goal") return { ...current, text: c.goal };
        return {
          ...current,
          text: c.objective,
          kind: c.kind || current.kind,
          alignment: {
            other: !!c.other,
            initiatives: c.initiatives.map((id) => ({ id })),
          },
        };
      }
      if (intent.type === "metadata" && current.type === "metadata")
        return { ...current, values: { ...current.values, ...intent.values } };
      if (
        intent.type === "text" &&
        (current.type === "goal" || current.type === "objective")
      )
        return { ...current, text: intent.text };
      if (current.type !== "objective") return current;
      if (intent.type === "kind") return { ...current, kind: intent.kind };
      if (current.initiatives.status !== "ready") return current;
      if (intent.type === "other")
        return {
          ...current,
          alignment: { initiatives: [], other: intent.checked },
        };
      if (
        intent.type === "initiative" &&
        current.initiatives.choices.some((item) => item.id === intent.id)
      ) {
        const initiatives = current.alignment.initiatives.filter(
          (item) => item.id !== intent.id,
        );
        if (intent.checked) initiatives.push({ id: intent.id });
        return { ...current, alignment: { initiatives, other: false } };
      }
      return current;
    });
  }

  function cancel() {
    ++editRevision.current;
    ++initiativeRevision.current;
    setEdit(undefined);
  }

  async function save() {
    const pending = edit;
    if (!pending) return;
    const draft = pending.source
      ? draftOf(pending.source)
      : { title: "", start: "", end: "", sections: [] };
    if (pending.type === "metadata") {
      Object.assign(draft, pending.values);
      if (draft.end < draft.start)
        throw new Error("The end date must be on or after the start date.");
    } else if (pending.type === "remove-objective") {
      draft.sections.splice(pending.section, 1);
    } else if (pending.type === "remove-goal") {
      draft.sections[pending.section]!.goals.splice(pending.goal, 1);
    } else {
      const text = pending.text.trim();
      if (!text) throw new Error("Enter some text before saving.");
      if (pending.type === "objective") {
        if (pending.initiatives.status !== "ready")
          throw new Error(
            "Wait for initiatives to load, or retry loading them before saving.",
          );
        if (pending.adding)
          draft.sections.push({
            kind: pending.kind,
            objective: text,
            goals: [],
            alignment: pending.alignment,
          });
        else
          Object.assign(draft.sections[pending.section]!, {
            objective: text,
            kind: pending.kind,
            alignment: pending.alignment,
          });
      } else if (pending.adding)
        draft.sections[pending.section]!.goals.push(text);
      else draft.sections[pending.section]!.goals[pending.goal!] = text;
    }
    const source = pending.source;
    const result = await api<PositionFocus>(
      "/api/focuses" + (source ? "/" + encodeURIComponent(source.id) : ""),
      source ? "PUT" : "POST",
      { ...draft, ...(source ? { version: source.version } : {}) },
    );
    if (pending.key !== editRevision.current) return;
    acceptSaved(result);
    cancel();
    return result;
  }

  function retryInitiatives() {
    if (edit?.type === "objective") void loadInitiatives(edit);
  }

  return {
    ...reading,
    edit,
    select,
    reload,
    begin,
    change,
    cancel,
    save,
    retryInitiatives,
    acceptConfirmed,
  };
}
