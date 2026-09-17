import express from 'express';
import cors from 'cors';
import {
  computeSchedule,
  computePaymentSliderMax,
  computeMinimumPayment,
  validateInputs,
  computePayoffDate,
  formatTerm,
  LIMITS,
  ValidationError
} from '@loanscope/calc-engine';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple request logger (no PII is ever logged - inputs are just numbers).
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

function parseScenarioQuery(query) {
  return {
    principal: Number(query.principal),
    annualRatePercent: Number(query.rate),
    monthlyPayment: Number(query.payment)
  };
}

function buildSummary(scenario) {
  const result = computeSchedule(scenario);
  const payoffDate = computePayoffDate(result.payoffMonths);
  return {
    ...result,
    payoffDate: payoffDate.toISOString(),
    termFormatted: formatTerm(result.payoffMonths),
    paymentSliderMax: computePaymentSliderMax(scenario.principal, scenario.annualRatePercent),
    minimumPayment: computeMinimumPayment(scenario.principal, scenario.annualRatePercent)
  };
}

// GET /api/limits - static + scenario-dependent input bounds (REQ-1, REQ-2, REQ-3)
app.get('/api/limits', (req, res) => {
  const principal = Number(req.query.principal) || 100000;
  const rate = Number(req.query.rate) || 5;
  res.json({
    ...LIMITS,
    paymentSliderMax: computePaymentSliderMax(principal, rate),
    minimumPayment: computeMinimumPayment(principal, rate)
  });
});

// POST /api/validate - validate a scenario without computing the full schedule
// (used when loading a shared link - REQ-21)
app.post('/api/validate', (req, res) => {
  const scenario = {
    principal: Number(req.body.principal),
    annualRatePercent: Number(req.body.annualRatePercent),
    monthlyPayment: Number(req.body.monthlyPayment)
  };
  const errors = validateInputs(scenario);
  res.json({ valid: errors.length === 0, errors });
});

// POST /api/schedule - the main calculation endpoint (REQ-6, REQ-7, REQ-8)
app.post('/api/schedule', (req, res, next) => {
  try {
    const scenario = {
      principal: Number(req.body.principal),
      annualRatePercent: Number(req.body.annualRatePercent),
      monthlyPayment: Number(req.body.monthlyPayment)
    };
    const summary = buildSummary(scenario);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/schedule/csv - CSV export of the full schedule (REQ-17)
app.get('/api/schedule/csv', (req, res, next) => {
  try {
    const scenario = parseScenarioQuery(req.query);
    const { schedule } = computeSchedule(scenario);

    const header = 'Payment #,Payment Amount,Principal,Interest,Remaining Balance\n';
    const rows = schedule
      .map(
        (row) =>
          `${row.month},${row.payment.toFixed(2)},${row.principalPaid.toFixed(2)},${row.interestPaid.toFixed(2)},${row.remainingBalance.toFixed(2)}`
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="loanscope-amortization-schedule.csv"');
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Central error handler - always returns a clear, structured JSON error
// (never a silent failure or an HTML stack trace) per the Safety Requirements
// and the "clear error responses" need of the Developer user class.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: err.message,
      field: err.field,
      errors: err.errors || [{ field: err.field, message: err.message }]
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`LoanScope backend listening on http://localhost:${PORT}`);
});

export default app;
