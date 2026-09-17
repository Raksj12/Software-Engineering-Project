import React from 'react';
import { formatCurrency, formatDate } from '../utils/format.js';

export default function SummaryHeadline({ result }) {
  if (!result) return null;

  return (
    <div className="summary-headline">
      <div className="summary-stat">
        <span className="summary-label">Payoff date</span>
        <span className="summary-value">{formatDate(result.payoffDate)}</span>
      </div>
      <div className="summary-stat">
        <span className="summary-label">Loan term</span>
        <span className="summary-value">{result.termFormatted}</span>
      </div>
      <div className="summary-stat">
        <span className="summary-label">Total interest paid</span>
        <span className="summary-value summary-value--warn">{formatCurrency(result.totalInterestPaid)}</span>
      </div>
      <div className="summary-stat">
        <span className="summary-label">Total paid</span>
        <span className="summary-value">{formatCurrency(result.totalInterestPaid + result.totalPrincipalPaid)}</span>
      </div>
      {result.exceededHorizon && (
        <p className="horizon-warning" role="alert">
          At this payment, the loan would not pay off within 100 years (1,200 months). The schedule below is capped at
          that horizon.
        </p>
      )}
    </div>
  );
}
