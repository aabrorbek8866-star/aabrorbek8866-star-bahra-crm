import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { salesByMonth } from "../../utils/analytics";

export default function SalesChart({ clients }) {
  const data = salesByMonth(clients);
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-slate-900">Sotuvlar tempi</h2>
      <p className="mb-3 text-xs text-slate-500">Oylar bo'yicha tuzilgan shartnomalar soni</p>
      <div className="h-56">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1d5cf1" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#1d5cf1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={28} />
            <Tooltip formatter={(v) => [`${v} ta`, "Shartnomalar"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="count" stroke="#1d5cf1" strokeWidth={2} fill="url(#salesFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
