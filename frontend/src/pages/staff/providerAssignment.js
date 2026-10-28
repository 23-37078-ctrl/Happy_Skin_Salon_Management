import { getSalonServiceCategory } from "../../constants/salonServices";

const serviceRoleHints = (service) => {
  const name = String(service?.name || "").toLowerCase();
  const category = String(service?.category || getSalonServiceCategory(service?.name) || "").toLowerCase();
  if (category.includes("lemon") || category.includes("facial") || category.includes("aesthetic")
    || /inject|botox|filler|mesotherapy|skin booster|diamond peel|\bturok\b/.test(name)) return ["nurse"];
  if (!/foot spa/.test(name) && (/manicure|pedicure|nail|acrylic/.test(name) || category.includes("nail"))) return ["nail"];
  return ["other"];
};

function matchingProviders(service, providers) {
  const [hint] = serviceRoleHints(service);
  if (hint === "nurse") return providers.filter((provider) => /nurse/i.test(provider.job_title || ""));
  if (hint === "nail") return providers.filter((provider) => /nail/i.test(provider.job_title || ""));
  return providers.filter((provider) => !/nurse|nail/i.test(provider.job_title || ""));
}

export function recommendProvider(service, providers, assignedCounts = {}) {
  if (!providers?.length) return "";
  const pool = matchingProviders(service, providers);
  const candidates = pool.length ? pool : providers;
  return [...candidates].sort((left, right) => {
    const leftLoad = Number(left.active_customer_count || 0) + Number(assignedCounts[left.id] || 0);
    const rightLoad = Number(right.active_customer_count || 0) + Number(assignedCounts[right.id] || 0);
    return leftLoad - rightLoad || String(left.full_name).localeCompare(String(right.full_name));
  })[0]?.id?.toString() || "";
}

export function getEligibleProviders(service, providers) {
  if (!providers?.length) return [];
  return matchingProviders(service, providers);
}
