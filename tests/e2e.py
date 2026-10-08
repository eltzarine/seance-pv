"""Tests de bout en bout de Séance PV (Playwright, Chromium).

Lancer :  python3 tests/e2e.py   (depuis la racine du dépôt)
Le micro et les services de dictée n'existent pas dans un navigateur de test :
ils sont simulés pour reproduire le comportement de Chrome, de Safari sur iPhone et de Gladia.
"""
import http.server, json, os, socketserver, sys, threading, time
from functools import partial
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("E2E_PORT", "8780"))
URL = f"http://localhost:{PORT}/index.html"
results = []

def check(name, fn):
    try:
        fn(); results.append((name, True, ""))
        print(f"  ✓ {name}")
    except Exception as e:
        results.append((name, False, str(e).splitlines()[0][:300]))
        print(f"  ✗ {name}\n      {str(e).splitlines()[0][:300]}")

# Faux moteur de dictée : rejoue un scénario, à la manière de Chrome ou de Safari iOS
MOCK_SR = r"""
(() => {
  const mode = () => window.__SR_MODE || "chrome";
  class MockSR {
    constructor(){ this.continuous=false; this.interimResults=false; this.lang=""; window.__srInstances=(window.__srInstances||0)+1; window.__lastSR=this; }
    start(){
      window.__srStarts=(window.__srStarts||0)+1;
      const m = mode(), first = window.__srStarts===1;
      const fail = err => setTimeout(()=>{ this.onerror&&this.onerror({error:err}); this.onend&&this.onend(); },50);
      if (m==="denied") return fail("not-allowed");
      if (m==="dictation-off") return fail("service-not-allowed");
      if (m==="safari-deny-restart" && !first) return fail("service-not-allowed");
      setTimeout(()=>{ this.onstart&&this.onstart(); this.onaudiostart&&this.onaudiostart(); },30);
      if (!first) return;
      const words = "Je déclare la séance ouverte et je propose de passer au premier point".split(" ");
      let acc = "";
      words.forEach((w,i)=>setTimeout(()=>{
        acc += (i?" ":"")+w;
        const res = [[{transcript:acc}]]; res[0].isFinal = (m==="chrome" && i===words.length-1);
        this.onresult && this.onresult({resultIndex:0, results:res});
      }, 80*(i+1)));
      // Safari : aucun résultat « final » ; la session s'arrête d'elle-même plus tard
      if (m.startsWith("safari")) setTimeout(()=>this.onend&&this.onend(), 3500);
    }
    stop(){ setTimeout(()=>this.onend&&this.onend(),20); }
    abort(){ this.stop(); }
  }
  window.SpeechRecognition = MockSR; window.webkitSpeechRecognition = MockSR;
})();
"""

def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a: None
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("localhost", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def new_page(browser, device=None, sr_mode=None, server=None, setup=None, bypass_csp=False):
    ctx = browser.new_context(**(device or {}), permissions=["microphone"], accept_downloads=True, bypass_csp=bypass_csp)
    page = ctx.new_page()
    # Polices Google inaccessibles depuis l'environnement de test : remplacées par une feuille vide
    page.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
    if setup: setup(page)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    if sr_mode:  # dictée du navigateur : pas de serveur Gladia
        page.add_init_script(f"window.SEANCE_PV_SERVER='';window.__SR_MODE={json.dumps(sr_mode)};" + MOCK_SR)
    if server:
        page.add_init_script(f"window.SEANCE_PV_SERVER={json.dumps(server)};")
    page.add_init_script("try{localStorage.clear()}catch(e){}")
    page.goto(URL)
    return ctx, page, errors

def go_rec(page):
    page.locator(".step[data-step=\"1\"]").click()
    expect(page.locator("#p1")).to_be_visible()

def main():
    httpd = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        iphone = p.devices["iPhone 13"]

        print("Étape 1 · séance (iPhone)")
        ctx, page, errors = new_page(browser, iphone)
        def t_load():
            expect(page.locator("#elus .elu")).to_have_count(29)
            expect(page.locator("#tally")).to_contain_text("quorum atteint")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "défilement horizontal"
        check("29 élus de Gaillon, quorum, pas de débordement à 390 px", t_load)
        def t_dates():
            for f in ["#f_date", "#f_heure", "#f_convoc"]:
                box = page.locator(f).bounding_box(); card = page.locator(f).locator("xpath=ancestor::div[contains(@class,'card')]").bounding_box()
                assert box["x"] + box["width"] <= card["x"] + card["width"] + 0.5, f"{f} dépasse"
        check("les champs date et heure restent dans la carte", t_dates)
        def t_odj():
            t = page.locator("#odj0"); expect(t).to_be_visible()
            assert page.evaluate("(()=>{const t=document.querySelector('#odj2');return t.scrollHeight<=t.clientHeight+2})()"), "le texte défile dans le champ"
        check("ordre du jour : champs multi-lignes sans défilement interne", t_odj)
        def t_splash():
            expect(page.locator("#splash")).to_contain_text("© XVI 2026")
            expect(page.locator("#splash")).to_have_count(0, timeout=4000)
            expect(page.locator(".foot")).to_contain_text("© XVI 2026")
            for path in ["manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/logo.svg"]:
                r = page.request.get(f"http://localhost:{PORT}/{path}")
                assert r.ok, path
            m = page.request.get(f"http://localhost:{PORT}/manifest.webmanifest").json()
            assert m["name"] == "Séance PV" and m["display"] == "standalone"
        check("écran d'accueil « © XVI 2026 » puis disparition ; icônes et manifeste présents", t_splash)
        check("aucune erreur JavaScript au chargement", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors))) if errors else None)
        ctx.close()

        print("Étape 2 · grille des orateurs et ergonomie iPhone")
        ctx, page, errors = new_page(browser, iphone)
        go_rec(page)
        def t_grid():
            chips = page.locator("#speakers .chip")
            expect(chips).to_have_count(29)
            vw = page.viewport_size["width"]
            for i in range(29):
                b = chips.nth(i).bounding_box()
                assert b["x"] >= 0 and b["x"] + b["width"] <= vw, f"élu {i} hors écran"
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "défilement horizontal"
            chips.filter(has_text="DELUCA").tap()
            expect(page.locator("#nowSpeaking")).to_have_text("Isabelle DELUCA")
            expect(chips.filter(has_text="DELUCA")).to_have_attribute("aria-pressed", "true")
        check("les 29 élus visibles d'un coup en grille, sélection en un toucher", t_grid)
        def t_tap():
            assert page.evaluate("getComputedStyle(document.querySelector('#speakers .chip')).touchAction") == "manipulation"
            assert page.evaluate("getComputedStyle(document.querySelector('#recBtn')).touchAction") == "manipulation"
            assert page.evaluate("parseFloat(getComputedStyle(document.querySelector('#manual')).fontSize)") >= 16, "zoom au focus"
        check("pas de zoom au double-tap ni au focus d'un champ", t_tap)
        def t_import():
            payload = json.dumps({"seance": {"commune": "X", "elus": [{"nom": "<img src=x onerror=window.__xss=1>", "statut": "present"}, {"nom": 42}], "odj": ["Point"]},
                                  "pv": [{"titre": "<script>window.__xss=2</script>", "texte": "t", "status": "hack"}], "segments": [{"text": "a", "pt": 999}], "step": 9})
            page.locator("#btnImport").tap(); page.locator("#ioText").fill(payload); page.locator("#ioGo").tap()
            expect(page.locator("#toast")).to_contain_text("importée")
            page.locator('.step[data-step="0"]').click()
            expect(page.locator("#elus .elu")).to_have_count(1)
            expect(page.locator("#elus .nom").first).to_contain_text("<img src=x")
            page.locator('.step[data-step="2"]').click()
            assert page.evaluate("window.__xss") is None, "code injecté exécuté"
            expect(page.locator(".pill.todo")).to_have_count(1)
            page.locator("#btnImport").tap(); page.locator("#ioText").fill('{"pas":"une séance"}'); page.locator("#ioGo").tap()
            expect(page.locator("#ioNote")).to_contain_text("n'est pas une séance")
        check("import : contenu hostile affiché comme du texte, valeurs invalides corrigées, format refusé", t_import)
        check("aucune erreur JavaScript ni violation de sécurité (CSP)", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors))) if errors else None)
        ctx.close()

        print("Étape 2 · dictée du navigateur, comportement Chrome (bureau)")
        ctx, page, errors = new_page(browser, sr_mode="chrome")
        go_rec(page)
        def t_chrome():
            page.locator("#recBtn").click()
            expect(page.locator("#liveTag")).to_be_visible()
            expect(page.locator("#interim")).to_contain_text("séance", timeout=3000)
            expect(page.locator("#segs .seg")).to_have_count(1, timeout=4000)
            expect(page.locator("#segs .seg").first).to_contain_text("Je déclare la séance ouverte et je propose de passer au premier point")
            expect(page.locator("#segs .seg .who").first).to_have_text("Odile HANTZ")
            expect(page.locator("#clock")).not_to_have_text("00:00:00", timeout=3000)
        check("Rec → texte en direct puis phrase validée, attribuée à la présidente", t_chrome)
        def t_live_near():
            rb = page.locator("#recBtn").bounding_box(); lb = page.locator("#livebox").bounding_box()
            assert lb["y"] - (rb["y"] + rb["height"]) < 260, "la transcription est trop loin du bouton"
        check("la transcription s'affiche dans l'encart juste sous le bouton", t_live_near)
        def t_speaker():
            page.locator("#speakers .chip", has_text="Guy Richard MOUAKA").click()
            expect(page.locator("#speakers .chip", has_text="Guy Richard MOUAKA")).to_have_attribute("aria-pressed", "true")
            page.locator("#recBtn").click()
            expect(page.locator("#liveTag")).to_be_hidden()
            expect(page.locator("#recState")).to_contain_text("En pause")
        check("changement d'orateur et pause", t_speaker)
        check("aucune erreur JavaScript (Chrome)", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors))) if errors else None)
        ctx.close()

        print("Étape 2 · dictée du navigateur, comportement Safari iPhone")
        ctx, page, errors = new_page(browser, iphone, sr_mode="safari")
        go_rec(page)
        def t_safari():
            page.locator("#recBtn").tap()
            expect(page.locator("#interim")).to_contain_text("premier point", timeout=3000)
            expect(page.locator("#segs .seg")).to_have_count(1, timeout=4000)
            expect(page.locator("#segs .seg").first).to_contain_text("Je déclare la séance ouverte et je propose de passer au premier point")
            assert page.evaluate("window.__srStarts") == 1, "l'écoute a été coupée pour valider la phrase"
            time.sleep(2.5)
            assert page.evaluate("window.__srStarts") >= 2, "l'écoute n'a pas repris après l'arrêt de Safari"
            assert page.evaluate("window.__srInstances") == 1, "nouvel objet de dictée créé (refusé par Safari hors toucher)"
            expect(page.locator("#liveTag")).to_be_visible()
            expect(page.locator("#micBanner")).to_be_hidden()
            expect(page.locator("#segs .seg")).to_have_count(1)
        check("Safari : phrase validée après un silence sans couper l'écoute, reprise sur la même session", t_safari)
        def t_visible():
            assert page.locator("#livebox").is_visible() and page.locator("#livebox").bounding_box()["y"] < 844, "encart hors écran"
        check("iPhone : l'encart de transcription est visible à l'écran pendant l'enregistrement", t_visible)
        check("aucune erreur JavaScript (Safari simulé)", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors))) if errors else None)
        ctx.close()

        print("Étape 2 · changement d'orateur en pleine phrase (Safari)")
        ctx, page, errors = new_page(browser, iphone, sr_mode="safari")
        go_rec(page)
        def t_switch():
            page.locator("#recBtn").tap()
            expect(page.locator("#interim")).to_contain_text("ouverte", timeout=3000)
            page.locator("#speakers .chip", has_text="Karine HOUCHARD").tap()
            expect(page.locator("#segs .seg")).to_have_count(2, timeout=4000)
            segs = page.locator("#segs .seg p").all_inner_texts(); whos = page.locator("#segs .seg .who").all_inner_texts()
            assert whos == ["Odile HANTZ", "Karine HOUCHARD"], whos
            assert " ".join(segs) == "Je déclare la séance ouverte et je propose de passer au premier point", segs
        check("orateur changé en cours de phrase : texte réparti sans doublon", t_switch)
        ctx.close()

        print("Étape 2 · Safari refuse la reprise")
        ctx, page, errors = new_page(browser, iphone, sr_mode="safari-deny-restart")
        go_rec(page)
        def t_deny():
            page.locator("#recBtn").tap()
            expect(page.locator("#segs .seg")).to_have_count(1, timeout=4000)
            expect(page.locator("#micBanner")).to_contain_text("Touchez le bouton rouge pour reprendre", timeout=5000)
            expect(page.locator("#liveTag")).to_be_hidden()
            page.locator("#recBtn").tap()
            expect(page.locator("#liveTag")).to_be_visible()
        check("reprise refusée : pause propre, un toucher relance", t_deny)
        ctx.close()

        print("Étape 2 · erreurs explicites")
        ctx, page, errors = new_page(browser, iphone, sr_mode="dictation-off")
        go_rec(page)
        def t_dict():
            page.locator("#recBtn").tap()
            expect(page.locator("#micBanner")).to_contain_text("Siri", timeout=2000)
            expect(page.locator("#liveTag")).to_be_hidden()
        check("iPhone, dictée indisponible au démarrage : message Siri et Dictée", t_dict)
        ctx.close()
        ctx, page, errors = new_page(browser, sr_mode="denied")
        go_rec(page)
        def t_denied():
            page.locator("#recBtn").click()
            expect(page.locator("#micBanner")).to_contain_text("Autorisez le micro", timeout=2000)
        check("micro refusé : message pour l'autoriser", t_denied)
        ctx.close()

        print("Étape 2 · Gladia (serveur et WebSocket simulés)")
        stats = {"chunks": 0, "sizes": set(), "stop": False}
        def on_ws(ws):
            def on_msg(m):
                if isinstance(m, (bytes, bytearray)):
                    stats["chunks"] += 1; stats["sizes"].add(len(m))
                    if stats["chunks"] == 5:
                        ws.send(json.dumps({"type": "transcript", "data": {"id": "u1", "is_final": False, "utterance": {"text": "Le budget est"}}}))
                    if stats["chunks"] == 10:
                        ws.send(json.dumps({"type": "transcript", "data": {"id": "u1", "is_final": True, "utterance": {"text": "Le budget est adopté à l'unanimité."}}}))
                elif '"stop_recording"' in m:
                    stats["stop"] = True
            ws.on_message(on_msg)
        def setup_gladia(page):
            page.route("https://worker.test/session", lambda r: r.fulfill(status=200, content_type="application/json",
                headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps({"id": "s1", "url": "wss://api.gladia.io/v2/live?token=s1"})))
            page.route_web_socket("wss://api.gladia.io/**", on_ws)
        ctx, page, errors = new_page(browser, iphone, server="https://worker.test", setup=setup_gladia, bypass_csp=True)
        go_rec(page)
        def t_gladia():
            page.locator("#recBtn").tap()
            expect(page.locator("#liveTag")).to_be_visible(timeout=4000)
            expect(page.locator("#meter")).to_be_visible()
            expect(page.locator("#interim")).to_have_text("Le budget est", timeout=4000)
            expect(page.locator("#segs .seg")).to_have_count(1, timeout=4000)
            expect(page.locator("#segs .seg").first).to_contain_text("Le budget est adopté à l'unanimité.")
            assert stats["sizes"] == {3200}, f"paquets audio inattendus : {stats['sizes']}"
            page.locator("#recBtn").tap(); time.sleep(0.3)
            assert stats["stop"], "fin de session non envoyée"
        check("Gladia : audio 16 kHz par paquets de 100 ms, texte partiel puis final, arrêt propre", t_gladia)
        check("aucune erreur JavaScript (Gladia)", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors))) if errors else None)
        ctx.close()

        print("Étape 3 · rédaction au passage au procès-verbal")
        ctx, page, errors = new_page(browser, sr_mode="chrome")
        go_rec(page)
        def t_skel():
            page.locator("#recBtn").click()
            expect(page.locator("#segs .seg")).to_have_count(1, timeout=4000)
            page.locator("#recBtn").click()
            page.get_by_role("button", name="Passer au procès-verbal →").click()
            expect(page.locator("#viewEdit")).to_contain_text("Je déclare la séance ouverte", timeout=3000)
            expect(page.locator("#genState")).to_contain_text("prérempli")
        check("sans IA : le modèle se remplit avec les interventions de chaque point", t_skel)
        ctx.close()

        seance = {"step": 1, "seance": {"commune": "Gaillon", "dept": "Eure", "arr": "Les Andelys", "date": "2026-10-13", "heure": "18:30", "convoc": "2026-10-06",
                  "lieu": "salle du conseil", "exercice": 29, "president": "Odile HANTZ", "secretaire": "Karine HOUCHARD",
                  "elus": [{"nom": "Odile HANTZ", "statut": "present"}, {"nom": "Karine HOUCHARD", "statut": "present"}], "odj": ["Budget", "Questions diverses"]},
                  "elapsed": 120, "segments": [{"id": "a", "pt": 0, "t": "00:01:00", "who": "Odile HANTZ", "text": "Le budget est adopté à l'unanimité."}],
                  "pv": [], "pvSegs": 0}
        calls = []
        def on_redac(route):
            body = json.loads(route.request.post_data); calls.append(body)
            if body.get("section"):
                return route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps({"texte": "Texte réécrit."}))
            return route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps({"sections": [
                {"titre": "Ouverture de la séance", "texte": "La séance est ouverte à 18 h 30."},
                {"titre": "Point 1 – Budget", "texte": "Vote : 2 voix pour, 0 contre, 0 abstention."},
                {"titre": "Clôture", "texte": "La séance est levée à 19 h."}]}))
        def setup_redac(page):
            page.route("https://worker.test/redaction", on_redac)
            page.add_init_script("localStorage.setItem('seance-pv-gaillon-v2', " + json.dumps(json.dumps(seance)) + ")")
        ctx = browser.new_context(**iphone, bypass_csp=True)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
        page.add_init_script("window.SEANCE_PV_SERVER='https://worker.test';")
        setup_redac(page)
        page.goto(URL)
        def t_ai():
            page.get_by_role("button", name="Passer au procès-verbal →").tap()
            expect(page.locator(".para")).to_have_count(3, timeout=5000)
            expect(page.locator(".para h4").nth(1)).to_have_text("Point 1 – Budget")
            expect(page.locator("#genState")).to_contain_text("Projet rédigé")
            assert len(calls) == 1 and "Le budget est adopté" in calls[0]["transcription"] and "Odile HANTZ" in calls[0]["seance"]
            assert set(calls[0]) == {"seance", "transcription"}, calls[0].keys()
            page.locator('.step[data-step="1"]').click(); page.locator('.step[data-step="2"]').click()
            assert len(calls) == 1, "nouvelle rédaction alors que rien n'a changé"
            page.locator(".para").first.get_by_role("button", name="Réécrire").tap()
            expect(page.locator(".para .txt").first).to_have_text("Texte réécrit.")
        check("avec le serveur : PV rédigé automatiquement au clic, une seule fois, réécriture d'un paragraphe", t_ai)
        check("aucune erreur JavaScript (rédaction)", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors))) if errors else None)
        ctx.close()

        print("Étape 3 · procès-verbal, aperçu et PDF")
        ctx, page, errors = new_page(browser, iphone)
        page.locator(".step[data-step=\"2\"]").click()
        def t_pv():
            expect(page.locator(".para")).to_have_count(6)
            expect(page.locator(".para").nth(1).locator(".btn.ok")).to_be_disabled()
            page.locator(".para").first.get_by_role("button", name="✓ Valider").tap()
            expect(page.locator("#pvTitle")).to_contain_text("1/6")
        check("modèle de PV, validation bloquée tant qu'il reste « À compléter »", t_pv)
        def t_prev():
            page.locator("#tabPrev").tap()
            expect(page.locator("#viewPrev canvas").first).to_be_visible()
            assert page.evaluate("(()=>{const c=document.querySelector('#viewPrev canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let k=0;for(let i=0;i<d.length;i+=4)if(d[i]<128)k++;return k})()") > 2000, "aperçu vide"
        check("aperçu PDF dessiné", t_prev)
        def t_pdf():
            with page.expect_download() as dl:
                page.locator("#pdfBtn").tap()
            path = dl.value.path(); data = open(path, "rb").read()
            assert data[:5] == b"%PDF-" and len(data) > 4000, "PDF invalide"
            assert dl.value.suggested_filename.startswith("PV-CM-Gaillon-")
        check("téléchargement d'un PDF valide", t_pdf)
        check("aucune erreur JavaScript (PV)", lambda: (_ for _ in ()).throw(AssertionError("; ".join(errors))) if errors else None)
        ctx.close()
        browser.close()
    httpd.shutdown()
    ok = sum(1 for r in results if r[1])
    print(f"\n{ok}/{len(results)} tests réussis")
    sys.exit(0 if ok == len(results) else 1)

if __name__ == "__main__":
    main()
