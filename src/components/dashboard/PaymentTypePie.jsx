import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { revenueByType } from "../../utils/analytics";
import { fmtMoney } from "../../utils/format";

export default function PaymentTypePie({ payments }) {
  const data = revenueByType(payments);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-slate-900">To'lov turlari bo'yicha</h2>
      <p className="text-xs text-slate-500">Barcha davr uchun ulush</p>
      <div className="h-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.type} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.type} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-slate-600">{d.name}</span>
            <span className="font-medium text-slate-900">{((d.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
