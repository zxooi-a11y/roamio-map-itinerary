import { Icon } from './Icon.jsx';

const STATUS_TEXT = {
  idle: (hint) => hint,
  short: () => 'Keep typing…',
  searching: () => 'Searching…',
  error: (_, errorText) => errorText,
};

/**
 * Search box + result list, driven by usePlaceSearch().
 * `iconFor(result)` picks each row's icon; `onPick(result)` fires on tap.
 */
export function PlaceSearch({ search, onPick, id, placeholder, hint = '', errorText = "Couldn't reach the search service.",
  iconFor = () => 'Other', autoFocus = false, inputRef }) {
  const { query, onQueryChange, searchNow, status, results } = search;

  let statusText;
  if (status === 'done') {
    statusText = results.length
      ? results.length + (results.length === 1 ? ' result' : ' results') + '. Tap one to choose it.'
      : 'No matches found. Try a different spelling or add the city.';
  } else {
    statusText = STATUS_TEXT[status](hint, errorText);
  }

  return (
    <>
      <label className="ad-search">
        <Icon name="search" />
        <input ref={inputRef} className="ad-in" id={id} type="search" placeholder={placeholder} aria-label={placeholder}
          autoComplete="off" autoCapitalize="off" spellCheck="false" autoFocus={autoFocus}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchNow(); } }} />
      </label>
      <div className="ad-status" role="status" aria-live="polite">{statusText}</div>
      <ul className="ad-results">
        {results.map((r, i) => (
          <li key={i}>
            <button className="ad-result" type="button" onClick={() => onPick(r)}>
              <span className="ad-ico"><Icon name={iconFor(r)} /></span>
              <span>
                <span className="ad-name">{r.name}</span>
                <span className="ad-addr">{r.addr}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
