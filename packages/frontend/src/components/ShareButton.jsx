import React, { useState } from 'react';
import { buildShareUrl } from '../utils/urlParams.js';

export default function ShareButton({ scenario }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = buildShareUrl(scenario);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) - fall back to
      // updating the address bar so the user can copy it manually.
      window.history.replaceState(null, '', url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button className="btn-share mono" onClick={handleShare} aria-live="polite">
      {copied ? '✓ Link copied' : '⇪ Share scenario'}
    </button>
  );
}
