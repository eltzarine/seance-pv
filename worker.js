// Séance PV — serveur de transcription (Cloudflare Worker)
// Rôle unique : ouvrir une session Gladia en direct sans jamais exposer la clé API au navigateur.
// Variables à définir dans Cloudflare (Settings → Variables and Secrets) :
//   GLADIA_API_KEY   (secret)  clé API Gladia
//   ALLOWED_ORIGINS  (texte)   adresse(s) du site autorisé, séparées par des virgules,
//                              ex. https://eltzarine.github.io

const GLADIA_LIVE = "https://api.gladia.io/v2/live";
// Limite d'ouvertures de session par adresse IP (mémoire de l'instance : un garde-fou, pas un quota exact).
const RATE_MAX = 12, RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

// "https://eltzarine.github.io/seance-pv/" et "eltzarine.github.io" deviennent "https://eltzarine.github.io"
const normOrigin = s => {
  s = String(s || "").trim().toLowerCase();
  if (!s) return "";
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  try { return new URL(s).origin; } catch { return ""; }
};

export default {
  async fetch(request, env) {
    const origin = normOrigin(request.headers.get("Origin"));
    const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(normOrigin).filter(Boolean);
    const originOk = !!origin && allowed.includes(origin);
    // Toujours renvoyer l'origine de la demande dans les en-têtes CORS : le navigateur peut ainsi lire
    // chaque réponse, y compris les erreurs, et l'appli affiche un message précis.
    const cors = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      const { pathname } = new URL(request.url);

      if (request.method === "GET" && pathname === "/health") {
        // Diagnostic sans secret : indique seulement si la configuration est complète.
        return json({ ok: true, gladia: Boolean(env.GLADIA_API_KEY), origines: allowed.length, origine_autorisee: originOk });
      }

      if (!originOk) return json({ error: "origine_refusee", origine: origin || null }, 403);

      if (request.method === "POST" && pathname === "/session") {
        if (!env.GLADIA_API_KEY) return json({ error: "cle_gladia_absente" }, 500);
        if (tooMany(request.headers.get("CF-Connecting-IP") || "inconnue")) return json({ error: "trop_de_demandes" }, 429);
        const r = await fetch(GLADIA_LIVE, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-gladia-key": String(env.GLADIA_API_KEY).trim() },
          body: JSON.stringify({
            model: "solaria-1",
            encoding: "wav/pcm",
            sample_rate: 16000,
            bit_depth: 16,
            channels: 1,
            language_config: { languages: ["fr"], code_switching: false },
            messages_config: { receive_partial_transcripts: true },
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return json({ error: "gladia", status: r.status, detail: data }, 502);
        // Seule l'URL WebSocket (jeton temporaire de la session) part vers le navigateur.
        return json({ id: data.id, url: data.url });
      }

      return json({ error: "introuvable" }, 404);
    } catch (e) {
      return json({ error: "erreur_serveur", detail: String(e && e.message || e) }, 500);
    }
  },
};
