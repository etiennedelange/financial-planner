# Session Wrap-Up

End the session by updating all project documentation and memory to reflect work done this conversation.

## Steps

1. **Review session work** — scan recent git log and any uncommitted changes to understand what changed:
   ```
   git log --oneline -10
   git status
   git diff HEAD
   ```

2. **Update phase docs** — for each phase touched this session:
   - Mark completed tasks as done in `docs/project-phases/phase-*.md`
   - Move items from "In Progress" / "Pending" to "Completed"
   - Update the status emoji in the `docs/project-phases.md` table only if a phase's status actually changed

3. **Update history and log** — if significant calculation or architecture changes were made, create a new `docs/history/YYYY-MM-DD-<short-description>.md` file (with `title`, `description`, `date` frontmatter — see `docs/README.md`) summarising what changed and why, and add a one-line entry at the top of `docs/log.md`. Then run `pnpm docs:check`.

4. **Update memory** — review each memory file and update stale entries:
   - `memory/project-phase-status.md` — current phase completion state
   - `memory/project-calculation-architecture.md` — any new patterns or bugs discovered
   - Add new memory files for any new user feedback or project decisions
   - Update `memory/MEMORY.md` index if new files were added

5. **Confirm** — summarise in one sentence what was updated and confirm the session is wrapped up.
