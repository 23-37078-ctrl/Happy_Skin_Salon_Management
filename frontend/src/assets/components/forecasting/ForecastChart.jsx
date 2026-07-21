import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function shortDate(value) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export default function ForecastChart({ historical = [], predictions = [] }) {
  const data = [
    ...historical.map((point) => ({ date: point.date, actual: point.actual_demand, predicted: null })),
    ...predictions.map((point) => ({ date: point.date, actual: null, predicted: point.predicted_demand })),
  ];

  return (
    <div className="h-80 w-full" role="img" aria-label="Historical actual demand and predicted demand chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: 18, left: -8, bottom: 8 }}>
          <defs><linearGradient id="forecastDot" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#E98AB8" /><stop offset="100%" stopColor="#C85B95" /></linearGradient></defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#F1E4EB" />
          <XAxis dataKey="date" tickFormatter={shortDate} axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: "#7B6570", fontSize: 11 }} dy={10} />
          <YAxis allowDecimals={false} domain={[0, "auto"]} axisLine={false} tickLine={false} tick={{ fill: "#7B6570", fontSize: 11 }} width={34} />
          <Tooltip labelFormatter={shortDate} cursor={{ stroke: "#E8B7D0", strokeDasharray: "4 4" }} contentStyle={{ borderRadius: 14, border: "1px solid #F0DDE7", boxShadow: "0 12px 28px rgba(31,41,55,.08)", fontSize: 12 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 18 }} />
          {predictions[0]?.date && <ReferenceLine x={predictions[0].date} stroke="#E8B7D0" strokeDasharray="3 4" label={{ value: "Forecast", position: "insideTopRight", fill: "#C85B95", fontSize: 10 }} />}
          <Line type="monotone" dataKey="actual" name="Actual completed appointments" stroke="#75616B" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#75616B" }} connectNulls={false} />
          <Line type="monotone" dataKey="predicted" name="Predicted demand" stroke="#D65A9A" strokeWidth={3} strokeDasharray="7 5" dot={{ r: 3.5, fill: "url(#forecastDot)", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#C85B95", stroke: "#fff", strokeWidth: 2 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
