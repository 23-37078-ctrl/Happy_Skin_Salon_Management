const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const difference = date.getTime() - Date.now();
  const absoluteDifference = Math.abs(difference);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absoluteDifference < minute) return "Just now";
  if (absoluteDifference < hour) return relativeFormatter.format(Math.round(difference / minute), "minute");
  if (absoluteDifference < day) return relativeFormatter.format(Math.round(difference / hour), "hour");
  if (absoluteDifference < 7 * day) return relativeFormatter.format(Math.round(difference / day), "day");

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
