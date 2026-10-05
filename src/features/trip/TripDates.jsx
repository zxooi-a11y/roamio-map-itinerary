import { dateRange } from '../../lib/tripDates.js';

/**
 * The trip's start and end date, editable at the top of the itinerary. Changing either one adds, removes or
 * moves days to match (rules in lib/tripDates.js). onChange(start, end, edited) gets both dates as they are
 * after the edit, and which field was just changed.
 */
export function TripDates({ trip, onChange, showHint }) {
  const range = dateRange(trip);
  const start = range?.start ?? '';
  const end = range?.end ?? '';

  // An emptied field is ignored (a trip can't lose its dates this way), so the old date comes back.
  return (
    <div className="trip-dates">
      <div className="td-row">
        <label className="td-field">
          <span className="ad-lbl">Start date</span>
          <input className="ad-in" type="date" value={start}
            onChange={(e) => e.target.value && onChange(e.target.value, end, 'start')} />
        </label>
        <label className="td-field">
          <span className="ad-lbl">End date</span>
          <input className="ad-in" type="date" value={end}
            onChange={(e) => e.target.value && onChange(start, e.target.value, 'end')} />
        </label>
      </div>
      {showHint && (
        <p className="td-hint">
          Changing the dates adds or removes days to fit. Moving the start after the end moves the whole trip.
        </p>
      )}
    </div>
  );
}
