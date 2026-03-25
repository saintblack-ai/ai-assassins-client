const ACLED_API_URL = import.meta.env.VITE_ACLED_API_URL;
const ACLED_API_KEY = import.meta.env.VITE_ACLED_API_KEY;
const ACLED_EMAIL = import.meta.env.VITE_ACLED_EMAIL;

const SITREP_MOCKS = [
  {
    id: "sitrep-1",
    region: "Eastern Europe",
    severity: "High",
    incidents: 12,
    lat: 50.45,
    lon: 30.52,
    summary: "Missile alerts and infrastructure disruptions continue across contested zones."
  },
  {
    id: "sitrep-2",
    region: "Red Sea Corridor",
    severity: "Critical",
    incidents: 8,
    lat: 15.61,
    lon: 32.53,
    summary: "Commercial shipping routes face elevated disruption and escort requirements."
  },
  {
    id: "sitrep-3",
    region: "West Africa",
    severity: "Medium",
    incidents: 6,
    lat: 9.08,
    lon: 8.68,
    summary: "Localized militant activity and border instability remain active."
  }
];

function severityRank(severity) {
  if (severity === "Critical") {
    return 3;
  }
  if (severity === "High") {
    return 2;
  }
  if (severity === "Medium") {
    return 1;
  }
  return 0;
}

function normalizeAcledRecord(record, index) {
  const region =
    record?.admin1 ||
    record?.admin2 ||
    record?.country ||
    record?.region ||
    `Region ${index + 1}`;
  const fatalities = Number(record?.fatalities || 0);
  const severity =
    fatalities >= 25 ? "Critical" : fatalities >= 10 ? "High" : fatalities >= 1 ? "Medium" : "Low";

  return {
    id: record?.event_id_cnty || `sitrep-${index + 1}`,
    region,
    severity,
    incidents: Math.max(1, fatalities || Number(record?.event_count || 1)),
    lat: Number(record?.latitude || 0),
    lon: Number(record?.longitude || 0),
    summary: record?.notes || record?.event_type || "Operational conflict alert"
  };
}

export async function getSitrep() {
  if (!ACLED_API_URL || !ACLED_API_KEY || !ACLED_EMAIL) {
    return {
      live: false,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      items: SITREP_MOCKS
    };
  }

  try {
    const url = new URL(ACLED_API_URL);
    url.searchParams.set("key", ACLED_API_KEY);
    url.searchParams.set("email", ACLED_EMAIL);
    url.searchParams.set("limit", "6");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`sitrep_http_${response.status}`);
    }

    const payload = await response.json();
    const items = (payload?.data || [])
      .slice(0, 6)
      .map(normalizeAcledRecord)
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));

    return {
      live: true,
      source: "acled",
      fetchedAt: new Date().toISOString(),
      items
    };
  } catch (error) {
    return {
      live: false,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "sitrep_fetch_failed",
      items: SITREP_MOCKS
    };
  }
}
