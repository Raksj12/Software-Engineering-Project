import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { formatCurrency } from '../utils/format.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip mono">
      <div className="chart-tooltip-month">Month {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function BalanceChart({ schedule, showInterestOverlay, onToggleOverlay }) {
  // Sample the schedule for the chart so very long schedules (up to 1,200
  // points) stay smooth to render; every point remains available in the
  // table below.
  const data = schedule;

  return (
    <div className="balance-chart">
      <div className="chart-header">
        <h3>Remaining balance over time</h3>
        <label className="overlay-toggle mono">
          <input type="checkbox" checked={showInterestOverlay} onChange={(e) => onToggleOverlay(e.target.checked)} />
          Overlay cumulative interest
        </label>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--rule-soft)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--ink-soft)"
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            label={{ value: 'Month', position: 'insideBottom', offset: -4, fontFamily: 'var(--font-mono)', fontSize: 11 }}
          />
          <YAxis
            stroke="var(--ink-soft)"
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            tickFormatter={(v) => formatCurrency(v, { maximumFractionDigits: 0 })}
            width={90}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="remainingBalance"
            name="Remaining balance"
            stroke="var(--ink)"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
          {showInterestOverlay && (
            <Line
              type="monotone"
              dataKey="cumulativeInterest"
              name="Cumulative interest"
              stroke="var(--warn)"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
