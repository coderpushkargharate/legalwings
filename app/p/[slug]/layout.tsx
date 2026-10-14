import type { Metadata } from 'next';
import { connectToDatabase } from '@/lib/mongodb';

// Link previews (WhatsApp etc.) of a shared /p/<slug> page show the business, not the CRM.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('business_templates').findOne(
      { slug: params.slug, status: 'PUBLISHED' },
      { projection: { businessName: 1, category: 1, location: 1 } },
    );
    if (doc) {
      const title = doc.businessName || 'Business Profile';
      const description = [doc.category, doc.location].filter(Boolean).join(' · ') || title;
      return {
        title,
        description,
        manifest: null,
        appleWebApp: null,
        openGraph: { title, description, type: 'website' },
      };
    }
  } catch (error) {
    console.error('Public template metadata error:', error);
  }
  return { title: 'Business Profile', description: 'Business Profile', manifest: null, appleWebApp: null };
}

export default function PublicTemplateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
