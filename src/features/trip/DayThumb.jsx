import { MapSnapshot } from '../../components/MapSnapshot.jsx';
import { useToast } from '../../components/Toast.jsx';
import { squareThumbnail } from '../../lib/photos.js';

const SIZE = 88;

/** The square picture on a day card: your own photo, or a map snapshot of the day's stops. Tap to choose a photo. */
export function DayThumb({ day, dayNumber, center, onPhoto }) {
  const toast = useToast();

  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    try {
      onPhoto(await squareThumbnail(file, SIZE * 2));
    } catch (err) {
      toast(err.message);
    }
  };

  return (
    <label className="thumb" title="Tap to add your own photo">
      {day.img
        ? <img className="thumb-img" src={day.img} alt="" />
        : <MapSnapshot className="thumb-map" points={day.stops} center={center} w={SIZE} h={SIZE} maxZoom={13} dots={false} pin />}
      <input type="file" accept="image/*" aria-label={'Choose a photo for day ' + dayNumber} onChange={choose} />
      {day.img && (
        <button className="thumb-x" type="button" aria-label="Remove photo"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPhoto(null); }}>✕</button>
      )}
    </label>
  );
}
