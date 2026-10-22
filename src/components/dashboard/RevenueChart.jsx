import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PAYMENT_TYPES } from "../../data/schema";
import { groupRevenue } from "../../utils/analytics";
import { fmtMoney, fmtShort } from "../../utils/format";

const PERIODS = [
  { id: "week", label: "Haftalik" },
  { id: "month", label: "Oylik" },
  { id: "year", label: "Yillik" },
];

export default function RevenueChart({ payments }) {
  const [period, setPeriod] = useState("month");
  const data = useMemo(() => groupRevenue(payments, period), [payments, period]);
  const total = data.reduce((s, r) => s + r.total, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Tushumlar dinamikasi</h2>
          <p className="text-xs text-slate-500">Ko'rsatilgan davr jami: <b className="text-slate-700">{fmtMoney(total)}</b></p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === p.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 4, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={64} />
            <Tooltip
              formatter={(v, name) => [fmtMoney(v), PAYMENT_TYPES[name]?.label ?? name]}
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }}
            />
            <Legend formatter={(v) => PAYMENT_TYPES[v]?.short ?? v} wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            {Object.entries(PAYMENT_TYPES).map(([key, meta], i, arr) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="rev"
                fill={meta.color}
                radius={i === arr.length - 1 ? [6, 6, 0, 0] : 0}
                maxBarSize={44}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
