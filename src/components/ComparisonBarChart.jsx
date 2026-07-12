import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

const fmt = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const POSITIVE = '#34d399';
const NEGATIVE = '#fb7185';

// One bar per month showing that month's actual profit/loss.
export default function ComparisonBarChart({ series }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} stroke="rgba(255,255,255,0.15)" />
          <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={(v) => fmt(v)} width={80} stroke="rgba(255,255,255,0.15)" />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Tooltip
            formatter={(value) => fmt(value)}
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#e4e4e7' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey="monthPnl" name="Monthly Profit" radius={[4, 4, 4, 4]}>
            {series.map((s) => (
              <Cell key={s.month} fill={s.monthPnl >= 0 ? POSITIVE : NEGATIVE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
