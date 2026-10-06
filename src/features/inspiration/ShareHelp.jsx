import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { shareBaseUrl } from '../../lib/shareIntake.js';

/** How to send a link straight from Instagram to this page (iPhone shortcut, Android share menu, or just copy-paste). */
export function ShareHelp({ defaultOpen = false }) {
  const toast = useToast();
  const [os, setOs] = useState(() => (/android/i.test(navigator.userAgent) ? 'android' : 'iphone'));
  const base = shareBaseUrl();

  const copy = async () => {
    try { await navigator.clipboard.writeText(base); toast('Address copied.'); }
    catch { toast('Press and hold the address to copy it.'); }
  };

  return (
    <details className="share-help" open={defaultOpen}>
      <summary><Icon name="instagram" />Send links straight from Instagram</summary>

      <div className="share-tabs" role="tablist" aria-label="Your phone">
        {[['iphone', 'iPhone'], ['android', 'Android'], ['paste', 'Any phone']].map(([key, label]) => (
          <button key={key} className="chip" type="button" role="tab" aria-selected={os === key} aria-pressed={os === key} onClick={() => setOs(key)}>{label}</button>
        ))}
      </div>

      {os === 'iphone' && (
        <div className="share-steps">
          <p>iPhone doesn't let websites appear in the Share menu, so you set up a shortcut once (about a minute). After that, <strong>Share → Save to Roamio</strong> works from any post.</p>
          <ol>
            <li>Open the <strong>Shortcuts</strong> app, tap <strong>+</strong>, and name it <em>Save to Roamio</em>.</li>
            <li>Tap the <strong>ⓘ</strong> button and turn on <strong>Show in Share Sheet</strong>. Under <em>Share Sheet Types</em> keep only <strong>URLs</strong> and <strong>Text</strong>.</li>
            <li>Add the action <strong>URL Encode</strong>, and set its input to <em>Shortcut Input</em>.</li>
            <li>Add a <strong>Text</strong> action. Type this address, then tap the end and add the variable <em>URL Encoded Text</em> right after it:
              <code className="share-url">{base}</code>
              <button className="btn-plain share-copy" type="button" onClick={copy}>Copy address</button>
            </li>
            <li>Add the action <strong>Open URLs</strong>, with that <em>Text</em> as its input. Tap <strong>Done</strong>.</li>
            <li>In Instagram: open a post or reel, tap the <strong>paper-plane</strong>, then <strong>Share to…</strong>, and choose <strong>Save to Roamio</strong>. The Save dialog opens with the link filled in.</li>
          </ol>
        </div>
      )}

      {os === 'android' && (
        <div className="share-steps">
          <p>On Android, install this site as an app and it appears in the Share menu.</p>
          <ol>
            <li>Open this site in <strong>Chrome</strong>, tap the <strong>⋮</strong> menu, and choose <strong>Install app</strong> (or <em>Add to Home screen</em>).</li>
            <li>In Instagram: open a post or reel, tap the <strong>paper-plane</strong>, then <strong>Share to…</strong>, and choose <strong>Roamio</strong>.</li>
            <li>The Save dialog opens with the link filled in.</li>
          </ol>
        </div>
      )}

      {os === 'paste' && (
        <div className="share-steps">
          <ol>
            <li>In Instagram, tap the <strong>paper-plane</strong> on a post, then <strong>Copy link</strong>.</li>
            <li>Come back here, tap <strong>Save a place</strong>, then <strong>Paste</strong>.</li>
          </ol>
        </div>
      )}

      <p className="share-note">A link on its own is enough to save. Add the place later, from the <em>Add place</em> button on its card.</p>
    </details>
  );
}
