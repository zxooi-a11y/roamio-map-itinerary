import { Icon } from '../../components/Icon.jsx';
import { inspirationHref } from '../../hooks/useHashRoute.js';
import { groupByCountry } from '../../lib/inspiration.js';
import { useInspiration } from '../../store/InspirationProvider.jsx';

/** The Inspiration section on the home page: one chip per country you've saved places for. */
export function InspirationTeaser() {
  const { places, status } = useInspiration();
  const groups = groupByCountry(places);

  return (
    <section className="home-sec insp-teaser" aria-labelledby="h-insp">
      <div className="sec-head">
        <div className="sec-title">
          <h2 id="h-insp">Inspiration</h2>
          {places.length > 0 && <span className="sec-count">{places.length} saved</span>}
        </div>
        <a className="insp-see-all" href={inspirationHref()}>{places.length ? 'See all' : 'Open'}<Icon name="next" /></a>
      </div>

      {status === 'ready' && groups.length > 0 ? (
        <div className="insp-teaser-chips">
          {groups.map((g) => (
            <a key={g.key || '-'} className="insp-country" href={inspirationHref(g.key || '-')}>
              <span className="insp-flag" aria-hidden="true">{g.flag || '📍'}</span>
              <span className="insp-country-name">{g.name}</span>
              <span className="insp-country-count">{g.places.length}</span>
            </a>
          ))}
        </div>
      ) : (
        <a className="insp-teaser-empty" href={inspirationHref()}>
          <Icon name="instagram" />
          <span>
            {status === 'error'
              ? 'Saved places need a one-time setup. Open to see how.'
              : 'Save places from Instagram for future trips, grouped by country.'}
          </span>
        </a>
      )}
    </section>
  );
}
