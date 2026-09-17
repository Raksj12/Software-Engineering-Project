/**
 * Standard trailing-edge debounce. Used to delay recalculation after a
 * numeric field edit by 300ms (REQ-5), while slider drags call the
 * callback immediately with no delay.
 */
export function debounce(fn, delayMs) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
