export const currency = (value, compact = true) => {
  const n = Number(value || 0);
  if (compact && Math.abs(n) >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(n) >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
};

export const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const number = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));

export const percent = (value) =>
  value === null || value === undefined ? "—" : `${(Number(value) * 100).toFixed(1)}%`;

export const dateTime = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const dateShort = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const riskTone = (score) => {
  if (score >= 0.8) return "rose";
  if (score >= 0.6) return "amber";
  if (score >= 0.35) return "sky";
  return "slate";
};
