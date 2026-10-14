'use client';

// ============================================================================
// 🔹 Admin template editor — section-wise form on the left, live phone preview
// on the right. Saves to /api/template (create or update) and downloads the
// rendered page as a PNG.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toPng } from 'html-to-image';
import {
  ArrowLeft, Save, Download, Loader2, Plus, Trash2, Upload, X, ExternalLink, ChevronDown, Star,
} from 'lucide-react';
import { useApi } from '@/components/api-client';
import TemplatePreview from './template-preview';
import ShareLink from './share-link';
import { compressImage, downloadDataUrl } from './image-utils';
import {
  BusinessTemplate, MAX_GALLERY, MAX_SERVICES, OTHER_SERVICE_ICONS, defaultTemplate, emptyReview,
  emptyService, slugify,
} from './types';

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500';
const labelClass = 'block text-xs font-medium text-slate-600 mb-1';

function Section({ n, title, children, defaultOpen = false }: { n: number; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">{n}</span>
        <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">{children}</div>}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function ImagePicker({ value, onChange, label, round, onError }: { value: string; onChange: (v: string) => void; label: string; round?: boolean; onError: (m: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-3">
        <div className={`w-16 h-16 flex-shrink-0 overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center ${round ? 'rounded-full' : 'rounded-lg'}`}>
          {value ? <img src={value} alt={label} className="w-full h-full object-cover" /> : <Upload className="w-5 h-5 text-slate-300" />}
        </div>
        <button type="button" onClick={() => ref.current?.click()} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">
          {value ? 'Change' : 'Upload'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Remove</button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try { onChange(await compressImage(file)); } catch (err: any) { onError(err.message); }
          }}
        />
      </div>
    </div>
  );
}

// Comma-separated list ⇄ string[] (features, benefits).
function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => { setText(value.join(', ')); }, [value.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(',').map((s) => s.trim()).filter(Boolean))}
      className={inputClass}
    />
  );
}

export default function TemplateEditor({ templateId }: { templateId?: string }) {
  const { apiFetch } = useApi();
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const [t, setT] = useState<BusinessTemplate>(defaultTemplate());
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Keep the link in sync with the business name until the admin edits the link itself.
  const [slugTouched, setSlugTouched] = useState(!!templateId);
  const [origin, setOrigin] = useState('');
  // Link/status as last saved — the share link must point at what is live, not unsaved edits.
  const [saved, setSaved] = useState<Pick<BusinessTemplate, 'slug' | 'status'> | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/template/${templateId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load template');
        if (!cancelled) {
          setT({ ...defaultTemplate(), ...data.template });
          setSaved({ slug: data.template.slug, status: data.template.status });
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [templateId, apiFetch]);

  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => setSuccess(''), 3000);
    return () => window.clearTimeout(id);
  }, [success]);

  const set = <K extends keyof BusinessTemplate>(key: K, value: BusinessTemplate[K]) => setT((prev) => ({ ...prev, [key]: value }));
  const updateItem = <K extends 'services' | 'reviews' | 'gallery' | 'otherServices'>(key: K, index: number, patch: Partial<BusinessTemplate[K][number]>) =>
    setT((prev) => ({ ...prev, [key]: (prev[key] as any[]).map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  const removeItem = (key: 'services' | 'reviews' | 'gallery' | 'otherServices', index: number) =>
    setT((prev) => ({ ...prev, [key]: (prev[key] as any[]).filter((_, i) => i !== index) }));

  const pageUrl = `${origin}/p/${t.slug || slugify(t.businessName) || 'your-business'}`;

  const handleSave = async () => {
    setError('');
    if (!t.businessName.trim()) { setError('Please enter the business name'); return; }
    setSaving(true);
    try {
      const { id: _id, createdAt, updatedAt, createdByUserName, ...body } = t;
      const res = await apiFetch(templateId ? `/api/template/${templateId}` : '/api/template', {
        method: templateId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...body, slug: t.slug || slugify(t.businessName) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'Images are too large — remove a few photos' : 'Failed to save template'));
      setT({ ...defaultTemplate(), ...data.template });
      setSaved({ slug: data.template.slug, status: data.template.status });
      setSuccess(data.template.status === 'PUBLISHED' ? 'Template saved — share link is ready' : 'Template saved');
      if (!templateId) router.replace(`/template/${data.template.id}`);
    } catch (err: any) {
      setError(err.name === 'AbortError' ? 'Saving took too long — please try again' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    setError('');
    try {
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      downloadDataUrl(dataUrl, `${t.slug || slugify(t.businessName) || 'template'}.png`);
    } catch {
      setError('Could not create the image — please try again');
    } finally {
      setDownloading(false);
    }
  };

  const addGallery = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_GALLERY - t.gallery.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Only ${MAX_GALLERY} gallery photos are allowed`);
    try {
      const images = await Promise.all(picked.map((f) => compressImage(f)));
      setT((prev) => ({ ...prev, gallery: [...prev.gallery, ...images.map((image) => ({ image, label: '' as const }))] }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading template...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/template" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4" /> All Templates
        </Link>
        <div className="flex-1" />
        {templateId && t.status === 'PUBLISHED' && (
          <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50">
            <ExternalLink className="w-4 h-4" /> Open Page
          </a>
        )}
        <button type="button" onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 disabled:opacity-60">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Image
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {templateId ? 'Save Changes' : 'Save Template'}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{success}</div>}
      {saved && <ShareLink slug={saved.slug} businessName={t.businessName} status={saved.status} />}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
        {/* Form */}
        <div className="space-y-3">
          <Section n={0} title="Page Settings" defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Page Link">
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/30">
                  <span className="px-2 text-xs text-slate-400 bg-slate-50 py-2 border-r border-slate-200">/p/</span>
                  <input
                    value={t.slug}
                    placeholder={slugify(t.businessName) || 'rahul-plumbing'}
                    onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }}
                    className="flex-1 px-2 py-2 text-sm focus:outline-none min-w-0"
                  />
                </div>
              </Field>
              <Field label="Status">
                <select value={t.status} onChange={(e) => set('status', e.target.value as BusinessTemplate['status'])} className={inputClass}>
                  <option value="PUBLISHED">Published (public link works)</option>
                  <option value="DRAFT">Draft (hidden)</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section n={1} title="Header" defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Brand Name"><input value={t.brandName} onChange={(e) => set('brandName', e.target.value)} className={inputClass} /></Field>
              <Field label="Brand Tagline"><input value={t.brandTagline} onChange={(e) => set('brandTagline', e.target.value)} className={inputClass} /></Field>
            </div>
            <ImagePicker label="Brand Logo (optional)" value={t.brandLogo} onChange={(v) => set('brandLogo', v)} onError={setError} />
          </Section>

          <Section n={2} title="Business Profile" defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Business Name *">
                <input
                  value={t.businessName}
                  placeholder="Rahul Plumbing Services"
                  onChange={(e) => setT((prev) => ({ ...prev, businessName: e.target.value, slug: slugTouched ? prev.slug : slugify(e.target.value) }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Category / Speciality"><input value={t.category} placeholder="Plumbing & Leakage Repair Specialist" onChange={(e) => set('category', e.target.value)} className={inputClass} /></Field>
              <Field label="Location"><input value={t.location} placeholder="Kothrud, Pune" onChange={(e) => set('location', e.target.value)} className={inputClass} /></Field>
              <Field label="Google Maps Link (optional)"><input value={t.mapUrl} placeholder="https://maps.google.com/..." onChange={(e) => set('mapUrl', e.target.value)} className={inputClass} /></Field>
              <Field label="Rating (blank = average of reviews)"><input value={t.rating} placeholder="4.8" inputMode="decimal" onChange={(e) => set('rating', e.target.value)} className={inputClass} /></Field>
              <Field label="Total Reviews (blank = count of reviews)"><input value={t.reviewCount} placeholder="120" inputMode="numeric" onChange={(e) => set('reviewCount', e.target.value)} className={inputClass} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ImagePicker label="Photo / Logo" round value={t.photo} onChange={(v) => set('photo', v)} onError={setError} />
              <ImagePicker label="Cover Image" value={t.coverImage} onChange={(v) => set('coverImage', v)} onError={setError} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={t.verified} onChange={(e) => set('verified', e.target.checked)} className="w-4 h-4 accent-teal-600" />
              Show &quot;Verified Business&quot; badge
            </label>
          </Section>

          <Section n={3} title="Action Buttons (Call, WhatsApp, Pay)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Phone Number"><input value={t.phone} placeholder="9876543210" inputMode="tel" onChange={(e) => set('phone', e.target.value)} className={inputClass} /></Field>
              <Field label="WhatsApp Number (blank = phone)"><input value={t.whatsapp} placeholder="9876543210" inputMode="tel" onChange={(e) => set('whatsapp', e.target.value)} className={inputClass} /></Field>
            </div>
            <p className="text-xs text-slate-500">Pay Now uses the UPI details in section 8. Save downloads a contact card.</p>
          </Section>

          <Section n={4} title={`Services (${t.services.length}/${MAX_SERVICES})`}>
            {t.services.map((s, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">Service {i + 1}</p>
                  <button type="button" onClick={() => removeItem('services', i)} className="text-red-500 hover:text-red-700" aria-label="Remove service"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Service Name"><input value={s.name} placeholder="Leakage Repair" onChange={(e) => updateItem('services', i, { name: e.target.value })} className={inputClass} /></Field>
                  <Field label="Starting Price (₹)"><input value={s.price} placeholder="300" onChange={(e) => updateItem('services', i, { price: e.target.value })} className={inputClass} /></Field>
                </div>
                <Field label="Highlights (comma separated)">
                  <ListInput value={s.features} onChange={(v) => updateItem('services', i, { features: v })} placeholder="Kitchen & Bathroom Leakage, Same Day Service" />
                </Field>
                <ImagePicker label="Service Photo" value={s.image} onChange={(v) => updateItem('services', i, { image: v })} onError={setError} />
              </div>
            ))}
            {t.services.length < MAX_SERVICES && (
              <button type="button" onClick={() => set('services', [...t.services, emptyService()])} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-dashed border-teal-300 rounded-lg hover:bg-teal-50">
                <Plus className="w-4 h-4" /> Add Service
              </button>
            )}
          </Section>

          <Section n={5} title="About Business">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Experience"><input value={t.experience} placeholder="5+ Years" onChange={(e) => set('experience', e.target.value)} className={inputClass} /></Field>
              <Field label="Working Days"><input value={t.workingDays} placeholder="Mon - Sun" onChange={(e) => set('workingDays', e.target.value)} className={inputClass} /></Field>
              <Field label="Working Hours"><input value={t.workingHours} placeholder="8:00 AM - 8:00 PM" onChange={(e) => set('workingHours', e.target.value)} className={inputClass} /></Field>
            </div>
            <Field label="Service Area"><input value={t.serviceArea} placeholder="Kothrud, Karve Nagar, Bavdhan, Warje" onChange={(e) => set('serviceArea', e.target.value)} className={inputClass} /></Field>
            <Field label="We Provide"><input value={t.weProvide} placeholder="Residential | Commercial | Emergency Service" onChange={(e) => set('weProvide', e.target.value)} className={inputClass} /></Field>
            <Field label="Short Description"><textarea value={t.description} rows={3} onChange={(e) => set('description', e.target.value)} className={inputClass} /></Field>
          </Section>

          <Section n={6} title={`Photo Gallery (${t.gallery.length}/${MAX_GALLERY})`}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {t.gallery.map((g, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-slate-200">
                  <img src={g.image} alt={`gallery ${i + 1}`} className="w-full h-24 object-cover" />
                  <button type="button" onClick={() => removeItem('gallery', i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove photo"><X className="w-3.5 h-3.5" /></button>
                  <select value={g.label} onChange={(e) => updateItem('gallery', i, { label: e.target.value as '' | 'Before' | 'After' })} className="w-full text-xs px-1 py-1 border-t border-slate-200 bg-white">
                    <option value="">No label</option>
                    <option value="Before">Before</option>
                    <option value="After">After</option>
                  </select>
                </div>
              ))}
            </div>
            {t.gallery.length < MAX_GALLERY && (
              <button type="button" onClick={() => galleryInput.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-dashed border-teal-300 rounded-lg hover:bg-teal-50">
                <Upload className="w-4 h-4" /> Add Photos
              </button>
            )}
            <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addGallery(e.target.files); e.target.value = ''; }} />
          </Section>

          <Section n={7} title={`Reviews (${t.reviews.length})`}>
            {t.reviews.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => updateItem('reviews', i, { rating: n })} aria-label={`${n} stars`}>
                        <Star className={`w-5 h-5 ${n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => removeItem('reviews', i)} className="text-red-500 hover:text-red-700" aria-label="Remove review"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Customer Name"><input value={r.name} placeholder="Priya Deshmukh" onChange={(e) => updateItem('reviews', i, { name: e.target.value })} className={inputClass} /></Field>
                  <Field label="Date"><input type="date" value={r.date} onChange={(e) => updateItem('reviews', i, { date: e.target.value })} className={inputClass} /></Field>
                </div>
                <Field label="Review"><textarea value={r.text} rows={2} onChange={(e) => updateItem('reviews', i, { text: e.target.value })} className={inputClass} /></Field>
                <ImagePicker label="Customer Photo (optional)" round value={r.photo} onChange={(v) => updateItem('reviews', i, { photo: v })} onError={setError} />
              </div>
            ))}
            <button type="button" onClick={() => set('reviews', [...t.reviews, emptyReview()])} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-dashed border-teal-300 rounded-lg hover:bg-teal-50">
              <Plus className="w-4 h-4" /> Add Review
            </button>
            <p className="text-xs text-slate-500">Visitors can also add reviews from the public page.</p>
          </Section>

          <Section n={8} title="Payment (UPI)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="UPI ID"><input value={t.upiId} placeholder="rahulplumbing@okicici" onChange={(e) => set('upiId', e.target.value)} className={inputClass} /></Field>
              <Field label="Payee Name (blank = business name)"><input value={t.payeeName} onChange={(e) => set('payeeName', e.target.value)} className={inputClass} /></Field>
            </div>
            <p className="text-xs text-slate-500">The UPI QR code is generated automatically.</p>
          </Section>

          <Section n={9} title="Other Services">
            <div className="space-y-2">
              {t.otherServices.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={o.name} onChange={(e) => updateItem('otherServices', i, { name: e.target.value })} className={inputClass} />
                  <select value={o.icon} onChange={(e) => updateItem('otherServices', i, { icon: e.target.value })} className={`${inputClass} max-w-[170px]`}>
                    {OTHER_SERVICE_ICONS.map((ic) => <option key={ic} value={ic}>{ic} icon</option>)}
                  </select>
                  <button type="button" onClick={() => removeItem('otherServices', i)} className="text-red-500 hover:text-red-700 p-1" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            {t.otherServices.length < 12 && (
              <button type="button" onClick={() => set('otherServices', [...t.otherServices, { name: '', icon: 'More' }])} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-dashed border-teal-300 rounded-lg hover:bg-teal-50">
                <Plus className="w-4 h-4" /> Add Category
              </button>
            )}
            <Field label="Explore More Link (optional)"><input value={t.exploreUrl} placeholder="https://rentoai.com" onChange={(e) => set('exploreUrl', e.target.value)} className={inputClass} /></Field>
          </Section>

          <Section n={10} title="App Download">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="App Name"><input value={t.appName} onChange={(e) => set('appName', e.target.value)} className={inputClass} /></Field>
              <Field label="App Tagline"><input value={t.appTagline} onChange={(e) => set('appTagline', e.target.value)} className={inputClass} /></Field>
              <Field label="Google Play Link"><input value={t.playStoreUrl} placeholder="https://play.google.com/..." onChange={(e) => set('playStoreUrl', e.target.value)} className={inputClass} /></Field>
              <Field label="App Store Link"><input value={t.appStoreUrl} placeholder="https://apps.apple.com/..." onChange={(e) => set('appStoreUrl', e.target.value)} className={inputClass} /></Field>
            </div>
            <Field label="Benefits (comma separated)">
              <ListInput value={t.appBenefits} onChange={(v) => set('appBenefits', v)} placeholder="Verified Service Providers, Easy Booking" />
            </Field>
          </Section>
        </div>

        {/* Live preview */}
        <div className="xl:sticky xl:top-4">
          <p className="text-xs font-semibold text-slate-500 mb-2 text-center">Live Preview</p>
          <div className="mx-auto w-[375px] max-w-full rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
            <div className="relative h-[720px] max-h-[80vh] rounded-[1.9rem] overflow-hidden bg-white">
              <div className="h-full overflow-y-auto">
                <TemplatePreview ref={previewRef} template={t} pageUrl={pageUrl} overlay="absolute" />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2 break-all">{pageUrl}</p>
        </div>
      </div>
    </div>
  );
}
