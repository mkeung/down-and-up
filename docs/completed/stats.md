# Stats definitions (shared with the web)

**Status: completed.** Implemented once in `packages/shared` and used by both the mobile History screen and the web dashboard, so both show identical numbers.

- **Logged day:** a day with a value. Days with only a note or recording don't count toward stats or "days logged".
- **Average:** mean of logged values in the range, shown to 1 decimal. Min and max are taken over logged values.
- **Bucketing by range length** (presets and custom ranges alike):
  - ≤ 90 days: daily points.
  - 91–730 days: weekly averages (ISO weeks, starting Monday).
  - Over 730 days: monthly averages.
  - A bucket with no logged days is a gap.
- **7-day rolling average:** for each day, the mean of logged values in that day and the 6 before it. It's shown only when at least 4 of those 7 days are logged, otherwise it's a gap.
- **Current streak** (web only): consecutive logged days ending today, or ending yesterday if today isn't logged yet, so the streak doesn't drop to zero before the day ends.
- **Value counts:** how many logged days had each value 1–10 in the range.

Long-range chart buckets advance directly by ISO week or calendar month instead of enumerating every day. Daily iteration uses local calendar arithmetic, and rolling averages add/remove one day in a seven-day window. Definitions, gaps, partial buckets, and the four-day rolling threshold are unchanged. A compact consecutive-run representation can calculate the web streak for the browser's local today/yesterday without sending lifetime history.
