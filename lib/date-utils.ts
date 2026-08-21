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

// ✅ Appointment display: shows both date (DD/MM/YYYY) and time (hh:mm AM/PM).
// Appointments need the time slot, unlike other date columns.
//
// The time is read DIRECTLY from the ISO string parts (YYYY-MM-DDTHH:mm) instead
// of going through `new Date()`. `new Date(...).getHours()` applies the browser's
// local timezone, so any value carrying a `Z`/UTC suffix (e.g. after a DB round-trip)
// gets shifted by the offset (IST +5:30) and the AM/PM flips. Parsing the parts
// keeps the displayed time identical to what the user entered.
export const formatAppointment = (dateString?: string | null): string => {
  if (!dateString) return '-';
  try {
    // Match "YYYY-MM-DD" and an optional "THH:mm" time part, ignoring any
    // trailing seconds / milliseconds / timezone suffix.
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(dateString.trim());
    if (m) {
      const [, yyyy, mm, dd, hStr, minStr] = m;
      const datePart = `${dd}/${mm}/${yyyy}`;
      if (hStr === undefined) return datePart;

      let hours = parseInt(hStr, 10);
      const minutes = minStr;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const hh = String(hours).padStart(2, '0');
      return `${datePart} ${hh}:${minutes} ${ampm}`;
    }

    // Fallback for any non-ISO value.
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, '0');

    return `${dd}/${mm}/${yyyy} ${hh}:${minutes} ${ampm}`;
  } catch {
    return '-';
  }
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