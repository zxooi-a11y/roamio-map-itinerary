import { dayColor } from '../../lib/theme.js';

/** Chips under the map: "All days" plus one per day. */
export function DayFilters({ days, focusDayId, onAll, onDay }) {
  return (
    <nav className="daybar" aria-label="Jump to a day">
      <div className="filters">
        <button className="chip" type="button" aria-pressed={focusDayId === null} onClick={onAll}>All days</button>
        {days.map((d, i) => (
          <button key={d.id} className="chip" type="button" aria-pressed={focusDayId === d.id} onClick={() => onDay(d.id)}>
            <span className="dot" style={{ background: dayColor(i) }} />Day {i + 1}
          </button>
        ))}
      </div>
    </nav>
  );
}
