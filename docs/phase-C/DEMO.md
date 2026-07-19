# Phase C demo script (UJ-F4–F5)

Judge-ready path without the VS Code extension sidebar.

## Prerequisites

- WalkCroach Desktop build (or structural verify for CI)
- Optional: `/ide` BFF + Cognito token + linked project for live memory
- Without credentials, panels use **demo fixtures** (still exercises all gates)

## Steps

1. **Web preference (setup, optional)**  
   In WalkCroach Web, store a preference such as “Prefer UUID primary keys.”

2. **Desktop memory recall**  
   Open Panel → **CockroachDB → Memory**.  
   Query `UUID` (or empty).  
   Confirm hits show **surface badges**: `[web]`, `[chrome]`, `[ide]`, `[desktop]`.

3. **MCP schema**  
   Open **Schema**. Expand `defaultdb` → click `memory_entries`.  
   Confirm table detail renders (demo or live MCP).

4. **Read-only query**  
   **Query** → run  
   `SELECT source_surface, kind, text FROM memory_entries LIMIT 5`  
   Confirm rows return. Leave **Allow writes** unchecked.

5. **Rejected write**  
   Run `DELETE FROM memory_entries WHERE false` with writes unchecked.  
   Expect error: write path opt-in.  
   (Optional) Enable writes → reject in QuickPick → confirm rejection in **Audit**.

6. **Confirmed ccloud dry-run**  
   **ccloud** → `cluster list` → Dry-run → **Approve** in QuickPick.  
   Reject once to prove hard gate (FR-F11).  
   Autonomy dial must not skip this.

7. **Skills**  
   **Skills** → load `cockroachdb-schema-design`. Body appears (progressive disclosure).

8. **Telemetry**  
   **Telemetry** pane shows `mcp_calls`, `ccloud_actions`, `skills_invoked`, `recalls_by_surface`.  
   Status bar shows `mcp` / `ccloud` counters.

## One-shot command

Command Palette → **WalkCroach: Run Phase C Demo Script**  
(Approves will prompt via QuickPick for the ccloud step.)
