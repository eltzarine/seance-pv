// Tests du serveur de transcription (node tests/worker.test.mjs)
import assert from "node:assert/strict";
import worker from "../worker.js";
const O = "https://eltzarine.github.io";
let gladia = async () => ({ ok: true, json: async () => ({ id: "s1", url: "wss://api.gladia.io/v2/live?token=s1" }) });
globalThis.fetch = (...a) => gladia(...a);
const call = async (env, method, path, origin, ip = "1.1.1.1") => {
  const headers = { "CF-Connecting-IP": ip }; if (origin) headers.Origin = origin;
  const r = await worker.fetch(new Request("https://w.dev" + path, { method, headers }), env);
  return { status: r.status, acao: r.headers.get("access-control-allow-origin"), body: r.status === 204 ? null : await r.json() };
};
const env = { GLADIA_API_KEY: "k", ALLOWED_ORIGINS: O };
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("  ✓ " + name); };

await t("session ouverte pour le site autorisé", async () => { const r = await call(env, "POST", "/session", O); assert.equal(r.status, 200); assert.match(r.body.url, /^wss:\/\/api\.gladia\.io\//); assert.equal(r.acao, O); });
await t("la clé n'apparaît jamais dans une réponse", async () => { for (const p of ["/session", "/health", "/x"]) { const r = await call(env, "POST", p, O, "9.9.9." + p.length); assert.ok(!JSON.stringify(r.body).includes("k\"")); } });
await t("autre site refusé (403, réponse lisible)", async () => { const r = await call(env, "POST", "/session", "https://evil.example"); assert.equal(r.status, 403); assert.equal(r.body.error, "origine_refusee"); });
await t("appel sans site d'origine refusé", async () => { const r = await call(env, "POST", "/session", null); assert.equal(r.status, 403); });
await t("adresse autorisée saisie avec / ou chemin acceptée", async () => { for (const v of [O + "/", "eltzarine.github.io/seance-pv"]) assert.equal((await call({ ...env, ALLOWED_ORIGINS: v }, "POST", "/session", O, "2.2.2." + v.length)).status, 200); });
await t("clé absente signalée", async () => { assert.equal((await call({ ALLOWED_ORIGINS: O }, "POST", "/session", O)).body.error, "cle_gladia_absente"); });
await t("clé refusée par Gladia signalée", async () => { gladia = async () => ({ ok: false, status: 401, json: async () => ({}) }); const r = await call(env, "POST", "/session", O, "3.3.3.3"); assert.equal(r.status, 502); assert.equal(r.body.status, 401); });
await t("panne de Gladia interceptée, en-têtes CORS présents", async () => { gladia = async () => { throw new Error("réseau"); }; const r = await call(env, "POST", "/session", O, "4.4.4.4"); assert.equal(r.status, 500); assert.equal(r.acao, O); });
await t("limitation : 12 sessions par IP et par 10 minutes", async () => {
  gladia = async () => ({ ok: true, json: async () => ({ id: "s", url: "wss://api.gladia.io/v2/live?token=s" }) });
  for (let i = 0; i < 12; i++) assert.equal((await call(env, "POST", "/session", O, "5.5.5.5")).status, 200);
  const r = await call(env, "POST", "/session", O, "5.5.5.5"); assert.equal(r.status, 429); assert.equal(r.body.error, "trop_de_demandes");
  assert.equal((await call(env, "POST", "/session", O, "6.6.6.6")).status, 200);
});
await t("pré-vérification CORS (OPTIONS)", async () => { const r = await call(env, "OPTIONS", "/session", O); assert.equal(r.status, 204); assert.equal(r.acao, O); });
console.log(`\n${n} tests serveur réussis`);
