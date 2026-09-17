import React, { useEffect, useMemo, useState } from 'react';
import { computeSchedule, computePaymentSliderMax, computeMinimumPayment, computePayoffDate, formatTerm } from '@loanscope/calc-engine';
import LoanInputs from './components/LoanInputs.jsx';
import SummaryHeadline from './components/SummaryHeadline.jsx';
import BalanceChart from './components/BalanceChart.jsx';
import ScheduleTable from './components/ScheduleTable.jsx';
import ShareButton from './components/ShareButton.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { readScenarioFromUrl } from './utils/urlParams.js';
import './App.css';

const DEFAULT_SCENARIO = {
  principal: 300000,
  annualRatePercent: 6,
  monthlyPayment: 1800,
  overlayInterest: false
};

export default function App() {
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [loadNotice, setLoadNotice] = useState(null);

  // REQ-19, REQ-21: on first load, adopt a scenario from URL params if
  // present, validating and falling back to safe defaults per-field.
  useEffect(() => {
    const loaded = readScenarioFromUrl(DEFAULT_SCENARIO);
    if (loaded) {
      setScenario({ ...DEFAULT_SCENARIO, ...loaded.scenario });
      if (loaded.usedFallback) {
        setLoadNotice('Some values in the shared link were invalid or missing, so safe defaults were used for those fields.');
      }
    }
  }, []);

  // The calc engine is a pure module shared with the backend (Portability
  // NFR); running it here directly gives the sub-100ms local recalculation
  // required by the Performance Requirements as the user drags a slider.
  const { result, fieldErrors } = useMemo(() => {
    const principal = Number(scenario.principal);
    const annualRatePercent = Number(scenario.annualRatePercent);
    const monthlyPayment = Number(scenario.monthlyPayment);

    if ([principal, annualRatePercent, monthlyPayment].some((n) => Number.isNaN(n))) {
      return { result: null, fieldErrors: [] };
    }

    try {
      const schedule = computeSchedule({ principal, annualRatePercent, monthlyPayment });
      const payoffDate = computePayoffDate(schedule.payoffMonths);
      return {
        result: { ...schedule, payoffDate: payoffDate.toISOString(), termFormatted: formatTerm(schedule.payoffMonths) },
        fieldErrors: []
      };
    } catch (err) {
      return { result: null, fieldErrors: err.errors || [{ field: err.field, message: err.message }] };
    }
  }, [scenario.principal, scenario.annualRatePercent, scenario.monthlyPayment]);

  const paymentMax = useMemo(
    () => computePaymentSliderMax(Number(scenario.principal) || 1, Number(scenario.annualRatePercent) || 0),
    [scenario.principal, scenario.annualRatePercent]
  );

  const minimumPayment = useMemo(
    () => computeMinimumPayment(Number(scenario.principal) || 1, Number(scenario.annualRatePercent) || 0),
    [scenario.principal, scenario.annualRatePercent]
  );

  return (
    <div className="app-shell">
      <Disclaimer />

      <header className="masthead">
        <div>
          <h1>LoanScope</h1>
          <p className="tagline mono">a clear statement of where your loan is headed</p>
        </div>
        <ShareButton scenario={scenario} />
      </header>

      {loadNotice && (
        <p className="load-notice mono" role="status">
          {loadNotice}
        </p>
      )}

      <main className="layout">
        <section className="panel panel-inputs" aria-label="Loan parameters">
          <h2>Loan parameters</h2>
          <LoanInputs
            scenario={scenario}
            paymentMax={paymentMax}
            minimumPayment={minimumPayment}
            fieldErrors={fieldErrors}
            onChange={(next) => setScenario((prev) => ({ ...prev, ...next }))}
          />
        </section>

        <section className="panel panel-statement" aria-label="Loan summary and chart">
          <h2>Statement</h2>
          {result ? (
            <>
              <SummaryHeadline result={result} />
              <BalanceChart
                schedule={result.schedule}
                showInterestOverlay={scenario.overlayInterest}
                onToggleOverlay={(v) => setScenario((prev) => ({ ...prev, overlayInterest: v }))}
              />
            </>
          ) : (
            <p className="empty-state mono">Adjust the inputs on the left to see a payoff projection.</p>
          )}
        </section>
      </main>

      {result && (
        <section className="panel panel-schedule" aria-label="Amortization schedule">
          <ScheduleTable schedule={result.schedule} />
        </section>
      )}

      <footer className="app-footer mono">
        <span>LoanScope v1.0 — CSE 4214</span>
      </footer>
    </div>
  );
}
