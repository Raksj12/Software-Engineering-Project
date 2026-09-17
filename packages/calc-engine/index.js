/**
 * @loanscope/calc-engine
 *
 * Pure, framework-independent amortization calculation module (REQ-10).
 * No DOM, no React, no Express, no I/O - just math - so the exact same file
 * can be `require()`d by the Node/Express backend AND bundled into the
 * browser by Vite for instant client-side recalculation.
 *
 * All currency math is performed in integer CENTS (REQ-9) to avoid
 * floating-point rounding error accumulating over up to 1,200 iterations.
 */

export const MAX_MONTHS = 1200; // REQ-8: cap schedule at 100 years

export const LIMITS = {
  PRINCIPAL_MIN: 1,
  PRINCIPAL_MAX: 100_000_000,
  RATE_MIN: 0,
  RATE_MAX: 40,
  RATE_STEP: 0.01,
  PAYMENT_MIN: 1,
  PAYMENT_MAX_FLOOR: 1_000_000
};

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export function toCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

export function toDollars(cents) {
  return cents / 100;
}

/**
 * Monthly interest rate as a plain fraction (not percent), from an annual
 * percentage rate, using simple monthly compounding (APR / 12).
 */
function monthlyRateFraction(annualRatePercent) {
  return annualRatePercent / 100 / 12;
}

/**
 * The interest that would accrue in one month on a given principal, in
 * cents (kept fractional internally for accuracy, rounded only at the edges).
 */
function monthlyInterestOnPrincipal(principalCents, annualRatePercent) {
  return principalCents * monthlyRateFraction(annualRatePercent);
}

/**
 * Computes the minimum viable monthly payment for a loan: the payment that
 * covers one month of interest plus a single cent of principal. Used both
 * to reject non-amortizing payments (REQ-4) and to derive the slider's
 * default max (REQ-3: "thrice the computed minimum payment").
 * Returns a dollar amount (float, 2dp).
 */
export function computeMinimumPayment(principal, annualRatePercent) {
  const principalCents = toCents(principal);
  if (annualRatePercent <= 0) {
    // With 0% interest, the "minimum" payment to ever finish is just
    // enough to make progress; use 1 cent above zero as a floor.
    return 0.01;
  }
  const interest = monthlyInterestOnPrincipal(principalCents, annualRatePercent);
  return toDollars(Math.ceil(interest) + 1);
}

/**
 * Validates the three primary loan inputs against SRS ranges (REQ-1, REQ-2,
 * REQ-3) and the non-amortizing-payment rule (REQ-4). Never silently clamps
 * (per the Safety Requirements) - throws a ValidationError with a
 * human-readable message instead.
 */
export function validateInputs({ principal, annualRatePercent, monthlyPayment }) {
  const errors = [];

  if (typeof principal !== 'number' || Number.isNaN(principal)) {
    errors.push({ field: 'principal', message: 'Starting principal must be a number.' });
  } else if (principal < LIMITS.PRINCIPAL_MIN || principal > LIMITS.PRINCIPAL_MAX) {
    errors.push({
      field: 'principal',
      message: `Starting principal must be between $${LIMITS.PRINCIPAL_MIN.toLocaleString()} and $${LIMITS.PRINCIPAL_MAX.toLocaleString()}.`
    });
  }

  if (typeof annualRatePercent !== 'number' || Number.isNaN(annualRatePercent)) {
    errors.push({ field: 'annualRatePercent', message: 'Annual interest rate must be a number.' });
  } else if (annualRatePercent < LIMITS.RATE_MIN || annualRatePercent > LIMITS.RATE_MAX) {
    errors.push({
      field: 'annualRatePercent',
      message: `Annual interest rate must be between ${LIMITS.RATE_MIN}% and ${LIMITS.RATE_MAX}%.`
    });
  }

  if (typeof monthlyPayment !== 'number' || Number.isNaN(monthlyPayment)) {
    errors.push({ field: 'monthlyPayment', message: 'Monthly payment must be a number.' });
  } else if (monthlyPayment < LIMITS.PAYMENT_MIN) {
    errors.push({
      field: 'monthlyPayment',
      message: `Monthly payment must be at least $${LIMITS.PAYMENT_MIN}.`
    });
  }

  // REQ-4: reject a payment that doesn't even cover monthly interest, which
  // would mean the loan is never paid off (balance grows or stalls forever).
  if (errors.length === 0) {
    const principalCents = toCents(principal);
    const interestCents = monthlyInterestOnPrincipal(principalCents, annualRatePercent);
    const paymentCents = toCents(monthlyPayment);
    if (paymentCents <= interestCents) {
      errors.push({
        field: 'monthlyPayment',
        message:
          'At this payment amount, the loan would never be paid off: the payment does not exceed the interest accrued each month.'
      });
    }
  }

  return errors;
}

/**
 * REQ-3 helper: the slider's practical maximum for monthly payment, i.e.
 * the greater of $1,000,000 or 3x the computed minimum (amortizing) payment.
 */
export function computePaymentSliderMax(principal, annualRatePercent) {
  const minPayment = computeMinimumPayment(principal, annualRatePercent);
  return Math.max(LIMITS.PAYMENT_MAX_FLOOR, minPayment * 3);
}

/**
 * Computes the full month-by-month amortization schedule.
 *
 * @returns {{
 *   schedule: Array<{month:number, payment:number, principalPaid:number, interestPaid:number, remainingBalance:number, cumulativeInterest:number, cumulativePrincipal:number}>,
 *   payoffMonths: number,
 *   totalInterestPaid: number,
 *   totalPrincipalPaid: number,
 *   exceededHorizon: boolean
 * }}
 */
export function computeSchedule({ principal, annualRatePercent, monthlyPayment }) {
  const errors = validateInputs({ principal, annualRatePercent, monthlyPayment });
  if (errors.length > 0) {
    const err = new ValidationError(errors[0].message, errors[0].field);
    err.errors = errors;
    throw err;
  }

  let balanceCents = toCents(principal);
  const paymentCents = toCents(monthlyPayment);
  const monthlyRate = monthlyRateFraction(annualRatePercent);

  const schedule = [];
  let cumulativeInterestCents = 0;
  let cumulativePrincipalCents = 0;
  let exceededHorizon = false;

  for (let month = 1; month <= MAX_MONTHS; month++) {
    if (balanceCents <= 0) break;

    // Interest for this month, rounded to the nearest cent at application time.
    const interestCentsRaw = balanceCents * monthlyRate;
    const interestCents = Math.round(interestCentsRaw);

    let actualPaymentCents = paymentCents;
    let principalPaidCents = actualPaymentCents - interestCents;

    // Final payment: don't overpay past a zero balance.
    if (principalPaidCents >= balanceCents) {
      principalPaidCents = balanceCents;
      actualPaymentCents = principalPaidCents + interestCents;
      balanceCents = 0;
    } else {
      balanceCents -= principalPaidCents;
    }

    cumulativeInterestCents += interestCents;
    cumulativePrincipalCents += principalPaidCents;

    schedule.push({
      month,
      payment: toDollars(actualPaymentCents),
      principalPaid: toDollars(principalPaidCents),
      interestPaid: toDollars(interestCents),
      remainingBalance: toDollars(balanceCents),
      cumulativeInterest: toDollars(cumulativeInterestCents),
      cumulativePrincipal: toDollars(cumulativePrincipalCents)
    });

    if (month === MAX_MONTHS && balanceCents > 0) {
      exceededHorizon = true; // REQ-8
    }
  }

  return {
    schedule,
    payoffMonths: schedule.length,
    totalInterestPaid: toDollars(cumulativeInterestCents),
    totalPrincipalPaid: toDollars(cumulativePrincipalCents),
    exceededHorizon
  };
}

/**
 * Converts a payoff month count into a payoff date (from "today") and a
 * human-friendly years/months term string, for headline summary display
 * (REQ-13).
 */
export function computePayoffDate(payoffMonths, fromDate = new Date()) {
  const payoff = new Date(fromDate.getTime());
  payoff.setMonth(payoff.getMonth() + payoffMonths);
  return payoff;
}

export function formatTerm(payoffMonths) {
  const years = Math.floor(payoffMonths / 12);
  const months = payoffMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months > 0 || years === 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  return parts.join(', ');
}
