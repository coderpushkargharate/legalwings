'use client';

// ============================================================================
// 🔹 Business profile page renderer — used for the live preview inside the
// admin editor (phone frame) and for the public /p/<slug> page.
// Sections: header · profile · action buttons · services · about · gallery ·
// reviews · payment · other services · app download, plus the bottom sheets
// (service detail, full-screen gallery, payment QR, share options, app download,
// write a review).
// ============================================================================

import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import {
  Phone, QrCode, Bookmark, MapPin, Map as MapIcon, Star, Share2, BadgeCheck, CircleCheck, Clock,
  Award, FileText, ClipboardList, ChevronRight, ChevronLeft, X, Copy, ImageDown, Home, Zap, AirVent,
  SprayCan, PaintRoller, Hammer, Wrench, Bug, WashingMachine, Truck, LayoutGrid, CalendarCheck,
  Facebook, Instagram, Send, Link2, ScanLine, ArrowLeft, Image as ImageIcon, Loader2, Download,
  ShieldCheck,
} from 'lucide-react';
import { BusinessTemplate, TemplateReview, displayRating, waNumber } from './types';
import { downloadDataUrl } from './image-utils';

const BLUE = '#0b5ed7';

const OTHER_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  Electrician: { icon: Zap, color: '#f59e0b' },
  'AC Service': { icon: AirVent, color: '#64748b' },
  Cleaning: { icon: SprayCan, color: '#16a34a' },
  Painting: { icon: PaintRoller, color: '#22c55e' },
  Carpenter: { icon: Hammer, color: '#ea580c' },
  Plumbing: { icon: Wrench, color: '#0b5ed7' },
  'Pest Control': { icon: Bug, color: '#dc2626' },
  'Appliance Repair': { icon: WashingMachine, color: '#7c3aed' },
  Shifting: { icon: Truck, color: '#0891b2' },
  More: { icon: LayoutGrid, color: '#0b5ed7' },
};

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.98 6.67 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.44 9.44zm8.04-17.48A11.3 11.3 0 0 0 12.04.7C5.77.7.67 5.8.67 12.07c0 2 .52 3.96 1.52 5.69L.57 23.65l6.03-1.58a11.33 11.33 0 0 0 5.43 1.38h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.89-3.33-8.04z" />
    </svg>
  );
}

function Stars({ value, size = 'w-4 h-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={`relative inline-block ${size}`}>
            <Star className={`absolute inset-0 ${size} text-amber-300`} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} text-amber-400 fill-amber-400`} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Img({ src, alt, className, iconSize = 'w-6 h-6' }: { src?: string; alt: string; className?: string; iconSize?: string }) {
  if (src) return <img src={src} alt={alt} className={`object-cover ${className || ''}`} />;
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 ${className || ''}`}>
      <ImageIcon className={iconSize} />
    </div>
  );
}

function BrandLogo({ src, className }: { src?: string; className?: string }) {
  if (src) return <img src={src} alt="logo" className={`object-contain ${className || ''}`} />;
  return (
    <span className={`relative inline-flex items-center justify-center ${className || ''}`}>
      <Home className="w-full h-full text-orange-500" strokeWidth={2.4} />
      <span className="absolute bottom-[18%] w-[34%] h-[30%] rounded-t-sm" style={{ background: BLUE }} />
    </span>
  );
}

function SectionTitle({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
      {onViewAll && (
        <button type="button" onClick={onViewAll} className="text-xs font-medium" style={{ color: BLUE }}>View All</button>
      )}
    </div>
  );
}

const formatPrice = (p: string) => (p ? (/^\d/.test(p) ? `₹${p} Onwards` : p) : '');
const formatReviewDate = (d: string) => {
  const dt = d ? new Date(d) : null;
  return dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

type Sheet =
  | { kind: 'service'; index: number }
  | { kind: 'services' }
  | { kind: 'gallery'; index: number }
  | { kind: 'payment' }
  | { kind: 'share' }
  | { kind: 'qr' }
  | { kind: 'app' }
  | { kind: 'reviews' }
  | { kind: 'writeReview' }
  | null;

interface Props {
  template: BusinessTemplate;
  pageUrl: string;
  // 'absolute' keeps sheets inside the editor's phone frame; 'fixed' covers the browser window.
  overlay?: 'absolute' | 'fixed';
  // Public page only: persists a visitor review and returns the updated list.
  onSubmitReview?: (r: { name: string; rating: number; text: string }) => Promise<TemplateReview[]>;
}

const TemplatePreview = forwardRef<HTMLDivElement, Props>(function TemplatePreview(
  { template: t, pageUrl, overlay = 'fixed', onSubmitReview },
  contentRef,
) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [flash, setFlash] = useState('');
  const [upiQr, setUpiQr] = useState('');
  const [pageQr, setPageQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<TemplateReview[]>(t.reviews);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 0, text: '' });
  const [reviewError, setReviewError] = useState('');

  useEffect(() => setReviews(t.reviews), [t.reviews]);
  useEffect(() => { if (reviewIdx >= reviews.length) setReviewIdx(0); }, [reviews.length, reviewIdx]);

  const { rating, count } = displayRating({ ...t, reviews });
  const wa = waNumber(t.whatsapp || t.phone);
  const services = t.services.filter((s) => s.name);
  const upiLink = t.upiId ? `upi://pay?pa=${encodeURIComponent(t.upiId)}&pn=${encodeURIComponent(t.payeeName || t.businessName)}&cu=INR` : '';

  useEffect(() => {
    let cancelled = false;
    if (!upiLink) { setUpiQr(''); return; }
    QRCode.toDataURL(upiLink, { width: 320, margin: 1 }).then((u) => { if (!cancelled) setUpiQr(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [upiLink]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(pageUrl, { width: 320, margin: 1 }).then((u) => { if (!cancelled) setPageQr(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [pageUrl]);

  const notify = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 2200);
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(msg);
    } catch {
      notify('Could not copy — please copy manually');
    }
  };

  const openWhatsApp = (message: string) => {
    if (!wa) { notify('WhatsApp number not added'); return; }
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const call = () => {
    if (!t.phone) { notify('Phone number not added'); return; }
    window.location.href = `tel:${t.phone.replace(/\s/g, '')}`;
  };

  const mapHref = t.mapUrl || (t.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.businessName} ${t.location}`)}` : '');

  // "Save" → downloads a vCard so the visitor can add the business to contacts.
  const saveContact = () => {
    const vcard = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `FN:${t.businessName}`,
      t.category ? `TITLE:${t.category}` : '',
      t.phone ? `TEL;TYPE=CELL:${t.phone}` : '',
      t.location ? `ADR:;;${t.location};;;;` : '',
      `URL:${pageUrl}`,
      'END:VCARD',
    ].filter(Boolean).join('\n');
    const url = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.slug || 'contact'}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Contact saved');
  };

  const shareText = `${t.businessName}${t.category ? ` — ${t.category}` : ''}\n${pageUrl}`;

  const shareAsImage = async () => {
    const node = contentRef && typeof contentRef !== 'function' ? contentRef.current : null;
    if (!node) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${t.slug || 'business'}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.businessName, text: shareText });
      } else {
        downloadDataUrl(dataUrl, `${t.slug || 'business'}.png`);
        notify('Image downloaded');
      }
    } catch {
      notify('Could not create image');
    } finally {
      setBusy(false);
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t.businessName, text: shareText, url: pageUrl }); return; } catch { /* cancelled → fall back to sheet */ }
    }
    setSheet({ kind: 'share' });
  };

  const submitReview = async () => {
    if (!onSubmitReview) return;
    if (!reviewForm.name.trim() || !reviewForm.text.trim() || !reviewForm.rating) {
      setReviewError('Please enter your name, rating and review');
      return;
    }
    setBusy(true);
    setReviewError('');
    try {
      const updated = await onSubmitReview(reviewForm);
      setReviews(updated);
      setReviewIdx(0);
      setReviewForm({ name: '', rating: 0, text: '' });
      setSheet(null);
      notify('Thank you for your review!');
    } catch (e: any) {
      setReviewError(e?.message || 'Could not submit review');
    } finally {
      setBusy(false);
    }
  };

  const review = reviews[reviewIdx];
  const galleryIndex = sheet?.kind === 'gallery' ? sheet.index : 0;
  const service = sheet?.kind === 'service' ? services[sheet.index] : undefined;

  const aboutItems = useMemo(() => [
    t.experience && { icon: Award, title: t.experience, sub: 'Experience' },
    (t.workingDays || t.workingHours) && { icon: Clock, title: t.workingDays, sub: t.workingHours },
  ].filter(Boolean) as { icon: React.ElementType; title: string; sub: string }[], [t.experience, t.workingDays, t.workingHours]);

  return (
    <>
      <div ref={contentRef} className="bg-white text-slate-800 w-full font-sans">
        {/* 1. Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white">
          <div className="flex items-center gap-2">
            <BrandLogo src={t.brandLogo} className="w-9 h-9" />
            <div className="leading-tight">
              <p className="text-xl font-extrabold tracking-tight" style={{ color: BLUE }}>{t.brandName}</p>
              {t.brandTagline && <p className="text-[10px] text-slate-500">{t.brandTagline}</p>}
            </div>
          </div>
          <button type="button" onClick={nativeShare} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: BLUE }}>
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>

        {/* 2. Business profile */}
        <div className="relative">
          <Img src={t.coverImage} alt="cover" className="w-full h-36" iconSize="w-8 h-8" />
          <div className="absolute left-6 -bottom-10 w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white">
            <Img src={t.photo} alt={t.businessName} className="w-full h-full" />
          </div>
        </div>
        <div className="px-4 pt-3 text-center bg-white rounded-t-3xl">
          <div className="h-8 flex justify-end">
            {t.verified && (
              <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-green-600 text-white text-xs font-semibold shadow">
                <BadgeCheck className="w-4 h-4" /> Verified Business
              </span>
            )}
          </div>
          <h1 className="mt-3 text-[22px] font-extrabold text-slate-900 leading-tight">{t.businessName || 'Business Name'}</h1>
          {t.category && <p className="text-sm text-slate-600 mt-0.5">{t.category}</p>}
          {(rating > 0 || count > 0) && (
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <Stars value={rating} />
              <span className="text-sm font-semibold text-slate-800">{rating.toFixed(1)}</span>
              <span className="text-xs text-slate-500">({count} Reviews)</span>
            </div>
          )}
        </div>

        {t.location && (
          <div className="flex items-center justify-between gap-2 px-4 mt-3">
            <span className="flex items-center gap-2 text-sm text-slate-700 min-w-0">
              <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: BLUE }} />
              <span className="truncate">{t.location}</span>
            </span>
            {mapHref && (
              <a href={mapHref} target="_blank" rel="noreferrer" className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-xs font-semibold" style={{ color: BLUE }}>
                <MapIcon className="w-4 h-4" /> View on Map
              </a>
            )}
          </div>
        )}

        {/* 3. Action buttons */}
        <div className="grid grid-cols-[1fr_1fr_1fr_0.75fr] gap-2 px-4 mt-3">
          <button type="button" onClick={call} className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold shadow-sm">
            <Phone className="w-5 h-5" /> Call Now
          </button>
          <button type="button" onClick={() => openWhatsApp(`Hi ${t.businessName}, I found you on ${t.brandName}.`)} className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold shadow-sm">
            <WhatsAppIcon className="w-5 h-5" /> WhatsApp
          </button>
          <button type="button" onClick={() => setSheet({ kind: 'payment' })} className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-white text-sm font-semibold shadow-sm" style={{ background: BLUE }}>
            <QrCode className="w-5 h-5" /> Pay Now
          </button>
          <button type="button" onClick={saveContact} className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold shadow-sm" style={{ color: BLUE }}>
            <Bookmark className="w-5 h-5" /> Save
          </button>
        </div>

        {/* 4. Services */}
        {services.length > 0 && (
          <div className="px-4 mt-5">
            <SectionTitle title="Our Services" onViewAll={services.length > 6 ? () => setSheet({ kind: 'services' }) : undefined} />
            <div className="grid grid-cols-3 gap-2">
              {services.slice(0, 6).map((s, i) => (
                <button key={i} type="button" onClick={() => setSheet({ kind: 'service', index: i })} className="rounded-lg border border-slate-200 overflow-hidden bg-white text-center shadow-sm">
                  <Img src={s.image} alt={s.name} className="w-full h-16" iconSize="w-5 h-5" />
                  <p className="text-[11px] font-semibold text-slate-800 px-1 pt-1 leading-tight truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-500 pb-1.5">{formatPrice(s.price)}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openWhatsApp(`Hi ${t.businessName}, I would like a quote for your services.`)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 border border-blue-100 text-sm font-semibold relative"
              style={{ color: BLUE }}
            >
              <ClipboardList className="w-5 h-5" /> Request a Quote
              <ChevronRight className="w-5 h-5 absolute right-4" />
            </button>
          </div>
        )}

        {/* 5. About business */}
        {(aboutItems.length > 0 || t.serviceArea || t.weProvide || t.description) && (
          <div className="px-4 mt-5">
            <SectionTitle title="About Business" />
            {aboutItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {aboutItems.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <a.icon className="w-7 h-7 flex-shrink-0" style={{ color: BLUE }} />
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="text-[11px] text-slate-500">{a.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {t.serviceArea && (
              <div className="flex items-start gap-2 mt-3">
                <MapPin className="w-7 h-7 flex-shrink-0" style={{ color: BLUE }} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">Service Area</p>
                  <p className="text-[12px] text-slate-500">{t.serviceArea}</p>
                </div>
              </div>
            )}
            {t.weProvide && (
              <div className="flex items-start gap-2 mt-3">
                <FileText className="w-7 h-7 flex-shrink-0" style={{ color: BLUE }} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">We Provide</p>
                  <p className="text-[12px] text-slate-500">{t.weProvide}</p>
                </div>
              </div>
            )}
            {t.description && <p className="text-[13px] text-slate-600 mt-3 leading-relaxed whitespace-pre-line">{t.description}</p>}
          </div>
        )}

        {/* 6. Gallery */}
        {t.gallery.length > 0 && (
          <div className="px-4 mt-5">
            <SectionTitle title="Our Work Gallery" onViewAll={() => setSheet({ kind: 'gallery', index: 0 })} />
            <div className="flex gap-2 overflow-x-auto pb-1 -mr-4 pr-4">
              {t.gallery.map((g, i) => (
                <button key={i} type="button" onClick={() => setSheet({ kind: 'gallery', index: i })} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
                  <img src={g.image} alt={`work ${i + 1}`} className="w-full h-full object-cover" />
                  {g.label && (
                    <span className={`absolute left-1 bottom-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white ${g.label === 'Before' ? 'bg-red-500' : 'bg-green-600'}`}>{g.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 7. Reviews */}
        <div className="px-4 mt-5">
          <SectionTitle title="Customer Reviews" onViewAll={reviews.length > 1 ? () => setSheet({ kind: 'reviews' }) : undefined} />
          <div className="flex gap-2">
            <div className="w-28 flex-shrink-0 rounded-xl border border-slate-200 flex flex-col items-center justify-center py-3 shadow-sm">
              <p className="text-3xl font-extrabold text-slate-900">{rating.toFixed(1)}</p>
              <Stars value={rating} size="w-3.5 h-3.5" />
              <p className="text-[11px] text-slate-500 mt-1">{count} Reviews</p>
            </div>
            <div className="flex-1 min-w-0 rounded-xl border border-slate-200 p-2.5 shadow-sm">
              {review ? (
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-blue-100 flex items-center justify-center text-sm font-bold" style={{ color: BLUE }}>
                    {review.photo ? <img src={review.photo} alt={review.name} className="w-full h-full object-cover" /> : review.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{review.name}</p>
                    <div className="flex items-center gap-1.5">
                      <Stars value={review.rating} size="w-3 h-3" />
                      <span className="text-[10px] text-slate-500">{formatReviewDate(review.date)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-3">{review.text}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 h-full flex items-center justify-center text-center">No reviews yet — be the first!</p>
              )}
            </div>
          </div>
          {reviews.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {reviews.slice(0, 8).map((_, i) => (
                <button key={i} type="button" onClick={() => setReviewIdx(i)} aria-label={`Review ${i + 1}`} className={`w-1.5 h-1.5 rounded-full ${i === reviewIdx ? 'bg-blue-600' : 'bg-slate-300'}`} />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => (onSubmitReview ? setSheet({ kind: 'writeReview' }) : notify('Visitors can write reviews on the shared page'))}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-sm font-semibold"
            style={{ color: BLUE }}
          >
            <Star className="w-4 h-4" /> Write a Review
          </button>
        </div>

        {/* 9. Other services */}
        {t.otherServices.length > 0 && (
          <div className="mx-4 mt-5 rounded-2xl bg-green-50 border border-green-100 p-3">
            <div className="flex items-start gap-2">
              <span className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Need Other Home Services?</p>
                <p className="text-[11px] text-slate-600">Explore trusted professionals on {t.brandName}</p>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1 mt-3">
              {t.otherServices.map((o, i) => {
                const meta = OTHER_ICONS[o.icon] || OTHER_ICONS.More;
                const Icon = meta.icon;
                const inner = (
                  <>
                    <Icon className="w-7 h-7" style={{ color: meta.color }} />
                    <span className="text-[9.5px] text-slate-700 text-center leading-tight">{o.name}</span>
                  </>
                );
                return t.exploreUrl ? (
                  <a key={i} href={t.exploreUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1">{inner}</a>
                ) : (
                  <div key={i} className="flex flex-col items-center gap-1">{inner}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* 10. App download */}
        <div className="mx-4 mt-3 mb-4 rounded-2xl px-4 py-3 flex items-center gap-3 text-white" style={{ background: 'linear-gradient(135deg,#0a3d91,#0b5ed7)' }}>
          <BrandLogo src={t.brandLogo} className="w-10 h-10 flex-shrink-0" />
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-base font-bold truncate">{t.appName || t.brandName}</p>
            {t.appTagline && <p className="text-[10px] text-blue-100 truncate">{t.appTagline}</p>}
          </div>
          <button type="button" onClick={() => setSheet({ kind: 'app' })} className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white text-xs font-semibold" style={{ color: BLUE }}>
            <Download className="w-4 h-4" /> Download App
          </button>
        </div>
      </div>

      {flash && (
        <div className={`${overlay} left-1/2 -translate-x-1/2 bottom-6 z-[60] px-4 py-2 rounded-full bg-slate-900 text-white text-xs shadow-lg`}>{flash}</div>
      )}

      {/* Bottom sheets */}
      {sheet && (
        <div className={`${overlay} inset-0 z-50 flex items-end justify-center bg-black/50`} onClick={() => setSheet(null)}>
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto ${sheet.kind === 'gallery' ? 'bg-slate-900' : 'bg-white'} rounded-t-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {sheet.kind === 'gallery' ? (
              <div className="p-3 text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Gallery</p>
                  <button type="button" onClick={() => setSheet(null)} aria-label="Close"><X className="w-5 h-5" /></button>
                </div>
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <img src={t.gallery[galleryIndex]?.image} alt="gallery" className="w-full max-h-[55vh] object-contain" />
                  {t.gallery[galleryIndex]?.label && (
                    <span className={`absolute left-2 top-2 px-2 py-0.5 rounded text-xs font-semibold ${t.gallery[galleryIndex].label === 'Before' ? 'bg-red-500' : 'bg-green-600'}`}>{t.gallery[galleryIndex].label}</span>
                  )}
                  <button type="button" onClick={() => setSheet({ kind: 'gallery', index: (galleryIndex - 1 + t.gallery.length) % t.gallery.length })} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center" aria-label="Previous"><ChevronLeft className="w-6 h-6" /></button>
                  <button type="button" onClick={() => setSheet({ kind: 'gallery', index: (galleryIndex + 1) % t.gallery.length })} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center" aria-label="Next"><ChevronRight className="w-6 h-6" /></button>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/50 text-xs">{galleryIndex + 1}/{t.gallery.length}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
                  {t.gallery.map((g, i) => (
                    <button key={i} type="button" onClick={() => setSheet({ kind: 'gallery', index: i })} className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 ${i === galleryIndex ? 'border-white' : 'border-transparent opacity-70'}`}>
                      <img src={g.image} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4">
                {sheet.kind === 'service' && service && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <button type="button" onClick={() => setSheet(null)} aria-label="Back"><ArrowLeft className="w-5 h-5 text-slate-700" /></button>
                      <p className="flex-1 text-center font-semibold text-slate-900 pr-5">{service.name}</p>
                    </div>
                    <Img src={service.image} alt={service.name} className="w-full h-44 rounded-xl" iconSize="w-10 h-10" />
                    <p className="mt-3 text-lg font-bold text-slate-900">{service.name}</p>
                    {service.price && <p className="text-sm text-slate-600">{formatPrice(service.price)}</p>}
                    {service.features.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {service.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-700"><CircleCheck className="w-4 h-4 text-green-600" /> {f}</li>
                        ))}
                      </ul>
                    )}
                    <button type="button" onClick={() => openWhatsApp(`Hi ${t.businessName}, I want to book "${service.name}".`)} className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold" style={{ background: BLUE }}>
                      <CalendarCheck className="w-5 h-5" /> Book Now
                    </button>
                  </>
                )}

                {sheet.kind === 'services' && (
                  <>
                    <SheetHeader title="Our Services" onClose={() => setSheet(null)} />
                    <div className="grid grid-cols-3 gap-2">
                      {services.map((s, i) => (
                        <button key={i} type="button" onClick={() => setSheet({ kind: 'service', index: i })} className="rounded-lg border border-slate-200 overflow-hidden text-center">
                          <Img src={s.image} alt={s.name} className="w-full h-16" iconSize="w-5 h-5" />
                          <p className="text-[11px] font-semibold px-1 pt-1 truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-500 pb-1.5">{formatPrice(s.price)}</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {sheet.kind === 'payment' && (
                  <>
                    <SheetHeader title="Payment" onClose={() => setSheet(null)} />
                    <p className="text-center font-semibold text-slate-900">Pay to {t.payeeName || t.businessName}</p>
                    {upiQr ? (
                      <>
                        <img src={upiQr} alt="UPI QR" className="mx-auto mt-3 w-48 h-48" />
                        <p className="text-center text-sm text-slate-700 mt-2">UPI ID: <span className="font-semibold">{t.upiId}</span></p>
                        <a href={upiLink} className="sm:hidden mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold" style={{ background: BLUE }}>
                          <QrCode className="w-5 h-5" /> Pay with UPI App
                        </a>
                        <button type="button" onClick={() => openWhatsApp(`Pay to ${t.payeeName || t.businessName}\nUPI ID: ${t.upiId}\n${pageUrl}`)} className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white font-semibold">
                          <WhatsAppIcon className="w-5 h-5" /> Share Payment on WhatsApp
                        </button>
                        <button type="button" onClick={() => copy(t.upiId, 'UPI ID copied')} className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold" style={{ color: BLUE }}>
                          <Copy className="w-4 h-4" /> Copy UPI ID
                        </button>
                      </>
                    ) : (
                      <p className="text-center text-sm text-slate-500 py-8">UPI payment details are not added yet.</p>
                    )}
                  </>
                )}

                {sheet.kind === 'share' && (
                  <>
                    <SheetHeader title="Share Business Profile" onClose={() => setSheet(null)} />
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 text-xs text-slate-700">
                        <span className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white"><WhatsAppIcon className="w-6 h-6" /></span>WhatsApp
                      </a>
                      <button type="button" onClick={() => { copy(pageUrl, 'Link copied — paste it in Instagram'); window.open('https://www.instagram.com/', '_blank'); }} className="flex flex-col items-center gap-1 text-xs text-slate-700">
                        <span className="w-12 h-12 rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(45deg,#f9a825,#e91e63,#7b1fa2)' }}><Instagram className="w-6 h-6" /></span>Instagram
                      </button>
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 text-xs text-slate-700">
                        <span className="w-12 h-12 rounded-full bg-[#1877f2] flex items-center justify-center text-white"><Facebook className="w-6 h-6" /></span>Facebook
                      </a>
                      <a href={`https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(t.businessName)}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 text-xs text-slate-700">
                        <span className="w-12 h-12 rounded-full bg-[#229ed9] flex items-center justify-center text-white"><Send className="w-6 h-6" /></span>Telegram
                      </a>
                    </div>
                    <div className="mt-4 space-y-2">
                      <ShareRow icon={Link2} label="Copy Link" onClick={() => copy(pageUrl, 'Link copied')} />
                      <ShareRow icon={busy ? Loader2 : ImageDown} label="Share as Image" onClick={shareAsImage} spin={busy} />
                      <ShareRow icon={ScanLine} label="Share QR Code" onClick={() => setSheet({ kind: 'qr' })} />
                    </div>
                  </>
                )}

                {sheet.kind === 'qr' && (
                  <>
                    <SheetHeader title="Scan to open profile" onClose={() => setSheet(null)} />
                    {pageQr && <img src={pageQr} alt="Profile QR" className="mx-auto w-52 h-52" />}
                    <p className="text-center text-xs text-slate-500 mt-2 break-all">{pageUrl}</p>
                    <button type="button" onClick={() => downloadDataUrl(pageQr, `${t.slug || 'business'}-qr.png`)} className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold" style={{ background: BLUE }}>
                      <Download className="w-5 h-5" /> Download QR Code
                    </button>
                  </>
                )}

                {sheet.kind === 'app' && (
                  <>
                    <SheetHeader title="Download App" onClose={() => setSheet(null)} />
                    <div className="flex items-center gap-2">
                      <BrandLogo src={t.brandLogo} className="w-10 h-10" />
                      <div className="leading-tight">
                        <p className="text-xl font-extrabold" style={{ color: BLUE }}>{t.brandName}</p>
                        {t.appTagline && <p className="text-[11px] text-slate-500">{t.appTagline}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {t.playStoreUrl && <a href={t.playStoreUrl} target="_blank" rel="noreferrer" className="flex-1 px-3 py-2 rounded-lg bg-black text-white text-center text-xs font-semibold">GET IT ON<br /><span className="text-sm">Google Play</span></a>}
                      {t.appStoreUrl && <a href={t.appStoreUrl} target="_blank" rel="noreferrer" className="flex-1 px-3 py-2 rounded-lg bg-black text-white text-center text-xs font-semibold">Download on the<br /><span className="text-sm">App Store</span></a>}
                    </div>
                    {!t.playStoreUrl && !t.appStoreUrl && <p className="text-xs text-slate-500 mt-3">App links coming soon.</p>}
                    {t.appBenefits.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {t.appBenefits.map((b, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-700"><CircleCheck className="w-4 h-4 text-green-600" /> {b}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {sheet.kind === 'reviews' && (
                  <>
                    <SheetHeader title="Customer Reviews" onClose={() => setSheet(null)} />
                    <div className="space-y-3">
                      {reviews.map((r, i) => (
                        <div key={i} className="flex gap-2 border-b border-slate-100 pb-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-blue-100 flex items-center justify-center text-sm font-bold" style={{ color: BLUE }}>
                            {r.photo ? <img src={r.photo} alt={r.name} className="w-full h-full object-cover" /> : r.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{r.name}</p>
                            <div className="flex items-center gap-1.5"><Stars value={r.rating} size="w-3 h-3" /><span className="text-[11px] text-slate-500">{formatReviewDate(r.date)}</span></div>
                            <p className="text-xs text-slate-600 mt-1">{r.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {sheet.kind === 'writeReview' && (
                  <>
                    <SheetHeader title="Write a Review" onClose={() => setSheet(null)} />
                    <div className="flex justify-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button key={i} type="button" onClick={() => setReviewForm((f) => ({ ...f, rating: i }))} aria-label={`${i} stars`}>
                          <Star className={`w-8 h-8 ${i <= reviewForm.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                    <input value={reviewForm.name} onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name" maxLength={60} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2" />
                    <textarea value={reviewForm.text} onChange={(e) => setReviewForm((f) => ({ ...f, text: e.target.value }))} placeholder="Share your experience" rows={4} maxLength={600} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    {reviewError && <p className="text-xs text-red-600 mt-1">{reviewError}</p>}
                    <button type="button" onClick={submitReview} disabled={busy} className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold disabled:opacity-60" style={{ background: BLUE }}>
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />} Submit Review
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="font-semibold text-slate-900">{title}</p>
      <button type="button" onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-slate-500" /></button>
    </div>
  );
}

function ShareRow({ icon: Icon, label, onClick, spin }: { icon: React.ElementType; label: string; onClick: () => void; spin?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
      <Icon className={`w-4 h-4 text-slate-500 ${spin ? 'animate-spin' : ''}`} /> {label}
    </button>
  );
}

export default TemplatePreview;
