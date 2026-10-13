// ============================================================================
// 🔹 Business profile templates — shared types + defaults.
// A template is a single-page business profile (header, profile, action buttons,
// services, about, gallery, reviews, payment, other services, app download)
// that an admin builds in /template, saves to the `business_templates`
// collection, downloads as an image, and shares via its public /p/<slug> page.
// ============================================================================

export interface TemplateService {
  name: string;
  price: string; // e.g. "300" → rendered as "₹300 Onwards"
  image: string; // data URL
  features: string[];
}

export interface TemplateGalleryItem {
  image: string; // data URL
  label: '' | 'Before' | 'After';
}

export interface TemplateReview {
  name: string;
  rating: number; // 1–5
  date: string; // ISO date (yyyy-mm-dd)
  text: string;
  photo: string; // data URL (optional)
}

export interface TemplateOtherService {
  name: string;
  icon: string; // key of OTHER_SERVICE_ICONS
}

export interface BusinessTemplate {
  id?: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';

  // 1. Header
  brandName: string;
  brandTagline: string;
  brandLogo: string; // data URL; falls back to the house icon

  // 2. Business profile
  coverImage: string;
  photo: string;
  verified: boolean;
  businessName: string;
  category: string;
  location: string;
  mapUrl: string;
  rating: string; // manual override, e.g. "4.8" — blank = average of reviews
  reviewCount: string; // manual override, e.g. "120" — blank = number of reviews

  // 3. Action buttons
  phone: string;
  whatsapp: string;

  // 4. Services
  services: TemplateService[];

  // 5. About
  experience: string;
  workingDays: string;
  workingHours: string;
  serviceArea: string;
  weProvide: string;
  description: string;

  // 6. Gallery
  gallery: TemplateGalleryItem[];

  // 7. Reviews
  reviews: TemplateReview[];

  // 8. Payment
  upiId: string;
  payeeName: string;

  // 9. Other services
  otherServices: TemplateOtherService[];
  exploreUrl: string;

  // 10. App download
  appName: string;
  appTagline: string;
  playStoreUrl: string;
  appStoreUrl: string;
  appBenefits: string[];

  createdByUserName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const OTHER_SERVICE_ICONS = [
  'Electrician', 'AC Service', 'Cleaning', 'Painting', 'Carpenter', 'Plumbing',
  'Pest Control', 'Appliance Repair', 'Shifting', 'More',
] as const;

export const MAX_SERVICES = 12;
export const MAX_GALLERY = 12;

export function emptyService(): TemplateService {
  return { name: '', price: '', image: '', features: [] };
}

export function emptyReview(): TemplateReview {
  return { name: '', rating: 5, date: new Date().toISOString().slice(0, 10), text: '', photo: '' };
}

export function defaultTemplate(): BusinessTemplate {
  return {
    slug: '',
    status: 'PUBLISHED',
    brandName: 'Rento AI',
    brandTagline: 'Your Home. Every Service. One App.',
    brandLogo: '',
    coverImage: '',
    photo: '',
    verified: true,
    businessName: '',
    category: '',
    location: '',
    mapUrl: '',
    rating: '',
    reviewCount: '',
    phone: '',
    whatsapp: '',
    services: [emptyService()],
    experience: '',
    workingDays: 'Mon - Sun',
    workingHours: '8:00 AM - 8:00 PM',
    serviceArea: '',
    weProvide: 'Residential | Commercial | Emergency Service',
    description: '',
    gallery: [],
    reviews: [],
    upiId: '',
    payeeName: '',
    otherServices: ['Electrician', 'AC Service', 'Cleaning', 'Painting', 'Carpenter', 'More'].map((n) => ({ name: n, icon: n })),
    exploreUrl: '',
    appName: 'Rento AI App',
    appTagline: 'Your Home. Every Service. One App.',
    playStoreUrl: '',
    appStoreUrl: '',
    appBenefits: ['Verified Service Providers', 'All Home Services', 'Easy Booking', 'Save Time & Money'],
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Rating shown on the page: the admin's manual value, else the average of reviews.
export function displayRating(t: BusinessTemplate): { rating: number; count: number } {
  const avg = t.reviews.length ? t.reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / t.reviews.length : 0;
  const rating = t.rating.trim() ? Number(t.rating) || 0 : avg;
  const count = t.reviewCount.trim() ? Number(t.reviewCount) || 0 : t.reviews.length;
  return { rating: Math.round(rating * 10) / 10, count };
}

// Digits only, with India's 91 prefix for 10-digit numbers (for wa.me links).
export function waNumber(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}
