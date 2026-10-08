(() => {
const KEY = "seance-pv-gaillon-v2";
const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) el.append(k);
  return el;
};

/* ---------- Gaillon : conseil élu en mars 2026 ---------- */
const ADJOINTS = ["Guy Richard MOUAKA","Karine HOUCHARD","Thierry PATEL","Jessica JEHAN","Mickael REVY","Chiraz MOALIC","Louis MENDY","Isabelle DELUCA"];
const CONSEILLERS = ["Grégory BERNARD","Marie CHARLES","Cyril COTTE","Patricia DE CARVALHO","Stephane LHERNAULT","Najet HADDOU","Alban CASSIOPE","Darifa BAKRI","Bernard FONTAINE","Liliane COQUET","Alain LEGRAS","Camille BEURIOT","Makan SISSOKO","Edouard VARIN","Corinne COTONNEC","Denis DUBOS","Chantal GUILLEMET","Thierry FOSCOLOS","Christine QUILLET","Jérémy CORDIER"];
const ORD = ["1er","2e","3e","4e","5e","6e","7e","8e"];
const nextTuesday = () => { const d = new Date(); d.setDate(d.getDate() + ((9 - d.getDay()) % 7 || 7)); return d; };
const iso = d => d.toISOString().slice(0, 10);
const GAILLON = () => {
  const d = nextTuesday(), c = new Date(d); c.setDate(c.getDate() - 7);
  const S = {
    step: 0,
    seance: {
      commune: "Gaillon", dept: "Eure", arr: "Les Andelys", date: iso(d), heure: "18:30", convoc: iso(c),
      lieu: "salle du conseil municipal, hôtel de ville, 2 rue du Général-de-Gaulle", exercice: 29,
      president: "Odile HANTZ", secretaire: "",
      elus: [
        { nom: "Odile HANTZ", role: "Maire" },
        ...ADJOINTS.map((n, i) => ({ nom: n, role: ORD[i] + " adjoint(e)" })),
        ...CONSEILLERS.map(n => ({ nom: n, role: "Conseiller(ère) municipal(e)" }))
      ].map(e => ({ ...e, statut: "present", pour: "" })),
      odj: [
        "Désignation du secrétaire de séance",
        "Approbation du procès-verbal de la séance précédente",
        "Compte rendu des décisions prises par le maire par délégation (art. L2122-22 du CGCT)",
        "Questions diverses"
      ]
    },
    elapsed: 0, segments: [], pv: [], pvSegs: 0
  };
  S.pv = skeleton(S);
  return S;
};

/* ---------- utilitaires ---------- */
const longDate = (s, wd = true) => s ? new Date(s + "T12:00").toLocaleDateString("fr-FR", { weekday: wd ? "long" : undefined, day: "numeric", month: "long", year: "numeric" }) : "[date]";
const shortDate = s => s ? s.split("-").reverse().join("/") : "";
const heureTxt = t => t ? t.replace(":", " h ") : "[heure]";
const TODO = /\[À compléter[^\]]*\]/;

function skeleton(st) {
  const s = st.seance, segs = st.segments || [];
  const sec = (titre, texte) => ({ id: "k" + Math.random().toString(36).slice(2, 8), titre, texte, status: "todo" });
  const out = [sec("Ouverture de la séance",
    `Le ${longDate(s.date, false)}, à ${heureTxt(s.heure)}, le conseil municipal de la commune de ${s.commune}, légalement convoqué le ${s.convoc ? longDate(s.convoc, false) : "[À compléter : date de convocation]"}, s'est réuni en séance publique, ${s.lieu}, sous la présidence de ${s.president || "[À compléter : président de séance]"}.`)];
  s.odj.forEach((p, i) => {
    const mine = segs.filter(x => x.pt === i);
    const notes = mine.length ? "\n\nInterventions relevées (à reformuler) :\n" + mine.map(x => `– ${x.who || "Orateur"} : ${x.text}`).join("\n") : "";
    const isQD = /questions diverses/i.test(p), isSec = /secrétaire de séance/i.test(p);
    const body = isSec ? `${s.secretaire || "[À compléter : nom]"} est désigné(e) secrétaire de séance.`
      : isQD ? "[À compléter : questions posées et réponses apportées, ou « Aucune question diverse n'est soulevée. »]"
      : "[À compléter : exposé du rapporteur et débats]\n\nVote : [À compléter : résultat du vote]";
    out.push(sec(`Point ${i + 1} – ${p}`, body + notes));
  });
  out.push(sec("Clôture", "L'ordre du jour étant épuisé, la séance est levée à [À compléter : heure de levée]."));
  return out;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Toute séance chargée (navigateur ou import) est reconstruite champ par champ : types, longueurs et valeurs contrôlés.
const str = (v, max = 500) => typeof v === "string" ? v.slice(0, max) : "";
const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
const STATUTS = ["present", "absent", "pouvoir"], PV_STATUS = ["todo", "ok", "edited"];
function sanitize(d) {
  if (!d || typeof d !== "object" || !d.seance || typeof d.seance !== "object") throw new Error("format");
  const se = d.seance, arr = (a, n) => Array.isArray(a) ? a.slice(0, n) : [];
  const elus = arr(se.elus, 200).filter(e => e && typeof e === "object").map(e => ({
    nom: str(e.nom, 120).trim(), role: str(e.role, 80), statut: STATUTS.includes(e.statut) ? e.statut : "present", pour: str(e.pour, 120)
  })).filter(e => e.nom);
  const odj = arr(se.odj, 100).map(x => str(x, 500)).filter(x => x.trim());
  return {
    step: [0, 1, 2].includes(d.step) ? d.step : 0,
    seance: {
      commune: str(se.commune, 120), dept: str(se.dept, 80), arr: str(se.arr, 80),
      date: isoDate(se.date), heure: /^\d{2}:\d{2}$/.test(se.heure) ? se.heure : "", convoc: isoDate(se.convoc),
      lieu: str(se.lieu, 300), exercice: Math.max(0, Math.min(500, parseInt(se.exercice, 10) || 0)),
      president: str(se.president, 120), secretaire: str(se.secretaire, 120), elus, odj
    },
    elapsed: Math.max(0, Math.min(86400 * 2, parseInt(d.elapsed, 10) || 0)),
    pvSegs: Math.max(0, parseInt(d.pvSegs, 10) || 0),
    segments: arr(d.segments, 20000).filter(x => x && typeof x === "object" && typeof x.text === "string").map(x => ({
      id: str(x.id, 40) || newId(), pt: Math.max(0, Math.min(odj.length, parseInt(x.pt, 10) || 0)),
      t: /^\d{2}:\d{2}:\d{2}$/.test(x.t) ? x.t : "00:00:00", who: str(x.who, 120), text: str(x.text, 5000)
    })),
    pv: arr(d.pv, 300).filter(x => x && typeof x === "object").map(x => ({
      id: str(x.id, 40) || newId(), titre: str(x.titre, 300), texte: str(x.texte, 20000), status: PV_STATUS.includes(x.status) ? x.status : "todo"
    }))
  };
}
let S;
try { const raw = localStorage.getItem(KEY); S = raw ? sanitize(JSON.parse(raw)) : GAILLON(); } catch { S = GAILLON(); }
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }, 250); if (view === "prev") schedulePreview(); };

const toast = msg => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2800); };
let confirmFn = null;
const ask = (msg, fn) => { $("#confirmMsg").textContent = msg; confirmFn = fn; $("#confirmBox").hidden = false; $("#confirmBox").scrollIntoView({ block: "nearest" }); };
$("#confirmNo").onclick = () => { $("#confirmBox").hidden = true; confirmFn = null; };
$("#confirmYes").onclick = () => { $("#confirmBox").hidden = true; const f = confirmFn; confirmFn = null; f && f(); };

/* ---------- navigation ---------- */
function go(n) {
  S.step = n; save();
  document.querySelectorAll(".step").forEach(b => b.setAttribute("aria-current", String(+b.dataset.step === n)));
  [0, 1, 2].forEach(i => $("#p" + i).hidden = i !== n);
  if (n === 0) requestAnimationFrame(() => document.querySelectorAll("textarea.grow").forEach(grow));
  if (n === 1) renderRec(); if (n === 2) { renderPV(); autoDraft(); }
  window.scrollTo({ top: 0 });
}
document.querySelectorAll(".step").forEach(b => b.onclick = () => go(+b.dataset.step));
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(+b.dataset.go));
// Export / import : passer une séance de la version hébergée (micro) à l'aperçu Claude (rédaction), et inversement
const ioOpen = mode => {
  const exp = mode === "export";
  $("#ioTitle").textContent = exp ? "Exporter la séance" : "Importer une séance";
  $("#ioNote").textContent = exp ? "Texte copié. Collez-le dans « Importer » sur l'autre appareil ou l'autre version." : "Collez ici le texte exporté. La séance en cours sera remplacée.";
  $("#ioText").value = exp ? JSON.stringify(S) : ""; $("#ioText").readOnly = exp;
  $("#ioGo").hidden = exp; $("#ioBox").hidden = false; $("#ioText").focus();
  if (exp) { $("#ioText").select(); try { navigator.clipboard.writeText($("#ioText").value).catch(() => { $("#ioNote").textContent = "Sélectionnez le texte ci-dessous et copiez-le."; }); } catch {} }
};
$("#btnExport").onclick = () => ioOpen("export");
$("#btnImport").onclick = () => ioOpen("import");
$("#ioClose").onclick = () => { $("#ioBox").hidden = true; };
$("#ioGo").onclick = () => {
  try {
    const raw = $("#ioText").value;
    if (raw.length > 8e6) throw 0;
    const d = sanitize(JSON.parse(raw));
    stopRec(); S = d; save(); renderAll(); go(S.step || 0); $("#ioBox").hidden = true; toast("Séance importée.");
  } catch { $("#ioNote").textContent = "Ce texte n'est pas une séance exportée depuis Séance PV."; }
};
$("#btnNew").onclick =() => ask("Effacer la séance en cours et repartir du modèle de Gaillon ?", () => { stopRec(); S = GAILLON(); renderAll(); go(0); });

/* ---------- 1 · Séance ---------- */
const FIELDS = ["commune","dept","arr","date","heure","convoc","lieu","exercice"];
FIELDS.forEach(f => $("#f_" + f).addEventListener("input", e => {
  S.seance[f] = f === "exercice" ? +e.target.value || 0 : e.target.value; save(); renderTally();
}));
const counts = () => {
  const e = S.seance.elus;
  const p = e.filter(x => x.statut === "present").length, pw = e.filter(x => x.statut === "pouvoir").length, a = e.filter(x => x.statut === "absent").length;
  return { p, pw, a, votants: p + pw, ex: +S.seance.exercice || e.length };
};
function renderTally() {
  const c = counts(), q = c.p > c.ex / 2;
  $("#tally").replaceChildren(
    h("div", {}, h("strong", {}, String(c.p)), "présents"),
    h("div", {}, h("strong", {}, String(c.pw)), "pouvoirs"),
    h("div", {}, h("strong", {}, String(c.a)), "absents"),
    h("div", {}, h("strong", {}, String(c.votants)), "votants"),
    h("div", { class: "quorum " + (q ? "okq" : "ko") }, h("strong", {}, q ? "✓" : "✗"), q ? `quorum atteint (${Math.floor(c.ex / 2) + 1})` : `quorum non atteint (${Math.floor(c.ex / 2) + 1} requis)`)
  );
}
const LABEL = { present: "Présent", absent: "Absent", pouvoir: "Pouvoir" };
const NEXT = { present: "absent", absent: "pouvoir", pouvoir: "present" };
function renderElus() {
  const presents = S.seance.elus.filter(e => e.statut === "present").map(e => e.nom);
  $("#elus").replaceChildren(...S.seance.elus.map((e, i) => {
    const taken = S.seance.elus.filter((x, j) => j !== i && x.statut === "pouvoir").map(x => x.pour);
    return h("div", { class: "elu" },
      h("span", { class: "nom" }, e.nom, e.role ? h("span", { class: "role" }, e.role) : null),
      h("span", { class: "row" },
        h("button", { class: "chip " + e.statut, type: "button", "aria-label": `Statut de ${e.nom} : ${LABEL[e.statut]}`, onclick: () => {
          e.statut = NEXT[e.statut]; if (e.statut !== "pouvoir") e.pour = "";
          S.seance.elus.forEach(x => { if (x.pour === e.nom && e.statut !== "present") x.pour = ""; });
          save(); renderElus(); } }, LABEL[e.statut]),
        h("button", { class: "x", type: "button", "aria-label": "Retirer " + e.nom, onclick: () => { S.seance.elus.splice(i, 1); save(); renderElus(); } }, "×")),
      e.statut === "pouvoir" ? h("select", { class: "pour", id: "pour" + i, "aria-label": "Pouvoir donné à", onchange: ev => { e.pour = ev.target.value; save(); } },
        h("option", { value: "" }, "Pouvoir donné à…"),
        ...presents.filter(n => n !== e.nom && (!taken.includes(n) || n === e.pour)).map(n => h("option", { value: n, selected: n === e.pour }, n))) : null
    );
  }));
  ["president","secretaire"].forEach(f => {
    $("#f_" + f).replaceChildren(h("option", { value: "" }, "Choisir…"), ...presents.map(n => h("option", { value: n, selected: n === S.seance[f] }, n)));
  });
  renderTally();
}
["president","secretaire"].forEach(f => $("#f_" + f).onchange = e => { S.seance[f] = e.target.value; save(); });
const addElu = () => { const v = $("#newElu").value.trim(); if (!v) return; S.seance.elus.push({ nom: v, role: "", statut: "present", pour: "" }); $("#newElu").value = ""; save(); renderElus(); };
$("#addElu").onclick = addElu; $("#newElu").onkeydown = e => { if (e.key === "Enter") addElu(); };

function renderOdj() {
  $("#odj").replaceChildren(...S.seance.odj.map((p, i) => h("li", {},
    h("div", { class: "odj-row" },
      (() => { const t = h("textarea", { id: "odj" + i, class: "grow", rows: "2", "aria-label": "Point " + (i + 1),
        oninput: e => { S.seance.odj[i] = e.target.value.replace(/\n+/g, " "); grow(e.target); save(); },
        onkeydown: e => { if (e.key === "Enter") e.preventDefault(); } }); t.value = p; return t; })(),
      h("button", { class: "x", type: "button", "aria-label": "Retirer le point " + (i + 1), onclick: () => { S.seance.odj.splice(i, 1); save(); renderOdj(); } }, "×")))));
  requestAnimationFrame(() => document.querySelectorAll("textarea.grow").forEach(grow));
}
function grow(t) { if (!t.offsetParent) return; t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }
window.addEventListener("resize", () => document.querySelectorAll("textarea.grow").forEach(grow));
const addPoint = () => {
  const v = $("#newPoint").value.trim(); if (!v) return;
  const qd = S.seance.odj.findIndex(p => /questions diverses/i.test(p));
  qd >= 0 ? S.seance.odj.splice(qd, 0, v) : S.seance.odj.push(v);
  $("#newPoint").value = ""; save(); renderOdj();
};
$("#addPoint").onclick = addPoint; $("#newPoint").onkeydown = e => { if (e.key === "Enter") addPoint(); };
function renderSeance() { FIELDS.forEach(f => $("#f_" + f).value = S.seance[f] ?? ""); renderElus(); renderOdj(); }

/* ---------- 2 · Enregistrement ---------- */
let speaker = null, curPt = 0;
const fmt = s => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, "0")).join(":");
function renderRec() {
  const presents = S.seance.elus.filter(e => e.statut === "present").map(e => e.nom);
  if (!speaker || !presents.includes(speaker)) speaker = S.seance.president || presents[0] || null;
  $("#speakers").replaceChildren(...presents.map(n => {
    const m = n.match(/^(.*?)\s+([A-ZÀ-ÖØ-Þ' -]{2,})$/), first = m ? m[1] : "", last = m ? m[2] : n;
    return h("button", { class: "chip spk", type: "button", "data-name": n, "aria-pressed": String(n === speaker),
      onclick: () => { if (n === speaker) return; flushInterim(); speaker = n; renderSpeakers(); } },
      first ? first + " " : null, h("b", {}, last));
  }));
  renderSpeakers();
  if (curPt >= S.seance.odj.length) curPt = 0;
  $("#curPoint").replaceChildren(...S.seance.odj.map((p, i) => h("option", { value: i, selected: i === curPt }, `${i + 1}. ${p}`)));
  $("#clock").textContent = fmt(S.elapsed);
  renderSegs(); setRecUI();
}
function renderSpeakers() {
  $("#speakers").querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.name === speaker)));
  $("#nowSpeaking").textContent = speaker || "";
}
$("#curPoint").onchange = e => { flushInterim(); curPt = +e.target.value; };
const segNode = sg => h("div", { class: "seg" },
  h("time", {}, sg.t),
  h("div", { style: "min-width:0" }, h("div", { class: "who" }, sg.who || "Orateur non identifié"),
    h("div", { class: "pt" }, "Point " + (sg.pt + 1)), h("p", {}, sg.text)),
  h("button", { class: "x", type: "button", "aria-label": "Supprimer l'intervention", onclick: () => {
    const i = S.segments.findIndex(x => x.id === sg.id); if (i >= 0) { S.segments.splice(i, 1); save(); renderSegs(); } } }, "×"));
const segCountTxt = () => { const n = S.segments.length; $("#segCount").textContent = n ? `${n} intervention${n > 1 ? "s" : ""}` : ""; };
function renderSegs() {
  segCountTxt();
  if (!S.segments.length) { $("#segs").replaceChildren(h("div", { class: "empty" }, "Les interventions apparaîtront ici, horodatées et attribuées à l'orateur.")); return; }
  $("#segs").replaceChildren(...S.segments.map(segNode));
  scrollLive();
}
const pushSeg = (text, who) => {
  text = String(text).replace(/\s+/g, " ").trim().slice(0, 5000); if (!text) return;
  const sg = { id: newId(), pt: curPt, t: fmt(S.elapsed), who: who ?? speaker ?? "", text };
  S.segments.push(sg); save();
  // ajout d'une seule ligne : la séance peut compter des centaines d'interventions
  if (S.segments.length === 1) $("#segs").replaceChildren();
  $("#segs").append(segNode(sg)); segCountTxt(); scrollLive();
};
$("#addSeg").onclick = () => { pushSeg($("#manual").value); $("#manual").value = ""; };

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const DIAG = /[?&]diag\b/.test(location.search);
const t0 = performance.now();
function diag(msg) {
  if (!DIAG) return;
  const l = $("#diagLog"); if (!l) return;
  l.textContent += `${((performance.now() - t0) / 1000).toFixed(1)}s  ${msg}\n`; l.scrollTop = l.scrollHeight;
}
if (DIAG) {
  $("#diagBox").hidden = false;
  diag(`UA: ${navigator.userAgent}`);
  diag(`SpeechRecognition: ${!!window.SpeechRecognition} · webkit: ${!!window.webkitSpeechRecognition} · https: ${window.isSecureContext} · getUserMedia: ${!!navigator.mediaDevices?.getUserMedia}`);
  navigator.permissions?.query({ name: "microphone" }).then(r => diag("permission micro : " + r.state)).catch(() => diag("permission micro : non lisible"));
  $("#diagMic").onclick = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true }); diag("getUserMedia : OK");
      const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
      const an = ac.createAnalyser(); ac.createMediaStreamSource(st).connect(an); const d = new Uint8Array(an.fftSize);
      let n = 0; const iv = setInterval(() => { an.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); $("#diagLevel").textContent = "niveau " + m; if (++n > 50) { clearInterval(iv); st.getTracks().forEach(t => t.stop()); ac.close(); diag("test micro terminé"); } }, 100);
    } catch (e) { diag("getUserMedia : ÉCHEC " + (e && (e.name + " " + e.message))); }
  };
}
// Adresse du serveur de transcription (Cloudflare Worker). À renseigner une fois, à la mise en ligne.
// Vide : l'appli utilise la reconnaissance vocale du navigateur.
const TRANSCRIPTION_SERVER = "https://seance-pv.cesar-poirrier.workers.dev";
const serverBase = () => (window.SEANCE_PV_SERVER ?? TRANSCRIPTION_SERVER ?? "").trim().replace(/\/+$/, "");
const useGladia = () => !!serverBase();
const IN_CLAUDE = !!window.claude;
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let recording = false, starting = false, tick = null, wake = null, interimTxt = "", engineStop = null, engineName = null;
const scrollLive = () => { const b = $("#livebox"); if (b) b.scrollTop = b.scrollHeight; };
const setInterim = t => { interimTxt = t; $("#interim").textContent = t; scrollLive(); };
let browserCommit = null;
function flushInterim() {
  if (engineName === "gladia") return; // Gladia attribue chaque phrase à l'orateur actif à son début
  if (browserCommit) { browserCommit(); return; }
  if (interimTxt.trim()) { const t = interimTxt; setInterim(""); pushSeg(t); }
}
function showProblem(msg) { $("#micBanner").hidden = false; $("#micBanner").textContent = msg; }
function micBlocked(reason) {
  stopRec();
  showProblem(reason + " Vous pouvez saisir les interventions à la main en attendant.");
}
const known = msg => Object.assign(new Error(msg), { known: true });
const blockedHere = () => IN_CLAUDE
  ? "Le micro est bloqué dans l'aperçu Claude : ouvrez l'appli en ligne (eltzarine.github.io/seance-pv) pour enregistrer."
  : IS_IOS ? "Safari n'a pas accès au micro. Autorisez-le : Réglages › Apps › Safari › Microphone, puis rechargez la page."
  : "Le navigateur n'a pas accès au micro. Autorisez le micro pour ce site (icône à gauche de l'adresse), puis réessayez.";

function setRecUI(msg) {
  $("#recBtn").classList.toggle("on", recording);
  $("#recBtn").setAttribute("aria-label", recording ? "Suspendre l'enregistrement" : "Démarrer l'enregistrement");
  $("#recBtn").disabled = starting;
  $("#liveTag").hidden = !recording;
  $("#meter").hidden = !(recording && engineName === "gladia");
  $("#recState").textContent = msg || (starting ? "Ouverture du micro…"
    : recording ? "Parlez, le texte s'affiche ci-dessous."
    : (S.elapsed ? "En pause. Touchez le bouton rouge pour reprendre." : "Touchez le bouton rouge pour lancer la transcription."));
}
async function startRec() {
  if (starting || recording) return;
  starting = true; $("#micBanner").hidden = true; setRecUI();
  // Sur iPhone, le son ne démarre que s'il est créé pendant le geste (le toucher) : on le prépare ici, avant toute attente.
  let ctx = null;
  if (useGladia()) { try { ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 }); } catch { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } ctx?.resume?.().catch(() => {}); }
  try {
    engineName = useGladia() ? "gladia" : "browser";
    engineStop = engineName === "gladia" ? await startGladia(ctx) : startBrowser();
    recording = true;
    tick = setInterval(() => { S.elapsed++; $("#clock").textContent = fmt(S.elapsed); if (S.elapsed % 10 === 0) save(); }, 1000);
    navigator.wakeLock?.request("screen").then(w => wake = w).catch(() => {});
  } catch (err) {
    engineStop = null; ctx?.close?.().catch(() => {});
    starting = false;
    micBlocked(err && err.known ? err.message : "Le micro n'a pas pu démarrer.");
  }
  starting = false; setRecUI();
}
function stopRec() {
  if (!recording && !engineStop) return;
  recording = false; clearInterval(tick);
  const stop = engineStop; engineStop = null;
  try { stop && stop(); } catch {}
  flushInterim(); wake?.release?.().catch(() => {}); wake = null; save(); setRecUI();
}
$("#recBtn").onclick = () => recording ? stopRec() : startRec();

/* Reconnaissance du navigateur (Chrome, Edge, Safari). */
function startBrowser() {
  if (!SR) throw known(IS_IOS ? "La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilisez Safari." : "La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilisez Chrome, Edge ou Safari.");
  // Une seule session d'écoute, relancée sur le même objet : Safari refuse souvent une nouvelle écoute créée hors d'un toucher.
  // Le texte s'accumule : on valide la partie nouvelle après un silence, sans arrêter l'écoute.
  const rec = new SR();
  rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
  let alive = true, heard = false, full = "", committed = 0, silence = null, restarts = 0;
  const QUIET = IS_IOS ? 1500 : 2500;
  const commit = () => {
    clearTimeout(silence);
    const t = full.slice(committed).trim();
    committed = full.length; setInterim("");
    if (t) pushSeg(t);
  };
  const pauseForTap = msg => {
    alive = false; stopRec();
    $("#micBanner").hidden = false; $("#micBanner").textContent = msg;
  };
  const watchdog = setTimeout(() => { if (alive && !heard) setRecUI("Le micro ne répond pas. Vérifiez qu'il est autorisé et qu'aucune autre appli ne l'utilise."); }, 6000);
  rec.onstart = () => { diag("onstart"); heard = true; if (recording) setRecUI(); };
  rec.onaudiostart = () => { diag("onaudiostart"); heard = true; if (recording) setRecUI(); };
  rec.onspeechstart = () => diag("onspeechstart");
  rec.onresult = e => {
    diag(`onresult n=${e.results.length} final=${e.results[e.results.length - 1]?.isFinal}`);
    full = Array.from(e.results, r => r[0].transcript.trim()).filter(Boolean).join(" ");
    if (full.length < committed) committed = 0; // le moteur a repris à zéro
    const pending = full.slice(committed).trim();
    setInterim(pending);
    clearTimeout(silence);
    const last = e.results[e.results.length - 1];
    if (last && last.isFinal) commit();
    else if (pending) silence = setTimeout(commit, QUIET);
  };
  rec.onerror = e => {
    diag(`onerror ${e.error} ${e.message || ""} (heard=${heard})`);
    if (e.error === "no-speech" || e.error === "aborted") return;
    clearTimeout(watchdog);
    if (e.error === "not-allowed" && !heard) { alive = false; micBlocked(blockedHere()); }
    else if (e.error === "service-not-allowed" && !heard) { alive = false; micBlocked(IS_IOS ? "Safari ne peut pas utiliser la dictée. Vérifiez que Siri est activé (Réglages › Siri) en plus de la Dictée, autorisez le micro pour Safari, puis réessayez." : blockedHere()); }
    else if (e.error === "audio-capture") { alive = false; micBlocked("Aucun micro n'a été trouvé sur cet appareil."); }
    else if (e.error === "not-allowed" || e.error === "service-not-allowed") pauseForTap("Le navigateur a mis la dictée en pause. Touchez le bouton rouge pour reprendre.");
    else if (e.error === "network") setRecUI("Connexion au service de dictée perdue, nouvelle tentative…");
  };
  rec.onend = () => {
    diag("onend");
    commit(); full = ""; committed = 0;
    if (!alive || !recording) return;
    if (++restarts > 50) { pauseForTap("La dictée s'est arrêtée. Touchez le bouton rouge pour reprendre."); return; }
    setTimeout(() => {
      if (!alive || !recording) return;
      try { diag("restart"); rec.start(); } catch (err) { diag("restart ÉCHEC " + err); pauseForTap("Le navigateur a mis la dictée en pause. Touchez le bouton rouge pour reprendre."); }
    }, 300);
  };
  diag("start");
  rec.start(); // dans le toucher : indispensable sur Safari
  browserCommit = commit;
  return () => { alive = false; browserCommit = null; clearTimeout(silence); clearTimeout(watchdog); commit(); try { rec.onend = null; rec.stop(); } catch {} };
}

const serverError = (status, body) => {
  const e = body && body.error;
  if (e === "origine_refusee") return `Le serveur de transcription refuse ce site${body.origine ? " (" + body.origine + ")" : ""}. Vérifiez la variable ALLOWED_ORIGINS sur Cloudflare.`;
  if (e === "cle_gladia_absente") return "La clé Gladia n'est pas configurée sur le serveur (variable GLADIA_API_KEY).";
  if (e === "gladia") return body.status === 401 || body.status === 403 ? "Gladia refuse la clé API : vérifiez GLADIA_API_KEY." : `Gladia a refusé la session (erreur ${body.status}).`;
  if (e === "trop_de_demandes") return "Trop de démarrages en peu de temps. Patientez une minute puis réessayez.";
  if (e === "erreur_serveur") return "Erreur du serveur de transcription : " + (body.detail || "inconnue") + ".";
  return `Le serveur de transcription a répondu une erreur (${status}).`;
};

/* Gladia : micro → PCM 16 bits 16 kHz mono → WebSocket, par paquets de 100 ms. */
async function startGladia(ctx) {
  if (!navigator.mediaDevices?.getUserMedia) throw known(blockedHere());
  if (!ctx) throw known("Le son n'a pas pu démarrer sur cet appareil.");
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { throw known(e && e.name === "NotFoundError" ? "Aucun micro n'a été trouvé sur cet appareil." : blockedHere()); }
  const stopTracks = () => stream.getTracks().forEach(t => t.stop());

  let sess;
  try {
    const r = await fetch(serverBase() + "/session", { method: "POST", headers: { "Content-Type": "application/json" } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw known(serverError(r.status, body));
    // N'ouvrir qu'une connexion chiffrée vers Gladia, quoi que renvoie le serveur
    if (typeof body.url !== "string" || !/^wss:\/\/api\.gladia\.io\//.test(body.url)) throw known("Réponse du serveur de transcription invalide.");
    sess = body; diag("session ouverte");
  } catch (e) {
    stopTracks();
    if (e.known) { diag("session : " + e.message); throw e; }
    diag("session : échec réseau " + (e && e.message));
    let detail = "";
    try { const h = await fetch(serverBase() + "/health"); detail = h.ok ? " (serveur joignable, demande bloquée)" : ` (serveur : ${h.status})`; diag("health : " + h.status + " " + JSON.stringify(await h.json().catch(() => ({})))); }
    catch (e2) { diag("health : échec " + (e2 && e2.message)); }
    throw known("Serveur de transcription injoignable" + detail + ". Vérifiez la connexion internet.");
  }

  await ctx.resume().catch(() => {});
  const worklet = "class C extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('cap',C)";
  try { await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([worklet], { type: "application/javascript" }))); }
  catch { stopTracks(); throw known("Ce navigateur est trop ancien pour la transcription en direct. Mettez-le à jour."); }
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "cap");
  const mute = ctx.createGain(); mute.gain.value = 0;
  src.connect(node); node.connect(mute); mute.connect(ctx.destination);

  const ratio = ctx.sampleRate / 16000;
  let buf = new Int16Array(1600), n = 0, pos = 0, ws = null, closing = false, tries = 0, peak = 0, lastMeter = 0;
  const pending = []; // audio capté avant l'ouverture de la connexion
  const push = s => {
    const v = Math.max(-1, Math.min(1, s));
    buf[n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
    if (n === buf.length) {
      const chunk = buf.buffer.slice(0); n = 0;
      if (ws && ws.readyState === 1) ws.send(chunk); else if (pending.length < 100) pending.push(chunk);
    }
  };
  node.port.onmessage = e => {
    const f = e.data;
    for (let i = 0; i < f.length; i++) { const a = Math.abs(f[i]); if (a > peak) peak = a; }
    for (; pos < f.length; pos += ratio) push(f[Math.floor(pos)]);
    pos -= f.length;
    const now = performance.now();
    if (now - lastMeter > 80) { $("#meterBar").style.width = Math.min(100, Math.round(peak * 160)) + "%"; peak = 0; lastMeter = now; }
  };

  const uttWho = new Map();
  const open = () => {
    ws = new WebSocket(sess.url);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => { diag("websocket ouvert"); tries = 0; while (pending.length) ws.send(pending.shift()); if (recording) setRecUI(); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type !== "transcript" || !m.data) return;
      const id = m.data.id, text = ((m.data.utterance && m.data.utterance.text) || "").trim();
      if (!uttWho.has(id)) uttWho.set(id, speaker || "");
      if (m.data.is_final) { setInterim(""); if (text) pushSeg(text, uttWho.get(id)); uttWho.delete(id); }
      else setInterim(text);
    };
    ws.onclose = ev => {
      diag("websocket fermé " + ev.code + " " + (ev.reason || ""));
      if (closing || ev.code === 1000) return;
      if (recording && tries < 5) {
        tries++; setRecUI("Connexion perdue, reconnexion…");
        setTimeout(() => { if (recording) open(); }, 1000 * tries);
      } else if (recording) micBlocked("La connexion au service de transcription s'est interrompue.");
    };
  };
  open();

  return () => {
    closing = true;
    try { if (ws.readyState === 1) ws.send(JSON.stringify({ type: "stop_recording" })); } catch {}
    try { node.port.onmessage = null; src.disconnect(); node.disconnect(); } catch {}
    ctx.close().catch(() => {}); stopTracks(); $("#meterBar").style.width = "0";
    setTimeout(() => { try { ws.close(1000); } catch {} }, 10000); // laisse arriver les dernières phrases
  };
}

/* ---------- 3 · Procès-verbal : rédaction ---------- */
let sample = null, sampleReady = false, genCtl = null, view = "edit";
(async () => { try { sample = await window.claude?.use?.("sample"); } catch {} sampleReady = true; renderPV(); if (S.step === 2) autoDraft(); })();

const presenceLines = () => {
  const s = S.seance, c = counts();
  const list = st => s.elus.filter(e => e.statut === st);
  return {
    c,
    presents: list("present").map(e => e.nom).join(", ") || "aucun",
    pouvoirs: list("pouvoir").map(e => `${e.nom} à ${e.pour || "[À compléter : mandataire]"}`).join(" ; ") || "aucun",
    absents: list("absent").map(e => e.nom).join(", ") || "aucun",
    quorum: c.p > c.ex / 2
  };
};
const seanceText = () => {
  const s = S.seance, p = presenceLines();
  return [`Commune : ${s.commune} (${s.dept})`, `Date : ${s.date} à ${s.heure}`, `Lieu : ${s.lieu}`, `Convocation : ${s.convoc || "[non renseignée]"}`,
    `Membres en exercice : ${p.c.ex} · Présents : ${p.c.p} · Pouvoirs : ${p.c.pw} · Votants : ${p.c.votants}`,
    `Président de séance : ${s.president}`, `Secrétaire de séance : ${s.secretaire}`,
    `Présents : ${p.presents}`, `Pouvoirs : ${p.pouvoirs}`, `Absents : ${p.absents}`,
    "Ordre du jour :", ...s.odj.map((x, i) => `  ${i + 1}. ${x}`)].join("\n");
};
const transcriptText = () => S.segments.map(x => `[${x.t}] [Point ${x.pt + 1}] ${x.who || "Orateur inconnu"} : ${x.text}`).join("\n").slice(-180000);
const RULES = `Tu rédiges le procès-verbal officiel d'une séance du conseil municipal de Gaillon (Eure), selon l'article L2121-15 du CGCT, en style administratif sobre, au passé et à la troisième personne. Les élus sont nommés « Prénom NOM ».
Règles strictes :
- N'invente rien. Si un résultat de vote, un montant, un nom ou un numéro manque, écris exactement « [À compléter : …] » à cet endroit.
- Le nombre de voix (pour + contre + abstentions) ne peut pas dépasser le nombre de votants.
- Pour chaque délibération : « Délibération n° … » (sinon [À compléter : numéro]), exposé résumé du rapporteur, débats essentiels attribués nommément, puis une ligne « Vote : X voix pour, Y contre, Z abstention(s) » avec les noms des opposants et abstentionnistes, puis la décision.
- Ne rédige PAS la liste des présents, pouvoirs et absents : elle est ajoutée automatiquement.
- Sections dans cet ordre : « Ouverture de la séance », une section par point de l'ordre du jour intitulée « Point N – <intitulé> », « Clôture » (heure de levée).`;

// Dans Claude, la rédaction passe par Claude (le serveur n'y est pas joignable) ; en ligne, par le serveur.
const canDraft = () => !!sample || (!IN_CLAUDE && !!serverBase());
// Rédaction : dans Claude, par l'IA de l'utilisateur ; en ligne, par le serveur (clé IA côté serveur).
async function draftAll(signal) {
  if (sample) {
    const out = await sample.json(`${RULES}

Réponds uniquement par un tableau JSON de sections : [{"titre": string, "texte": string}], les paragraphes d'une section séparés par une ligne vide dans "texte".

INFORMATIONS DE SÉANCE
${seanceText()}

TRANSCRIPTION HORODATÉE
${transcriptText()}`, { signal, cache: false });
    if (!Array.isArray(out)) throw { code: "invalid_json" };
    return out;
  }
  const b = await serverDraft({ seance: seanceText(), transcription: transcriptText() }, signal);
  return b.sections;
}
async function draftOne(p) {
  if (sample) {
    const { text } = await sample(`${RULES}

Réécris uniquement la section « ${p.titre} » du procès-verbal, plus fidèle à la transcription. Réponds par le seul texte de la section, sans titre.

Version actuelle :
${p.texte}

INFORMATIONS DE SÉANCE
${seanceText()}

TRANSCRIPTION
${transcriptText()}`, { cache: false });
    return text;
  }
  return (await serverDraft({ seance: seanceText(), transcription: transcriptText(), section: { titre: p.titre, texte: p.texte } })).texte || "";
}
async function serverDraft(payload, signal) {
  let r;
  try { r = await fetch(serverBase() + "/redaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal }); }
  catch (e) { throw { code: e && e.name === "AbortError" ? "cancelled" : "network" }; }
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: b.error || "upstream_error", status: b.status };
  return b;
}

async function generate() {
  if (!canDraft()) return;
  if (!S.segments.length) { $("#genState").textContent = "La transcription est vide : enregistrez la séance ou ajoutez des interventions à l'étape 2."; return; }
  genCtl = new AbortController();
  $("#genBtn").disabled = true; $("#stopGen").hidden = false;
  $("#genState").textContent = "Rédaction du procès-verbal à partir de la transcription… (de 30 secondes à 2 minutes)";
  try {
    const out = await draftAll(genCtl.signal);
    const secs = out.filter(x => x && x.titre).map((x, i) => ({ id: "g" + Date.now() + i, titre: String(x.titre), texte: String(x.texte || ""), status: "todo" }));
    if (!secs.length) throw { code: "invalid_json" };
    S.pv = secs; S.pvSegs = S.segments.length; save();
    $("#genState").textContent = "Projet rédigé. Relisez et validez chaque paragraphe.";
  } catch (e) {
    $("#genState").textContent = errCopy(e.code);
  } finally { $("#genBtn").disabled = false; $("#stopGen").hidden = true; genCtl = null; renderPV(); }
}
// À l'arrivée sur le procès-verbal : rédaction automatique si la transcription a changé et que rien n'est encore validé.
function autoDraft() {
  if (IN_CLAUDE && !sampleReady) return; // on attend de savoir si Claude peut rédiger
  if (!S.segments.length || S.pvSegs === S.segments.length || genCtl) return;
  if (S.pv.some(p => p.status !== "todo")) {
    $("#genState").textContent = "La transcription a évolué depuis la rédaction. Touchez « Rédiger à nouveau » pour mettre le PV à jour (vos validations seront remplacées).";
    return;
  }
  if (canDraft()) generate();
  else { S.pv = skeleton(S); S.pvSegs = S.segments.length; save(); renderPV(); $("#genState").textContent = "Modèle prérempli avec les interventions de chaque point, à reformuler."; }
}
$("#stopGen").onclick = () => genCtl?.abort();
$("#genBtn").onclick = () => S.pv.some(p => p.status !== "todo") ? ask("Une nouvelle rédaction remplace le PV actuel et vos validations. Continuer ?", generate) : generate();
const errCopy = c => ({
  cancelled: "Rédaction arrêtée.",
  not_granted: "L'accès à Claude n'a pas été autorisé pour cette page.",
  rate_limited: "Trop de demandes pour le moment. Réessayez dans quelques minutes.",
  invalid_json: "La réponse n'était pas exploitable. Relancez la rédaction.",
  prompt_too_large: "La transcription est trop longue pour une seule rédaction.",
  session_expired: "Votre session a expiré : reconnectez-vous à Claude.",
  network: "Serveur de rédaction injoignable. Vérifiez la connexion internet.",
  cle_ia_absente: "La rédaction automatique n'est pas encore configurée sur le serveur (clé ANTHROPIC_API_KEY ou MISTRAL_API_KEY).",
  ia: "Le service d'IA a refusé la demande. Vérifiez la clé configurée sur le serveur.",
  trop_de_demandes: "Trop de rédactions en peu de temps. Patientez quelques minutes.",
  reponse_illisible: "La réponse n'était pas exploitable. Relancez la rédaction.",
  trop_long: "La transcription est trop longue pour une seule rédaction.",
  origine_refusee: "Ce site n'est pas autorisé par le serveur."
}[c] || "La rédaction a échoué. Relancez-la.");

async function regenOne(p, btn) {
  if (!canDraft()) return;
  btn.disabled = true; btn.textContent = "Réécriture…";
  try { const t = (await draftOne(p)).trim(); if (t) { p.texte = t; p.status = "todo"; save(); } }
  catch (e) { toast(errCopy(e.code)); }
  renderPV();
}

const editing = new Set();
const markTodo = txt => {
  const frag = document.createDocumentFragment();
  txt.split(/(\[À compléter[^\]]*\])/g).forEach(part => frag.append(part.startsWith("[À compléter") ? h("mark", { class: "todo-mark" }, part) : part));
  return frag;
};
function renderPV() {
  const n = S.pv.length, ok = S.pv.filter(p => p.status !== "todo").length, done = n && ok === n;
  $("#pvTitle").textContent = n ? `Procès-verbal · ${ok}/${n} paragraphes validés` : "Procès-verbal";
  $("#pvProgressTxt").textContent = done ? "Tout est validé : le PV est prêt à être signé." : "Validez, corrigez ou faites réécrire chaque paragraphe.";
  $("#pvBar").style.width = n ? (ok / n * 100) + "%" : "0";
  $("#genBtn").hidden = !canDraft();
  $("#genBtn").textContent = S.pvSegs ? "Rédiger à nouveau" : "Rédiger le PV";
  if (!canDraft() && !$("#genState").textContent) $("#genState").textContent = "Complétez le modèle à la main : la rédaction automatique n'est pas disponible ici.";
  $("#pdfBtn").textContent = done ? "Télécharger le PDF" : "Télécharger le projet (PDF)";
  $("#pdfNote").textContent = done ? "" : "Tant qu'un paragraphe reste à valider, le PDF porte la mention « PROJET ».";

  const p = presenceLines();
  $("#viewEdit").replaceChildren(h("div", { class: "draft" },
    h("div", { class: "fixed" }, `Liste de présence ajoutée automatiquement depuis l'appel : ${p.c.p} présents, ${p.c.pw} pouvoirs, ${p.c.a} absents, ${p.c.votants} votants.`),
    ...S.pv.map(p => {
      const isEd = editing.has(p.id), hasTodo = TODO.test(p.texte);
      const pill = { todo: ["todo","À valider"], ok: ["ok","Validé"], edited: ["edited","Corrigé et validé"] }[p.status];
      const ta = h("textarea", { id: "ta-" + p.id, "aria-label": "Texte de " + p.titre }); ta.value = p.texte;
      return h("div", { class: "para " + p.status },
        h("span", { class: "pill " + pill[0] }, pill[1]),
        h("h4", {}, p.titre),
        isEd ? ta : h("div", { class: "txt" }, markTodo(p.texte)),
        h("div", { class: "acts" },
          isEd ? [
            h("button", { class: "btn primary", type: "button", onclick: () => {
              p.texte = ta.value; editing.delete(p.id);
              p.status = TODO.test(p.texte) ? "todo" : "edited"; save(); renderPV(); } }, "Enregistrer"),
            h("button", { class: "btn ghost", type: "button", onclick: () => { editing.delete(p.id); renderPV(); } }, "Annuler")
          ] : [
            p.status === "todo"
              ? h("button", { class: "btn ok", type: "button", disabled: hasTodo, onclick: () => { p.status = "ok"; save(); renderPV(); } }, "✓ Valider")
              : h("button", { class: "btn ghost", type: "button", onclick: () => { p.status = "todo"; save(); renderPV(); } }, "Rouvrir"),
            h("button", { class: "btn", type: "button", onclick: () => { editing.add(p.id); renderPV(); } }, "Modifier"),
            canDraft() && S.segments.length ? h("button", { class: "btn ghost", type: "button", onclick: e => regenOne(p, e.currentTarget) }, "Réécrire") : null
          ]),
        hasTodo && !isEd ? h("div", { class: "note", style: "margin-top:6px" }, "Complétez les mentions surlignées (bouton Modifier) avant de valider.") : null
      );
    })));
  if (view === "prev") schedulePreview();
}

/* ---------- 3 · Procès-verbal : mise en page PDF ---------- */
// Les polices PDF standard ne couvrent que le latin-1 : on normalise les quelques signes hors jeu.
const clean = s => String(s).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...")
  .replace(/\s*€/g, " euros").replace(/œ/g, "oe").replace(/Œ/g, "OE").replace(/[  ]/g, " ").replace(/[^\x00-\xFF]/g, "?");

/* Moteur PDF intégré : polices standard Times (aucune bibliothèque externe, fonctionne hors ligne). */
const TIMES_W = {normal:[250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,350,500,350,333,500,444,1000,500,500,333,1000,556,333,889,350,611,350,350,333,333,444,444,350,500,1000,333,980,389,333,722,350,444,722,250,333,500,500,500,500,200,500,333,760,276,500,564,333,760,333,400,564,300,300,333,500,453,250,333,300,310,500,750,750,750,444,722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,564,500,500,500,500,500,500,500,500],bold:[250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,350,500,350,333,500,500,1000,500,500,333,1000,556,333,1000,350,667,350,350,333,333,500,500,350,500,1000,333,1000,389,333,722,350,444,722,250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500],italic:[250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,350,500,350,333,500,556,889,500,500,333,1000,500,333,944,350,556,350,350,333,333,556,556,350,500,889,333,980,389,333,667,350,389,556,250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444]};
const MM = 72 / 25.4;
const textW = (str, style, size) => { const W = TIMES_W[style] || TIMES_W.normal; let s = 0; for (const ch of str) { const c = ch.charCodeAt(0); s += c >= 32 && c < 256 ? W[c - 32] : 500; } return s / 1000 * size * 0.3528; };
function wrapText(str, maxW, style, size) {
  const out = []; let line = "";
  for (const word of str.split(/ +/)) {
    const tryL = line ? line + " " + word : word;
    if (textW(tryL, style, size) <= maxW) { line = tryL; continue; }
    if (line) out.push(line);
    if (textW(word, style, size) <= maxW) { line = word; continue; }
    line = ""; // mot plus long que la ligne : coupé au caractère
    for (const ch of word) { if (textW(line + ch, style, size) > maxW) { out.push(line); line = ""; } line += ch; }
  }
  out.push(line);
  return out;
}

function layout() {
  const s = S.seance, W = 210, H = 297, ML = 22, MR = 22, MT = 20, MB = 24, CW = W - ML - MR;
  const done = S.pv.length > 0 && S.pv.every(p => p.status !== "todo");
  const pages = [[]]; let y = MT;
  const P = () => pages[pages.length - 1];
  const LH = sz => sz * 0.3528 * 1.4;
  const need = hh => { if (y + hh > H - MB) { pages.push([]); y = MT + 4; } };
  const text = (str, x, yy, o = {}) => P().push({ t: "text", s: clean(str), x, y: yy, size: 11, style: "normal", align: "left", color: 20, ...o });
  const para = (str, { size = 11, style = "normal", gap = 2.4, indent = 0, color } = {}) => {
    const lh = LH(size);
    wrapText(clean(str), CW - indent, style, size).forEach(l => { need(lh); y += lh; text(l, ML + indent, y, { size, style, color }); });
    y += gap;
  };

  // En-tête administratif
  [["DÉPARTEMENT " + (/^[aeiouyéèh]/i.test(s.dept || "") ? "DE L'" : "DE ") + (s.dept || "").toUpperCase(), "bold"], ["ARRONDISSEMENT DES " + (s.arr || "").replace(/^Les\s+/i, "").toUpperCase(), "normal"], ["COMMUNE DE " + (s.commune || "").toUpperCase(), "bold"]]
    .forEach(([l, st], i) => text(clean(l), ML, MT + 4 + i * 4.6, { size: 9, style: st }));
  text("RÉPUBLIQUE FRANÇAISE", W - MR, MT + 4, { size: 9, style: "bold", align: "right" });
  text("Liberté · Égalité · Fraternité", W - MR, MT + 8.6, { size: 9, style: "italic", align: "right" });
  y = MT + 26;
  text("PROCÈS-VERBAL", W / 2, y, { size: 16, style: "bold", align: "center" }); y += 7;
  text("DE LA SÉANCE DU CONSEIL MUNICIPAL", W / 2, y, { size: 11.5, style: "bold", align: "center" }); y += 6.5;
  text(clean(`du ${longDate(s.date)} à ${heureTxt(s.heure)}`), W / 2, y, { size: 11, style: "italic", align: "center" }); y += 7;

  // Tableau des effectifs
  const pr = presenceLines(), cells = [["En exercice", pr.c.ex], ["Présents", pr.c.p], ["Pouvoirs", pr.c.pw], ["Votants", pr.c.votants]];
  const bw = CW / 4;
  P().push({ t: "rect", x: ML, y, w: CW, h: 15 });
  cells.forEach(([lab, v], i) => {
    if (i) P().push({ t: "line", x1: ML + bw * i, y1: y, x2: ML + bw * i, y2: y + 15 });
    text(lab.toUpperCase(), ML + bw * i + bw / 2, y + 5.2, { size: 7.5, align: "center", color: 90 });
    text(String(v), ML + bw * i + bw / 2, y + 11.8, { size: 13, style: "bold", align: "center" });
  });
  y += 21;

  para(`Date de convocation : ${s.convoc ? longDate(s.convoc, false) : "[À compléter]"}. Présidence : ${s.president || "[À compléter]"}.`, { size: 10.5 });
  para(`Présents : ${pr.presents}.`, { size: 10.5 });
  para(`Absents ayant donné pouvoir : ${pr.pouvoirs}.`, { size: 10.5 });
  para(`Absents : ${pr.absents}.`, { size: 10.5 });
  para(`Secrétaire de séance : ${s.secretaire || "[À compléter]"}. ${pr.quorum ? "Le quorum étant atteint, le conseil peut valablement délibérer." : "Le quorum n'est pas atteint."}`, { size: 10.5, gap: 4 });
  P().push({ t: "line", x1: ML, y1: y, x2: W - MR, y2: y, w: 0.3 }); y += 4;

  // Sections
  S.pv.forEach(sec => {
    need(LH(11.5) + LH(11) * 2 + 4); y += 3;
    para(sec.titre, { size: 11.5, style: "bold", gap: 1.2 });
    sec.texte.split(/\n{2,}/).forEach(block => block.split("\n").forEach((line, i, arr) => para(line, { gap: i === arr.length - 1 ? 2.6 : 0.4 })));
  });

  // Signatures
  need(42); y += 10;
  [["Le Maire,", s.president], ["Le secrétaire de séance,", s.secretaire]].forEach(([lab, nm], i) => {
    const x = ML + i * (CW / 2 + 6);
    text(lab, x, y, { size: 11 }); text(clean(nm || ""), x, y + 5.5, { size: 11, style: "bold" });
  });
  y += 32;
  need(14);
  para("Procès-verbal arrêté au commencement de la séance suivante, signé par le maire et le secrétaire de séance, puis publié sur le site internet de la commune dans la semaine qui suit son adoption (article L2121-15 du CGCT).", { size: 8.5, style: "italic", color: 90 });

  // Pied de page et filigrane
  const n = pages.length;
  pages.forEach((pg, i) => {
    if (!done) pg.unshift({ t: "wm" });
    pg.push({ t: "line", x1: ML, y1: H - 14, x2: W - MR, y2: H - 14, w: 0.2, color: 150 });
    pg.push({ t: "text", s: clean(`Commune de ${s.commune} · Conseil municipal du ${shortDate(s.date)}${done ? "" : " · PROJET"}`), x: ML, y: H - 9.5, size: 8, style: "normal", align: "left", color: 100 });
    pg.push({ t: "text", s: `Page ${i + 1} / ${n}`, x: W - MR, y: H - 9.5, size: 8, style: "normal", align: "right", color: 100 });
  });
  return { pages, done };
}

function buildPDF(pages) {
  const FONT = { normal: "F1", bold: "F2", italic: "F3" };
  const esc = t => t.replace(/[\\()]/g, "\\$&");
  const f2 = v => (Math.round(v * 100) / 100).toString();
  const gray = v => f2((v ?? 20) / 255);
  const objs = [
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>",
    null // 4 : arbre des pages
  ];
  const kids = [];
  pages.forEach(pg => {
    const c = [];
    pg.forEach(o => {
      if (o.t === "wm") {
        const a = 35 * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), w = textW("PROJET", "bold", 96) * MM, hh = 96 * 0.33;
        const x = 105 * MM - cos * w / 2 + sin * hh, y = (297 - 160) * MM - sin * w / 2 - cos * hh;
        c.push(`BT /F2 96 Tf ${gray(232)} g ${f2(cos)} ${f2(sin)} ${f2(-sin)} ${f2(cos)} ${f2(x)} ${f2(y)} Tm (PROJET) Tj ET`);
      } else if (o.t === "text") {
        const w = textW(o.s, o.style, o.size);
        const x = o.align === "center" ? o.x - w / 2 : o.align === "right" ? o.x - w : o.x;
        c.push(`BT /${FONT[o.style] || "F1"} ${f2(o.size)} Tf ${gray(o.color)} g 1 0 0 1 ${f2(x * MM)} ${f2((297 - o.y) * MM)} Tm (${esc(o.s)}) Tj ET`);
      } else if (o.t === "line") {
        c.push(`${f2((o.w ?? 0.3) * MM)} w ${gray(o.color ?? 40)} G ${f2(o.x1 * MM)} ${f2((297 - o.y1) * MM)} m ${f2(o.x2 * MM)} ${f2((297 - o.y2) * MM)} l S`);
      } else if (o.t === "rect") {
        c.push(`${f2(0.3 * MM)} w ${gray(60)} G ${f2(o.x * MM)} ${f2((297 - o.y - o.h) * MM)} ${f2(o.w * MM)} ${f2(o.h * MM)} re S`);
      }
    });
    const stream = c.join("\n");
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objs.push(`<< /Type /Page /Parent 4 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 1 0 R /F2 2 0 R /F3 3 0 R >> >> /Contents ${objs.length} 0 R >>`);
    kids.push(objs.length);
  });
  objs[3] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  objs.push("<< /Type /Catalog /Pages 4 0 R >>"); const root = objs.length;
  objs.push(`<< /Title (${esc(clean(`Procès-verbal du conseil municipal de ${S.seance.commune} du ${shortDate(S.seance.date)}`))}) /Producer (Seance PV) >>`); const info = objs.length;
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${root} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: "application/pdf" });
}

const SERIF = '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", serif';
function drawPage(canvas, ops) {
  const cssW = canvas.getBoundingClientRect().width || 600;
  const k = (cssW * (window.devicePixelRatio || 1)) / 210;
  canvas.width = Math.round(210 * k); canvas.height = Math.round(297 * k);
  const g = canvas.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height);
  const gray = v => `rgb(${v},${v},${v})`;
  const fontOf = (style, size) => `${style === "italic" ? "italic " : ""}${style === "bold" ? "bold " : ""}${size * 0.3528 * k}px ${SERIF}`;
  ops.forEach(o => {
    if (o.t === "wm") {
      g.save(); g.translate(105 * k, 160 * k); g.rotate(-35 * Math.PI / 180);
      g.font = fontOf("bold", 96); g.fillStyle = gray(232); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("PROJET", 0, 0); g.restore();
    } else if (o.t === "text") {
      g.font = fontOf(o.style, o.size); g.fillStyle = gray(o.color ?? 20); g.textAlign = o.align; g.textBaseline = "alphabetic";
      g.fillText(o.s, o.x * k, o.y * k);
    } else if (o.t === "line") {
      g.strokeStyle = gray(o.color ?? 40); g.lineWidth = (o.w ?? 0.3) * k; g.beginPath(); g.moveTo(o.x1 * k, o.y1 * k); g.lineTo(o.x2 * k, o.y2 * k); g.stroke();
    } else if (o.t === "rect") {
      g.strokeStyle = gray(60); g.lineWidth = 0.3 * k; g.strokeRect(o.x * k, o.y * k, o.w * k, o.h * k);
    }
  });
}
let prevT;
const schedulePreview = () => { clearTimeout(prevT); prevT = setTimeout(renderPreview, 150); };
function renderPreview() {
  const box = $("#viewPrev");
  const { pages } = layout();
  const canvases = pages.map((_, i) => h("canvas", { "aria-label": `Page ${i + 1} du procès-verbal` }));
  box.replaceChildren(...pages.flatMap((_, i) => [canvases[i], h("div", { class: "cap" }, `Page ${i + 1} / ${pages.length}`)]));
  requestAnimationFrame(() => pages.forEach((pg, i) => drawPage(canvases[i], pg)));
}
function setView(v) {
  view = v;
  $("#tabEdit").setAttribute("aria-selected", String(v === "edit"));
  $("#tabPrev").setAttribute("aria-selected", String(v === "prev"));
  $("#viewEdit").hidden = v !== "edit"; $("#viewPrev").hidden = v !== "prev";
  if (v === "prev") renderPreview();
}
$("#tabEdit").onclick = () => setView("edit");
$("#tabPrev").onclick = () => setView("prev");
let resizeT; window.addEventListener("resize", () => { if (view === "prev") { clearTimeout(resizeT); resizeT = setTimeout(renderPreview, 200); } });

/* ---------- export ---------- */
let downloads;
(async () => { try { downloads = await window.claude?.use?.("downloads"); } catch {} })();
const fileName = () => `PV-CM-${clean(S.seance.commune || "commune").replace(/[^A-Za-z0-9À-ÿ-]+/g, "-")}-${S.seance.date}${layout().done ? "" : "-projet"}.pdf`;
$("#pdfBtn").onclick = async () => {
  const blob = buildPDF(layout().pages), name = fileName();
  if (downloads) {
    try { await downloads.save({ filename: name, data: blob }); toast("PDF enregistré."); }
    catch (e) {
      if (e?.code === "declined") return;
      toast(e?.code === "extension_not_enabled" ? "Le téléchargement de PDF n'est pas disponible ici." : "Le téléchargement a échoué. Réessayez.");
    }
    return;
  }
  try {
    const url = URL.createObjectURL(blob), a = h("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch { toast("Le téléchargement n'est pas disponible ici."); }
};
const pvText = () => {
  const s = S.seance, p = presenceLines();
  return [`COMMUNE DE ${s.commune.toUpperCase()} (${s.dept})`, `Procès-verbal de la séance du conseil municipal du ${longDate(s.date)} à ${heureTxt(s.heure)}`, "",
    `Membres en exercice : ${p.c.ex} – Présents : ${p.c.p} – Pouvoirs : ${p.c.pw} – Votants : ${p.c.votants}`,
    `Présents : ${p.presents}.`, `Absents ayant donné pouvoir : ${p.pouvoirs}.`, `Absents : ${p.absents}.`, `Secrétaire de séance : ${s.secretaire}.`, "",
    ...S.pv.flatMap(x => [x.titre.toUpperCase(), x.texte, ""]),
    `Le Maire, ${s.president}`, `Le secrétaire de séance, ${s.secretaire}`].join("\n");
};
$("#copyBtn").onclick = () => {
  const t = pvText();
  const fb = () => { const a = $("#copyFallback"); a.hidden = false; a.value = t; a.focus(); a.select(); toast("Sélectionnez le texte et copiez-le."); };
  try { navigator.clipboard.writeText(t).then(() => toast("Texte du PV copié."), fb); } catch { fb(); }
};

function renderAll() { renderSeance(); renderRec(); renderPV(); }
renderAll(); setView("edit"); go(S.step || 0);
})();
