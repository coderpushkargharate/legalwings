// ✅ Centralized date formatting for consistency across all teams
// Dates display as DD/MM/YYYY. Time is intentionally never shown anywhere.
// The `showTime` parameter is kept for backward compatibility but is ignored.
export const formatDate = (dateString?: string | null, _showTime: boolean = false): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return '-';
  }
};

// Retained for backward compatibility — now returns date only (no time).
export const formatDateTime = (dateString?: string | null): string => {
  return formatDate(dateString);
};

// ✅ Get display date from lead with fallback chain
export const getLeadDisplayDate = (lead: any): string | null => {
  const dates = [
    lead.paymentDetails?.[0]?.paymentDate,
    lead.payment?.commissionDate,
    lead.agreement?.executeDate,
    lead.agreement?.agreementStartDate,
    lead.leadDate,
    lead.appointmentTime,
    lead.createdDate,
    lead.createdAt,
  ];
  return dates.find(d => d) || null;
};