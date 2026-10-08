// Séance PV — serveur de transcription (Cloudflare Worker)
// Rôle unique : ouvrir une session Gladia en direct sans jamais exposer la clé API au navigateur.
// Variables à définir dans Cloudflare (Settings → Variables and Secrets) :
//   GLADIA_API_KEY   (secret)  clé API Gladia
//   ALLOWED_ORIGINS  (texte)   adresse(s) du site autorisé, séparées par des virgules,
//                              ex. https://eltzarine.github.io

const GLADIA_LIVE = "https://api.gladia.io/v2/live";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    // Seule l'appli hébergée (origine autorisée) peut ouvrir une session : protège vos crédits Gladia.
    const originOk = allowed.length > 0 && allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk && origin ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!originOk) return json({ error: "origine_refusee" }, 403);

    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/health") {
      return json({ ok: true, gladia: Boolean(env.GLADIA_API_KEY) });
    }

    if (request.method === "POST" && pathname === "/session") {
      if (!env.GLADIA_API_KEY) return json({ error: "cle_gladia_absente" }, 500);
      const r = await fetch(GLADIA_LIVE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gladia-key": env.GLADIA_API_KEY },
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
  },
};
