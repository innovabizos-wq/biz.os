const SPECIFIC_MARKETS: Array<[prefix: string, market: string]> = [
  ["971", "UNITED_ARAB_EMIRATES"],
  ["966", "SAUDI_ARABIA"],
  ["974", "QATAR"],
  ["972", "ISRAEL"],
  ["852", "HONG_KONG"],
  ["234", "NIGERIA"],
  ["92", "PAKISTAN"],
  ["91", "INDIA"],
  ["90", "TURKEY"],
  ["65", "SINGAPORE"],
  ["62", "INDONESIA"],
  ["60", "MALAYSIA"],
  ["57", "COLOMBIA"],
  ["56", "CHILE"],
  ["55", "BRAZIL"],
  ["54", "ARGENTINA"],
  ["52", "MEXICO"],
  ["51", "PERU"],
  ["49", "GERMANY"],
  ["48", "POLAND"],
  ["44", "UNITED_KINGDOM"],
  ["40", "ROMANIA"],
  ["39", "ITALY"],
  ["36", "HUNGARY"],
  ["34", "SPAIN"],
  ["33", "FRANCE"],
  ["31", "NETHERLANDS"],
  ["27", "SOUTH_AFRICA"],
  ["20", "EGYPT"],
  ["7", "RUSSIA"],
  ["1", "NORTH_AMERICA"],
];

const REST_OF_LATIN_AMERICA_PREFIXES = [
  "501", "502", "503", "504", "505", "506", "507", "509",
  "53", "58", "591", "592", "593", "594", "595", "596", "597", "598", "599",
];

const MARKET_ALIASES: Record<string, string> = {
  COSTA_RICA: "REST_OF_LATIN_AMERICA",
  CR: "REST_OF_LATIN_AMERICA",
  MX: "MEXICO",
};

export function normalizeMetaMarketCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return MARKET_ALIASES[normalized] ?? normalized;
}

export function inferMetaMarketCode(phone: string, override?: string | null) {
  const explicit = override ? normalizeMetaMarketCode(override) : "";
  if (explicit) return explicit;

  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  if (REST_OF_LATIN_AMERICA_PREFIXES.some((prefix) => digits.startsWith(prefix))) {
    return "REST_OF_LATIN_AMERICA";
  }

  return SPECIFIC_MARKETS.find(([prefix]) => digits.startsWith(prefix))?.[1] ?? "OTHER";
}
