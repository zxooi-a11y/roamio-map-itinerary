import { ACCEPT_ATTR } from '../../lib/import/readFile.js';
import { plural } from '../../lib/dates.js';

/** "Import locations" part of the Create trip dialog: pick a file, see what was found, or see import progress. */
export function ImportSection({ file, progress, disabled }) {
  const { imported, error, reading, choose, clear } = file;
  const places = imported?.places || [];
  const withCoords = places.filter((p) => p.lat !== null).length;
  const lookups = places.length - withCoords;
  const hasDates = places.some((p) => p.day?.date);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again after removing it
    if (f) choose(f);
  };

  return (
    <div className="wide import">
      <span className="ad-lbl">Import locations (optional)</span>

      {!imported ? (
        <label className={'import-pick' + (disabled ? ' is-disabled' : '')}>
          <input type="file" accept={ACCEPT_ATTR} onChange={onPick} disabled={disabled || reading} />
          <span className="import-btn">{reading ? 'Reading file…' : 'Choose a file'}</span>
          <span className="import-hint">CSV, XLSX or Markdown (.md)</span>
        </label>
      ) : (
        <div className="import-file">
          <div className="import-file-text">
            <span className="import-name">{imported.name}</span>
            <span className="import-count">
              {plural(places.length, 'location')} found
              {hasDates && ' · includes dates'}
            </span>
          </div>
          <button className="ad-link" type="button" onClick={clear} disabled={disabled}>Remove</button>
        </div>
      )}

      {error && <div className="import-error" role="alert">{error}</div>}

      <div className="import-status" role="status" aria-live="polite">
        {progress
          ? `Finding locations… ${progress.done} of ${progress.total}`
          : imported && lookups > 0
            ? `${plural(lookups, 'location')} will be looked up by name (about ${Math.ceil(lookups * 1.1)} s).`
            : ''}
      </div>

      <details className="import-help">
        <summary>What should the file look like?</summary>
        <p><strong>CSV or Excel:</strong> one location per row. The first row names the columns. Only the place name is required.</p>
        <p className="import-cols">
          <code>name</code> <code>address</code> <code>day</code> (1, 2, 3… or a date) <code>time</code> <code>type</code> <code>notes</code> <code>lat</code> <code>lng</code>
        </p>
        <p>Rows with <code>lat</code> and <code>lng</code> are used as they are. Others are looked up by name, which takes about a second each. Any we can't find are added at the destination for you to drag into place.</p>
        <p><strong>Markdown:</strong> a bullet list per day under headings like <code>## Day 1</code>, e.g. <code>- 09:00 Belém Tower – book ahead</code>. Tables work too.</p>
        <p><a href="./sample-locations.csv" download>Download a sample CSV</a></p>
      </details>
    </div>
  );
}
