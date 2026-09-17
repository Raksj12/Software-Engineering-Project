import { validateInputs } from '@loanscope/calc-engine';

const PARAM_KEYS = {
  principal: 'p',
  annualRatePercent: 'r',
  monthlyPayment: 'm',
  overlayInterest: 'o'
};

/**
 * Reads a scenario from the current URL's query string (REQ-19). Returns
 * `null` if no scenario params are present at all (so the caller can fall
 * back to the default scenario), or `{ scenario, errors }` if params ARE
 * present - in which case invalid/missing values are reported so the
 * caller can fall back to safe defaults for just those fields (REQ-21).
 */
export function readScenarioFromUrl(defaults) {
  const params = new URLSearchParams(window.location.search);
  const hasAny = [PARAM_KEYS.principal, PARAM_KEYS.annualRatePercent, PARAM_KEYS.monthlyPayment].some((k) =>
    params.has(k)
  );
  if (!hasAny) return null;

  const raw = {
    principal: params.has(PARAM_KEYS.principal) ? Number(params.get(PARAM_KEYS.principal)) : NaN,
    annualRatePercent: params.has(PARAM_KEYS.annualRatePercent) ? Number(params.get(PARAM_KEYS.annualRatePercent)) : NaN,
    monthlyPayment: params.has(PARAM_KEYS.monthlyPayment) ? Number(params.get(PARAM_KEYS.monthlyPayment)) : NaN
  };

  const fieldErrors = validateInputs({
    principal: Number.isNaN(raw.principal) ? -1 : raw.principal,
    annualRatePercent: Number.isNaN(raw.annualRatePercent) ? -1 : raw.annualRatePercent,
    monthlyPayment: Number.isNaN(raw.monthlyPayment) ? -1 : raw.monthlyPayment
  });

  const invalidFields = new Set(fieldErrors.map((e) => e.field));
  const scenario = {
    principal: invalidFields.has('principal') || Number.isNaN(raw.principal) ? defaults.principal : raw.principal,
    annualRatePercent:
      invalidFields.has('annualRatePercent') || Number.isNaN(raw.annualRatePercent)
        ? defaults.annualRatePercent
        : raw.annualRatePercent,
    monthlyPayment:
      invalidFields.has('monthlyPayment') || Number.isNaN(raw.monthlyPayment) ? defaults.monthlyPayment : raw.monthlyPayment,
    overlayInterest: params.get(PARAM_KEYS.overlayInterest) === '1'
  };

  return { scenario, errors: fieldErrors, usedFallback: fieldErrors.length > 0 };
}

/**
 * Builds a shareable absolute URL encoding the current scenario (REQ-20).
 */
export function buildShareUrl(scenario) {
  const params = new URLSearchParams();
  params.set(PARAM_KEYS.principal, String(scenario.principal));
  params.set(PARAM_KEYS.annualRatePercent, String(scenario.annualRatePercent));
  params.set(PARAM_KEYS.monthlyPayment, String(scenario.monthlyPayment));
  if (scenario.overlayInterest) params.set(PARAM_KEYS.overlayInterest, '1');
  const url = new URL(window.location.href);
  url.search = params.toString();
  return url.toString();
}
