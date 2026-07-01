// ✅ Centralized date formatting for consistency across all teams
// Dates display as DD.MM.YYYY and times use a 12-hour clock (hh:mm AM/PM).
export const formatDate = (dateString?: string | null, showTime: boolean = false): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const datePart = `${dd}.${mm}.${yyyy}`;

    if (showTime) {
      // DD.MM.YYYY hh:mm AM/PM (12-hour clock)
      const timePart = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${datePart} ${timePart}`;
    }

    return datePart;
  } catch {
    return '-';
  }
};

export const formatDateTime = (dateString?: string | null): string => {
  return formatDate(dateString, true);
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