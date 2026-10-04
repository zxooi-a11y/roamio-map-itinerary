import { useCallback, useRef, useState } from 'react';
import { readPlacesFromFile } from '../../lib/import/readFile.js';

/**
 * Holds the locations file chosen in the Create trip dialog.
 *   imported  { name, places } | null
 *   error     message for the last file that couldn't be used
 *   reading   true while a file is being parsed
 *   choose(file)  resolves to true when the file was read successfully
 */
export function useImportedFile() {
  const [imported, setImported] = useState(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const latest = useRef(0); // ignore a slow read if another file was chosen meanwhile

  const choose = useCallback(async (file) => {
    const mine = ++latest.current;
    setReading(true);
    setError('');
    try {
      const places = await readPlacesFromFile(file);
      if (mine !== latest.current) return false;
      setImported({ name: file.name, places });
      return true;
    } catch (err) {
      if (mine === latest.current) { setImported(null); setError(err.message); }
      return false;
    } finally {
      if (mine === latest.current) setReading(false);
    }
  }, []);

  const clear = useCallback(() => {
    latest.current++;
    setImported(null);
    setError('');
    setReading(false);
  }, []);

  return { imported, error, reading, choose, clear };
}
