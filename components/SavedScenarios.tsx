"use client";

import React from "react";
import { useScenario } from "@/lib/scenario-context";
import { loadAll, saveNew, remove, restore, type SavedScenario } from "@/lib/storage";
import { GroupHeader, Tooltip } from "./ui";

// A user's own shelf, next to the built-in preset library rather than merged
// into it — PresetBar's rows are a fixed, shared library; these are whatever
// this desk has actually tuned and wants back later, so they get their own
// section and their own empty state rather than silently padding out someone
// else's list. Both panels now share the same neutral border and hover
// treatment as everything else in the app — an earlier pass gave this one a
// permanent gold accent (border, hover tint, the Save button) to tell it
// apart from PresetBar's library rows, but colour in this app means a value
// (direction, status), never "which panel am I in," so that identity-colour
// scheme has been dropped in favour of plain neutral chrome; the "My
// Scenarios" label and empty state already say what this block is. Amber is
// still used once, deliberately, on the row for whichever scenario is
// currently loaded — that spotlight is a real signal ("this is the one in
// effect"), the same treatment applied elsewhere to a selected portfolio or
// a pinned asset, not a panel's decoration. Everything here is local to this
// browser (lib/storage.ts, no account, no backend) — saving is instant, no
// confirmation, since nothing leaves the machine.

export default function SavedScenarios() {
  const { state, path, horizon, steps, notional, applySnapshot, customScenarioId } = useScenario();
  const [list, setList] = React.useState<SavedScenario[]>([]);
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");

  // Loaded after mount, not during the initial render: lib/storage.ts's
  // loadAll() reads localStorage, which does not exist on the server render
  // pass. Reading it there would either throw or (given the module's own
  // `typeof window` guard) silently return [] forever — an effect is what
  // actually picks up what's on this browser once one exists to read from.
  React.useEffect(() => {
    setList(loadAll());
  }, []);

  function handleSave() {
    const rec = saveNew(name, { state, path, horizon, steps, notional, regimeOverride: null }, Date.now());
    setList(loadAll());
    setName("");
    setNaming(false);
    applySnapshot(restore(rec.versions[0]), rec.id);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setList(remove(id));
    // Deleting the scenario currently on screen doesn't reset the values —
    // only the record is gone, not the trader's work — it just un-links the
    // "this is that saved scenario" tag by re-applying the same numbers
    // under no id.
    if (customScenarioId === id) applySnapshot({ state, path, horizon, steps, notional, regimeOverride: null }, null);
  }

  function handleLoad(s: SavedScenario) {
    applySnapshot(restore(s.versions[0]), s.id);
  }

  return (
    <div className="border border-term-edge bg-term-panel">
      <GroupHeader
        right={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setNaming(true);
            }}
            className="text-th text-term-muted hover:text-term-text"
          >
            <span aria-hidden className="mr-0.5">
              +
            </span>
            Save Current
          </button>
        }
      >
        My Scenarios
      </GroupHeader>
      <div>
        {naming ? (
          <div className="flex items-center gap-1.5 border-b border-term-line px-2 py-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSave();
                if (e.key === "Escape") {
                  setNaming(false);
                  setName("");
                }
              }}
              placeholder="Name this scenario…"
              className="min-w-0 flex-1 border border-term-edge bg-term-input px-1.5 py-hair text-[11px] text-term-text"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="border border-term-edge bg-term-raised px-2 py-hair text-th font-medium uppercase tracking-wide text-term-sub hover:bg-term-line/30 hover:text-term-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-term-raised disabled:hover:text-term-sub"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setNaming(false);
                setName("");
              }}
              className="text-th text-term-muted hover:text-term-sub"
            >
              Cancel
            </button>
          </div>
        ) : null}
        {list.length === 0 ? (
          <div className="px-2 py-3 text-[11px] text-term-edge">No saved scenarios.</div>
        ) : (
          <div>
            {list.map((s, i) => {
              const isSel = customScenarioId === s.id;
              return (
                <Tooltip key={s.id} content={new Date(s.updated).toLocaleString()} className="w-full min-w-0">
                  <button
                    type="button"
                    onClick={() => handleLoad(s)}
                    className={`group flex w-full min-w-0 items-center justify-between gap-1.5 px-2 py-dense text-left text-[11px] ${
                      i > 0 ? "border-t border-term-line" : ""
                    } ${
                      isSel
                        ? "bg-term-text font-medium text-term-panel"
                        : "text-term-sub hover:bg-term-line/10 hover:text-term-text"
                    }`}
                    // Same amber spotlight as the selected portfolio's return
                    // and a pinned asset's headline % — "this is the one in
                    // effect" gets the identical treatment everywhere it
                    // appears, rather than this view inventing its own cue.
                    style={{ boxShadow: isSel ? "inset 0 0 0 1.5px rgb(var(--warn))" : undefined }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={`shrink-0 font-mono ${
                          isSel ? "text-term-panel" : "text-term-edge group-hover:text-term-text"
                        }`}
                      >
                        &rsaquo;
                      </span>
                      <span className="min-w-0 truncate">{s.name}</span>
                    </span>
                    <span
                      aria-hidden
                      onClick={(e) => handleDelete(s.id, e)}
                      className={`shrink-0 px-1 font-mono leading-none ${
                        isSel ? "text-term-panel hover:text-down" : "text-term-edge hover:text-down"
                      }`}
                      title="Delete"
                    >
                      &times;
                    </span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
