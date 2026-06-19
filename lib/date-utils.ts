// ✅ Centralized date formatting for consistency across all teams
export const formatDate = (dateString?: string | null, showTime: boolean = false): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    if (showTime) {
      // DD/MM/YY HH:MM
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // DD/MM/YY
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
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