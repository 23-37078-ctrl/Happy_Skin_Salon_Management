import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import forecastService from "../../services/forecastService";
import { formatCurrency, getApiError } from "../../pages/staff/staffWorkspaceUtils";

const monthLabel = (value) => new Intl.DateTimeFormat("en-PH", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`));

export default function BusinessHistoryPanel({ onLoaded, allowBranchSelection = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchSelection, setBranchSelection] = useState("all");
  const [branchOptions, setBranchOptions] = useState([]);

  useEffect(() => {
    let active = true;
    const branchId = allowBranchSelection && branchSelection !== "all" ? Number(branchSelection) : null;
    setLoading(true);
    forecastService.businessHistory(1095, branchId).then((result) => {
      if (!active) return;
      setData(result);
      setError("");
      if (allowBranchSelection && branchSelection === "all") setBranchOptions(result.branches || []);
      onLoaded?.(result);
    }).catch((err) => active && setError(getApiError(err, "Could not load actual business history.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [allowBranchSelection, branchSelection, onLoaded]);

  const forecastSummary = useMemo(() => (data?.sales_forecast || []).reduce((totals, point) => ({
    bookings: totals.bookings + Number(point.predicted_bookings || 0),
    transactions: totals.transactions + Number(point.predicted_transactions || 0),
    sales: totals.sales + Number(point.predicted_salon_sales || 0),
  }), { bookings: 0, transactions: 0, sales: 0 }), [data]);
  const periodSummary = useMemo(() => (data?.monthly || []).reduce((totals, month) => ({
    bookings: totals.bookings + Number(month.bookings || 0),
    transactions: totals.transactions + Number(month.transactions || 0),
    sales: totals.sales + Number(month.salon_sales || 0),
  }), { bookings: 0, transactions: 0, sales: 0 }), [data]);

  return <section className="mt-6 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:p-5" aria-label="Three-year business history and outlook">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#C9558F]">Actual system records · {data?.branch_name || "Branch"}</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">Three-year sales and booking history</h2></div><div className="flex flex-col gap-2 sm:items-end">{allowBranchSelection && <label className="text-[10px] font-bold uppercase text-[#6B7280]">View branch<select value={branchSelection} onChange={(event) => setBranchSelection(event.target.value)} className="form-input mt-1 min-w-48 text-sm normal-case"><option value="all">All branches</option>{branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}<p className="text-xs text-[#6B7280]">{data?.history_start ? `${data.history_start} to ${data.history_end}` : "No activity recorded yet"} · Asia/Manila</p></div></div>
    {loading ? <div className="mt-5 h-56 animate-pulse rounded-xl bg-[#FFF8FB]" /> : error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Today's salon sales" value={formatCurrency(data?.today?.salon_sales)} />
        <Metric label="Today's transactions" value={data?.today?.transactions || 0} />
        <Metric label="Today's bookings" value={data?.today?.bookings || 0} />
        <Metric label="Recorded sales in range" value={formatCurrency(periodSummary.sales)} />
        <Metric label="Recorded transactions in range" value={periodSummary.transactions} />
        <Metric label="Recorded bookings in range" value={periodSummary.bookings} />
        <Metric label="Next 7 days · sales outlook" value={data?.sales_forecast?.length ? formatCurrency(forecastSummary.sales) : "Not enough history"} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(15rem,.8fr)]">
        <div><h3 className="mb-2 text-sm font-bold text-[#374151]">Monthly actual salon sales and bookings</h3><div className="h-64 w-full" role="img" aria-label="Monthly salon sales and bookings for up to three years"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data?.monthly || []} margin={{ top: 8, right: 8, left: -15, bottom: 5 }}><CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#F1E4EB" /><XAxis dataKey="month" tickFormatter={monthLabel} minTickGap={24} tick={{ fill: "#7B6570", fontSize: 10 }} /><YAxis yAxisId="sales" tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fill: "#7B6570", fontSize: 10 }} /><YAxis yAxisId="bookings" orientation="right" allowDecimals={false} tick={{ fill: "#7B6570", fontSize: 10 }} /><Tooltip labelFormatter={monthLabel} formatter={(value, name) => [name === "Salon sales" ? formatCurrency(value) : value, name]} contentStyle={{ borderRadius: 12, border: "1px solid #F0DDE7", fontSize: 12 }} /><Bar yAxisId="sales" dataKey="salon_sales" name="Salon sales" fill="#D65A9A" radius={[4, 4, 0, 0]} /><Line yAxisId="bookings" type="monotone" dataKey="bookings" name="Bookings" stroke="#168A72" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div></div>
        <aside className="rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><h3 className="text-sm font-extrabold text-[#374151]">Next 7 days outlook</h3><p className="mt-1 text-xs leading-5 text-[#6B7280]">Uses up to three years of actual records, weighted toward recent matching weekdays.</p><div className="mt-3 space-y-2">{(data?.sales_forecast || []).map((point) => <div key={point.date} className="flex items-center justify-between gap-3 border-b border-[#F0DCE7] pb-2 text-xs"><span className="font-semibold text-[#475467]">{new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))}</span><span className="text-right"><strong className="block text-[#166534]">{formatCurrency(point.predicted_salon_sales)}</strong><span className="text-[10px] text-[#6B7280]">{Number(point.predicted_transactions).toFixed(1)} transactions · {Number(point.predicted_bookings).toFixed(1)} bookings</span></span></div>)}{!data?.sales_forecast?.length && <p className="rounded-lg bg-white p-3 text-xs leading-5 text-[#667085]">There are not enough completed days of real booking or transaction history to estimate next week.</p>}</div><p className="mt-3 text-[10px] leading-4 text-[#667085]">{data?.forecast_method} Figures are estimates, not guaranteed sales.</p><p className="mt-2 text-[10px] text-[#667085]">Coverage: {data?.actual_transaction_days || 0} transaction days and {data?.actual_booking_days || 0} booking days recorded in the selected period.</p></aside>
      </div>
    </>}
  </section>;
}

function Metric({ label, value }) { return <div className="rounded-xl bg-[#FFF8FB] p-3 ring-1 ring-[#F3E8EF]"><p className="truncate text-lg font-extrabold text-[#1F2937]">{value}</p><p className="mt-1 text-[10px] font-bold uppercase text-[#6B7280]">{label}</p></div>; }
