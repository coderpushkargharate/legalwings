'use client';

// ============================================================================
// 🔹 Public link of a template (/p/<slug>) with Copy / WhatsApp / Open actions.
// The link only shows the template itself — no login, no CRM data.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, MessageCircle } from 'lucide-react';

export default function ShareLink({ slug, businessName, status, compact = false }: {
  slug: string;
  businessName?: string;
  status: 'DRAFT' | 'PUBLISHED';
  compact?: boolean;
}) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const url = `${origin}/p/${slug}`;
  const live = status === 'PUBLISHED';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API blocked (e.g. plain http) — fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${businessName ? `${businessName}\n` : ''}${url}`)}`;
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border';

  return (
    <div className={`rounded-lg border ${live ? 'border-teal-200 bg-teal-50/60' : 'border-amber-200 bg-amber-50/60'} ${compact ? 'p-2' : 'p-3'} space-y-2`}>
      <div className="flex items-center gap-2 min-w-0">
        <Link2 className={`w-4 h-4 flex-shrink-0 ${live ? 'text-teal-600' : 'text-amber-600'}`} />
        <span className="text-xs font-mono text-slate-700 truncate select-all" title={url}>{url}</span>
      </div>
      {live ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy Link'}
          </button>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className={`${btn} border-green-200 bg-green-50 text-green-700 hover:bg-green-100`}>
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          <a href={`/p/${slug}`} target="_blank" rel="noreferrer" className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>
      ) : (
        <p className="text-[11px] text-amber-700">Draft — set Status to Published to activate this link.</p>
      )}
    </div>
  );
}
