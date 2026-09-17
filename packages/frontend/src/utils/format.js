/**
 * Formats currency according to the user's browser locale, defaulting to
 * USD/en-US when the locale can't be determined (Section 5, "Other
 * Requirements").
 */
export function formatCurrency(value, opts = {}) {
  const locale = navigator.language || 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: opts.currency || 'USD',
      maximumFractionDigits: opts.maximumFractionDigits ?? 2,
      minimumFractionDigits: opts.minimumFractionDigits ?? 2
    }).format(value);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
}

export function formatNumber(value) {
  const locale = navigator.language || 'en-US';
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return new Intl.NumberFormat('en-US').format(value);
  }
}

export function formatDate(dateOrIso) {
  const date = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  const locale = navigator.language || 'en-US';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  } catch {
    return date.toDateString();
  }
}

/**
 * Triggers a browser download of the schedule as CSV (REQ-17). This runs
 * entirely client-side using the schedule already held in state, so export
 * is instant even though the backend also exposes an equivalent endpoint.
 */
export function downloadScheduleCsv(schedule, filename = 'loanscope-amortization-schedule.csv') {
  const header = 'Payment #,Payment Amount,Principal,Interest,Remaining Balance';
  const rows = schedule.map(
    (row) => `${row.month},${row.payment.toFixed(2)},${row.principalPaid.toFixed(2)},${row.interestPaid.toFixed(2)},${row.remainingBalance.toFixed(2)}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
