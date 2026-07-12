import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const fmt = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function InvestmentChart({ series }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} minTickGap={20} stroke="rgba(255,255,255,0.15)" />
          <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={(v) => fmt(v)} width={80} stroke="rgba(255,255,255,0.15)" />
          <Tooltip
            formatter={(value) => fmt(value)}
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#e4e4e7' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
          <Line type="monotone" dataKey="strategyValue" name="Cumulative Value" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="principal" name="Invested" stroke="#71717a" strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
