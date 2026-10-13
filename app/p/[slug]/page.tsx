'use client';

// ============================================================================
// 🔹 PAGE: public business profile (/p/<slug>) — no login. Renders a published
// template and lets visitors call, WhatsApp, pay, share and write reviews.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import TemplatePreview from '@/components/template/template-preview';
import { BusinessTemplate, TemplateReview, defaultTemplate } from '@/components/template/types';

export default function PublicTemplatePage({ params }: { params: { slug: string } }) {
  const [template, setTemplate] = useState<BusinessTemplate | null>(null);
  const [error, setError] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    setPageUrl(window.location.href.split('?')[0]);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/template/${encodeURIComponent(params.slug)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Page not found');
        if (!cancelled) {
          setTemplate({ ...defaultTemplate(), ...data.template });
          document.title = data.template.businessName || 'Business Profile';
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [params.slug]);

  const submitReview = useCallback(async (r: { name: string; rating: number; text: string }): Promise<TemplateReview[]> => {
    const res = await fetch(`/api/public/template/${encodeURIComponent(params.slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(r),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not submit review');
    return data.reviews;
  }, [params.slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-sm">{error}</div>
    );
  }
  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-sm gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        <TemplatePreview template={template} pageUrl={pageUrl} overlay="fixed" onSubmitReview={submitReview} />
      </div>
    </div>
  );
}
