// api/_yahoo.js — Helpers compartidos para llamar a Yahoo Finance.
// Yahoo no requiere API key; sí requiere headers de browser real para no devolver 401/403.

export const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

export async function yfJson(url) {
  const resp = await fetch(url, { headers: YF_HEADERS });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Yahoo HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// Yahoo a veces falla en query1 pero responde en query2 (y viceversa).
// Probamos ambos hosts antes de tirar el error.
export async function yfTryHosts(path) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastErr;
  for (const host of hosts) {
    try {
      return await yfJson(`https://${host}${path}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
