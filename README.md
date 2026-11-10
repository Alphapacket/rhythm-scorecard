# Rhythm scorecard
A mobile-first daily scorecard with optional Daily Pulse notes, project tags, and a Weekly Review. Open `index.html` or serve it as a static page; no build step is needed.
All data stays on-device in your browser's localStorage. The seven Operating Rhythm checks apply from 10 November 2026. Earlier dates and days with checks already recorded on the original checklist keep their original scoring. Planned days from the start date with no recorded checks pick up the new checklist. Existing backups load with empty defaults for the new notes.

Learned today, Problem logged, Nightly summary, the extra Daily Pulse prompts, and Block 2/Big Build tasks autosave as you type. Backups include the notes, tags, and logged nights. The Weekly Review counts tasks with both text and a project tag and shows non-empty notes for the selected week. Tap the night counter to log or undo the selected date (amber at 1/1, red above it).

Run the data and migration checks with `node --test tests/rhythm.test.cjs`.

Tap **Paste task**, paste a `RHYTHM TASK` card with Day, Block, Task, Done when, Time, and Context fields, then tap **Preview** and **Confirm**. Only Day and Task are required. Weekdays resolve to their next occurrence using the device's local date, including today; explicit dates accept `YYYY-MM-DD`, `DD/MM/YYYY`, or `26 October 2026`. These are one-off tasks. An unmatched block name opens a picker for Block 1, Block 2, or Saturday Big Build. Occupied slots are kept; choose another block or date.

Future pasted tasks appear under **Upcoming tasks**. Tap a task to see its finish line, duration, and notes. **Task done** tracks completion separately on days using the Operating Rhythm checklist. On days using the original checklist, weekday Block 1 and Saturday Big Build still use their original checks. Backups include the extra details. No task card content is sent to a server.
