import React, { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/format.js';
import { downloadScheduleCsv } from '../utils/format.js';

const PAGE_SIZE = 24; // 2 years per page when "All years" is selected

export default function ScheduleTable({ schedule }) {
  const [expanded, setExpanded] = useState(false);
  const [yearFilter, setYearFilter] = useState('all'); // REQ-18
  const [page, setPage] = useState(0);

  const totalYears = Math.ceil(schedule.length / 12);
  const years = useMemo(() => Array.from({ length: totalYears }, (_, i) => i + 1), [totalYears]);

  const filtered = useMemo(() => {
    if (yearFilter === 'all') return schedule;
    const y = Number(yearFilter);
    const start = (y - 1) * 12;
    return schedule.slice(start, start + 12);
  }, [schedule, yearFilter]);

  const paged = useMemo(() => {
    if (yearFilter !== 'all') return filtered; // a single year (<=12 rows) never needs paging
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const handleYearChange = (value) => {
    setYearFilter(value);
    setPage(0);
  };

  return (
    <div className="schedule-panel">
      <button
        className="schedule-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="schedule-table-body"
      >
        <h3>Amortization schedule</h3>
        <span className="mono">{expanded ? '▾ collapse' : '▸ expand'}</span>
      </button>

      {expanded && (
        <div id="schedule-table-body">
          <div className="schedule-controls">
            <label className="mono">
              Filter by year:{' '}
              <select value={yearFilter} onChange={(e) => handleYearChange(e.target.value)}>
                <option value="all">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-secondary mono" onClick={() => downloadScheduleCsv(schedule)}>
              ⬇ Export CSV
            </button>
          </div>

          <div className="table-scroll">
            <table className="schedule-table mono">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Payment</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{formatCurrency(row.payment)}</td>
                    <td>{formatCurrency(row.principalPaid)}</td>
                    <td>{formatCurrency(row.interestPaid)}</td>
                    <td>{formatCurrency(row.remainingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {yearFilter === 'all' && totalPages > 1 && (
            <div className="pagination mono">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← Prev
              </button>
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
