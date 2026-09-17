import React, { useMemo, useRef } from 'react';
import { LIMITS } from '@loanscope/calc-engine';
import { debounce } from '../utils/debounce.js';
import { formatCurrency } from '../utils/format.js';

function Field({ label, unit, value, min, max, step, onSliderChange, onNumberChange, displayValue, fieldError }) {
  return (
    <div className="field">
      <div className="field-row">
        <label className="field-label">{label}</label>
        <div className={`field-number ${fieldError ? 'field-number--error' : ''}`}>
          {unit === '$' && <span className="field-unit">$</span>}
          <input
            type="number"
            className="mono"
            value={displayValue}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onNumberChange(e.target.value)}
            aria-label={label}
          />
          {unit === '%' && <span className="field-unit">%</span>}
        </div>
      </div>
      <input
        type="range"
        className="field-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onSliderChange(Number(e.target.value))}
        aria-label={`${label} slider`}
      />
      <div className="field-range">
        <span>{unit === '$' ? formatCurrency(min, { maximumFractionDigits: 0 }) : `${min}%`}</span>
        <span>{unit === '$' ? formatCurrency(max, { maximumFractionDigits: 0 }) : `${max}%`}</span>
      </div>
    </div>
  );
}

export default function LoanInputs({ scenario, paymentMax, minimumPayment, onChange, fieldErrors }) {
  // REQ-5: numeric field edits are debounced 300ms; slider drags are not.
  const debouncedChangeRef = useRef(debounce(onChange, 300));

  const errorByField = useMemo(() => {
    const map = {};
    (fieldErrors || []).forEach((e) => {
      map[e.field] = e.message;
    });
    return map;
  }, [fieldErrors]);

  const handleNumber = (field) => (rawValue) => {
    const num = Number(rawValue);
    debouncedChangeRef.current({ ...scenario, [field]: rawValue === '' ? '' : num });
  };

  const handleSlider = (field) => (num) => {
    onChange({ ...scenario, [field]: num });
  };

  return (
    <div className="loan-inputs">
      <Field
        label="Starting principal"
        unit="$"
        value={scenario.principal}
        displayValue={scenario.principal}
        min={LIMITS.PRINCIPAL_MIN}
        max={LIMITS.PRINCIPAL_MAX}
        step={100}
        onSliderChange={handleSlider('principal')}
        onNumberChange={handleNumber('principal')}
        fieldError={errorByField.principal}
      />
      <Field
        label="Annual interest rate"
        unit="%"
        value={scenario.annualRatePercent}
        displayValue={scenario.annualRatePercent}
        min={LIMITS.RATE_MIN}
        max={LIMITS.RATE_MAX}
        step={LIMITS.RATE_STEP}
        onSliderChange={handleSlider('annualRatePercent')}
        onNumberChange={handleNumber('annualRatePercent')}
        fieldError={errorByField.annualRatePercent}
      />
      <Field
        label="Monthly payment"
        unit="$"
        value={scenario.monthlyPayment}
        displayValue={scenario.monthlyPayment}
        min={LIMITS.PAYMENT_MIN}
        max={paymentMax}
        step={10}
        onSliderChange={handleSlider('monthlyPayment')}
        onNumberChange={handleNumber('monthlyPayment')}
        fieldError={errorByField.monthlyPayment}
      />
      {minimumPayment != null && (
        <p className="field-hint mono">Minimum amortizing payment at this rate: {formatCurrency(minimumPayment)}/mo</p>
      )}
      {errorByField.monthlyPayment && (
        <p className="field-error" role="alert">
          {errorByField.monthlyPayment}
        </p>
      )}
      {errorByField.principal && (
        <p className="field-error" role="alert">
          {errorByField.principal}
        </p>
      )}
      {errorByField.annualRatePercent && (
        <p className="field-error" role="alert">
          {errorByField.annualRatePercent}
        </p>
      )}
    </div>
  );
}
