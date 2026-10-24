# Rhythm scorecard
A mobile-first daily scorecard with optional Daily Pulse notes, project tags, and a Weekly Review. Open `index.html` or serve it as a static page; no build step is needed.
All data stays on-device in your browser's localStorage. Existing scores and tasks load with empty defaults for new fields; export/import backups include notes, tags, and logged nights. Notes, tags, and the weekly night counter do not change your score or streak.

Daily Pulse and Block 2/Big Build tasks autosave as you type. Project tags default to None; the Weekly Review counts tasks with both text and a tag, and shows non-empty notes for the selected week. Tap the night counter to log or undo the selected date (amber at 1/1, red above it).

Run the data and migration checks with `node --test tests/rhythm.test.cjs`.

Tap **Paste task**, paste a `RHYTHM TASK` card with Day, Block, Task, Done when, Time, and Context fields, then tap **Preview** and **Confirm**. Only Day and Task are required. Weekdays resolve to their next occurrence using the device's local date, including today; explicit dates accept `YYYY-MM-DD`, `DD/MM/YYYY`, or `26 October 2026`. These are one-off tasks. An unmatched block name opens a picker for Block 1, Block 2, or Saturday Big Build. Occupied slots are kept; choose another block or date.

Future pasted tasks appear under **Upcoming tasks**. Tap a task to see its finish line, duration, and notes. On its date, **Task done** uses the existing weekday Block 1 or Saturday Big Build controllable. Block 2 and other unscored slots can be checked off without changing the score. Backups include the extra details. No task card content is sent to a server.
