import { JWTPayload } from '@/lib/auth';
import {
  BusinessTemplate, MAX_GALLERY, MAX_SERVICES, OTHER_SERVICE_ICONS, defaultTemplate, slugify,
} from '@/components/template/types';

// Only admins build templates.
export function isAdmin(user: JWTPayload | null): boolean {
  return !!user && (user.roles || []).some((r) => String(r).toLowerCase() === 'admin');
}

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Images are client-compressed JPEG data URLs; anything else (or oversized) is dropped.
const img = (v: unknown) => (typeof v === 'string' && v.startsWith('data:image/') && v.length < 1_500_000 ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strList = (v: unknown, maxItems: number, max = 120) =>
  arr(v).map((x) => str(x, max)).filter(Boolean).slice(0, maxItems);

// Whitelist + coerce every field so arbitrary keys never reach Mongo.
export function sanitizeTemplate(body: any): Omit<BusinessTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserName'> {
  const d = defaultTemplate();
  const businessName = str(body?.businessName, 120);
  return {
    slug: slugify(str(body?.slug, 80) || businessName),
    status: body?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    brandName: str(body?.brandName, 60) || d.brandName,
    brandTagline: str(body?.brandTagline, 120),
    brandLogo: img(body?.brandLogo),
    coverImage: img(body?.coverImage),
    photo: img(body?.photo),
    verified: !!body?.verified,
    businessName,
    category: str(body?.category, 150),
    location: str(body?.location, 150),
    mapUrl: str(body?.mapUrl, 500),
    rating: str(body?.rating, 4),
    reviewCount: str(body?.reviewCount, 8),
    phone: str(body?.phone, 20),
    whatsapp: str(body?.whatsapp, 20),
    services: arr(body?.services).slice(0, MAX_SERVICES).map((s: any) => ({
      name: str(s?.name, 80),
      price: str(s?.price, 20),
      image: img(s?.image),
      features: strList(s?.features, 10),
    })).filter((s) => s.name),
    experience: str(body?.experience, 40),
    workingDays: str(body?.workingDays, 60),
    workingHours: str(body?.workingHours, 60),
    serviceArea: str(body?.serviceArea, 300),
    weProvide: str(body?.weProvide, 200),
    description: str(body?.description, 2000),
    gallery: arr(body?.gallery).slice(0, MAX_GALLERY).map((g: any) => ({
      image: img(g?.image),
      label: (g?.label === 'Before' || g?.label === 'After' ? g.label : '') as '' | 'Before' | 'After',
    })).filter((g) => g.image),
    reviews: arr(body?.reviews).slice(0, 50).map((r: any) => ({
      name: str(r?.name, 60),
      rating: Math.min(5, Math.max(1, Math.round(Number(r?.rating) || 5))),
      date: str(r?.date, 10),
      text: str(r?.text, 600),
      photo: img(r?.photo),
    })).filter((r) => r.name && r.text),
    upiId: str(body?.upiId, 80),
    payeeName: str(body?.payeeName, 120),
    otherServices: arr(body?.otherServices).slice(0, 12).map((o: any) => ({
      name: str(o?.name, 40),
      icon: (OTHER_SERVICE_ICONS as readonly string[]).includes(o?.icon) ? o.icon : 'More',
    })).filter((o) => o.name),
    exploreUrl: str(body?.exploreUrl, 500),
    appName: str(body?.appName, 60),
    appTagline: str(body?.appTagline, 120),
    playStoreUrl: str(body?.playStoreUrl, 500),
    appStoreUrl: str(body?.appStoreUrl, 500),
    appBenefits: strList(body?.appBenefits, 8),
  };
}

export function toClient(doc: any) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}
