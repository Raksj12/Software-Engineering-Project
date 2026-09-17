import assert from 'assert';
import { computeSchedule, computeMinimumPayment, validateInputs, formatTerm } from './index.js';

function run() {
  // Basic 30-year mortgage sanity check: $300,000 at 6% APR, ~$1798.65/mo
  const result = computeSchedule({
    principal: 300000,
    annualRatePercent: 6,
    monthlyPayment: 1798.65
  });
  assert.ok(result.payoffMonths >= 358 && result.payoffMonths <= 362, `expected ~360 months, got ${result.payoffMonths}`);
  assert.ok(result.schedule[result.schedule.length - 1].remainingBalance === 0, 'loan should fully amortize to $0');
  console.log('PASS: 30yr mortgage amortizes to ~360 months, balance 0');

  // REQ-4: payment that doesn't cover interest should be rejected
  const errors = validateInputs({ principal: 100000, annualRatePercent: 20, monthlyPayment: 100 });
  assert.ok(errors.length > 0, 'should reject a non-amortizing payment');
  console.log('PASS: non-amortizing payment rejected');

  // REQ-8: horizon cap - a payment just barely (1 cent) above the exact
  // monthly interest accrued makes payoff take far longer than 1200 months.
  const capped = computeSchedule({ principal: 100000000, annualRatePercent: 5, monthlyPayment: 416666.68 });
  assert.ok(capped.schedule.length <= 1200, 'schedule must never exceed 1200 months');
  assert.strictEqual(capped.exceededHorizon, true, 'this scenario should exceed the 100yr horizon');
  console.log('PASS: schedule capped at 1200 months, exceededHorizon =', capped.exceededHorizon);

  // REQ-9: no floating point drift - final balance must be exactly 0, not 0.00000003
  const clean = computeSchedule({ principal: 10000, annualRatePercent: 5, monthlyPayment: 500 });
  assert.strictEqual(clean.schedule[clean.schedule.length - 1].remainingBalance, 0);
  console.log('PASS: final balance is exact integer-cents zero');

  // 0% APR edge case
  const zeroApr = computeSchedule({ principal: 1200, annualRatePercent: 0, monthlyPayment: 100 });
  assert.strictEqual(zeroApr.payoffMonths, 12);
  assert.strictEqual(zeroApr.totalInterestPaid, 0);
  console.log('PASS: 0% APR loan pays off with zero interest');

  console.log('formatTerm(14) =', formatTerm(14));
  console.log('\nAll calc-engine tests passed.');
}

run();
