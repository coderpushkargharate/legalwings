// Business details shown on the public policy pages (privacy, terms, refund, contact).
// Cashfree's website review checks these against the KYC on the merchant account,
// so the legal name, address, email and phone must match what was submitted there.
export const BUSINESS = {
  brandName: 'LegalWings',
  legalName: 'LegalWings', // TODO: registered business / proprietor name as per Cashfree KYC
  website: 'https://legalwings.in', // TODO: the exact domain submitted to Cashfree
  email: 'support@legalwings.in', // TODO
  phone: '+91 00000 00000', // TODO
  address: 'Office address, City, State - PIN, India', // TODO
  city: 'Pune', // TODO: city whose courts have jurisdiction
  supportHours: 'Monday to Saturday, 10:00 AM – 7:00 PM IST',
  lastUpdated: '27 October 2026',
};
