# Rhythm scorecard
A mobile-first daily scorecard with optional Daily Pulse notes, project tags, and a Weekly Review. Open `index.html` or serve it as a static page; no build step is needed.
All data stays on-device in your browser's localStorage. Existing scores and tasks load with empty defaults for new fields; export/import backups include notes, tags, and logged nights. Notes, tags, and the weekly night counter do not change your score or streak.

Daily Pulse and Block 2/Big Build tasks autosave as you type. Project tags default to None; the Weekly Review counts tasks with both text and a tag, and shows non-empty notes for the selected week. Tap the night counter to log or undo the selected date (amber at 1/1, red above it).

Run the data and migration checks with `node --test tests/rhythm.test.cjs`.
