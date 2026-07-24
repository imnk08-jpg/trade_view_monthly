import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
} from 'recharts';

const fmt = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const fmtPct = (n) => `${(n || 0).toFixed(2)}%`;

const POSITIVE = '#34d399';
const NEGATIVE = '#fb7185';
const SLICE_COLORS = ['#c084fc', '#22d3ee', '#f472b6', '#facc15', '#34d399', '#818cf8', '#fb923c', '#38bdf8'];

// Lifetime admin profit (absolute ₹) accumulated from a single user, month by month.
export function AdminProfitCumulativeChart({ series }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="adminProfitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} minTickGap={20} stroke="rgba(255,255,255,0.15)" />
          <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={(v) => fmt(v)} width={80} stroke="rgba(255,255,255,0.15)" />
          <Tooltip
            formatter={(value) => fmt(value)}
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#e4e4e7' }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeAdminProfit"
            name="Lifetime Admin Profit"
            stroke="#c084fc"
            strokeWidth={2}
            fill="url(#adminProfitFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Admin's monthly cut as a % of that month's principal, one bar per month.
export function AdminProfitMonthlyPctChart({ series }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} minTickGap={20} stroke="rgba(255,255,255,0.15)" />
          <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={(v) => fmtPct(v)} width={60} stroke="rgba(255,255,255,0.15)" />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Tooltip
            formatter={(value) => fmtPct(value)}
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#e4e4e7' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey="adminProfitPct" name="Admin Profit %" radius={[4, 4, 4, 4]}>
            {series.map((s) => (
              <Cell key={s.month} fill={s.adminProfitPct >= 0 ? POSITIVE : NEGATIVE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Ranks every user by lifetime admin profit -- one horizontal bar each, most
// profitable at top. rows: [{ name, adminProfit }].
export function AdminProfitByUserBarChart({ rows }) {
  const sorted = [...rows].sort((a, b) => b.adminProfit - a.adminProfit);
  const height = Math.max(sorted.length * 40, 120);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={(v) => fmt(v)} stroke="rgba(255,255,255,0.15)" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#e4e4e7' }} width={100} stroke="rgba(255,255,255,0.15)" />
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
          <Tooltip
            formatter={(value) => fmt(value)}
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#e4e4e7' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey="adminProfit" name="Admin Profit" radius={[0, 4, 4, 0]}>
            {sorted.map((r) => (
              <Cell key={r.name} fill={r.adminProfit >= 0 ? POSITIVE : NEGATIVE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Each user's share of total admin profit as a donut. rows: [{ name, adminProfit }].
// Users with zero or negative profit are excluded (a share chart of nothing/negative
// isn't meaningful); falls back to a message in the caller if nothing qualifies.
export function AdminProfitShareDonut({ rows }) {
  const positive = rows.filter((r) => r.adminProfit > 0);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Tooltip
            formatter={(value) => fmt(value)}
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#e4e4e7' }}
          />
          <Pie
            data={positive}
            dataKey="adminProfit"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: 'rgba(255,255,255,0.25)' }}
          >
            {positive.map((r, i) => (
              <Cell key={r.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
