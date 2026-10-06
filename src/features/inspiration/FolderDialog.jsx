import { useState } from 'react';
import { Sheet } from '../../components/Sheet.jsx';
import { FOLDER_NAME_MAX, folderNameTaken } from '../../lib/inspiration.js';

/**
 * Create or rename a folder.
 *   folder     the folder being renamed, or null to create a new one
 *   folders    all folders (to catch a name that's already used)
 *   onSave(name)
 */
export function FolderDialog({ folder, folders, onSave, onClose }) {
  const [name, setName] = useState(folder?.name || '');
  const clean = name.replace(/\s+/g, ' ').trim();
  const taken = clean !== '' && folderNameTaken(folders, clean, folder?.id);
  const canSave = clean !== '' && !taken;
  const save = () => { if (canSave) onSave(clean); };

  return (
    <Sheet onClose={onClose} titleId="fd-title" title={folder ? 'Rename folder' : 'New folder'}
      subtitle={folder ? '' : 'Group saved places, e.g. “Tokyo food” or “Summer 2027”.'}
      footer={<>
        <button className="btn-plain" type="button" onClick={onClose}>Cancel</button>
        <button className="btn" type="button" disabled={!canSave} onClick={save}>{folder ? 'Save' : 'Create folder'}</button>
      </>}>
      <label className="ad-lbl" htmlFor="fd-name">Folder name</label>
      <input className="ad-in" id="fd-name" type="text" autoComplete="off" autoFocus maxLength={FOLDER_NAME_MAX}
        placeholder="Name your folder" value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
      <div className="import-error fd-error" role="alert">{taken ? `You already have a folder called “${clean}”.` : ''}</div>
    </Sheet>
  );
}
