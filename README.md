# Séance PV : mise en ligne avec Gladia

Deux morceaux :

- `index.html` : l'appli. Elle est hébergée sur GitHub Pages, gratuitement.
- `worker.js` : un petit serveur Cloudflare, gratuit. Il garde la clé Gladia secrète et ouvre chaque session de transcription.

Comptez 20 minutes, depuis un ordinateur.

## 1. Clé Gladia

1. Créez un compte sur app.gladia.io. L'offre Starter donne 50 € de crédits, soit environ 60 h de direct.
2. Copiez votre clé API.

## 2. Serveur Cloudflare (worker.js)

1. Créez un compte gratuit sur dash.cloudflare.com.
2. Allez dans **Workers & Pages → Create → Create Worker**, nommez-le `seance-pv`, puis cliquez sur **Deploy**.
3. Cliquez sur **Edit code**, remplacez tout le contenu par celui de `worker.js`, puis cliquez sur **Deploy**.
4. Allez dans **Settings → Variables and Secrets** et ajoutez deux variables :
   - `GLADIA_API_KEY` (type Secret) : votre clé Gladia.
   - `ALLOWED_ORIGINS` (type Text) : `https://eltzarine.github.io`. Mettez seulement le domaine, sans `/seance-pv`.
   L'appli attend le worker à l'adresse `https://seance-pv.cesar-poirrier.workers.dev` : gardez le nom `seance-pv`.
5. Notez l'adresse du worker, par exemple `https://seance-pv.xxxx.workers.dev`.

## 2 bis. Rédaction automatique du procès-verbal

Au clic sur « Passer au procès-verbal », le serveur fait rédiger le PV par une IA à partir de la transcription. Un seul de ces moyens suffit :

- **Gratuit, sans clé : Workers AI de Cloudflare.** Sur le worker, ouvrez **Settings › Bindings › Add binding › Workers AI**, nommez la liaison `AI`, puis cliquez sur **Deploy**. Le quota gratuit (10 000 « neurones » par jour) couvre environ 8 PV de séances de 2 h par jour. Modèle par défaut : `@cf/mistralai/mistral-small-3.1-24b-instruct`, modifiable avec la variable `WORKERS_AI_MODEL`.
- `ANTHROPIC_API_KEY` (Secret) : clé de l'API Claude (platform.claude.com), environ 0,10 $ par PV. Modèle : `claude-sonnet-5-5` (variable `ANTHROPIC_MODEL`).
- `MISTRAL_API_KEY` (Secret) : clé de l'API Mistral (console.mistral.ai). Modèle : `mistral-large-latest` (variable `MISTRAL_MODEL`).

Si plusieurs sont configurés, la clé Claude passe en premier, puis Mistral, puis Workers AI. Sans aucun, l'appli préremplit le modèle de PV avec les interventions de chaque point.

## 3. Appli sur GitHub Pages (index.html)

1. Créez un dépôt GitHub `seance-pv` et déposez-y `index.html`.
2. Allez dans **Settings → Pages**, choisissez *Deploy from a branch*, la branche `main` et le dossier `/ (root)`.
3. L'appli est alors disponible sur `https://eltzarine.github.io/seance-pv/`.

## 4. Relier l'appli au serveur

Rien ne se règle dans l'appli : l'adresse du serveur est inscrite une fois pour toutes dans le code.

1. Dans `index.html`, cherchez la ligne `const TRANSCRIPTION_SERVER = "";`.
2. Mettez-y l'adresse du worker, par exemple `const TRANSCRIPTION_SERVER = "https://seance-pv.xxxx.workers.dev";`.
3. Enregistrez le fichier sur GitHub. L'appli utilise alors Gladia sans rien afficher. Si l'adresse est vide, elle se replie sur la reconnaissance vocale du navigateur.

## En séance

- Utilisez un ordinateur portable avec Chrome ou Edge, branché sur secteur.
- Pour le son, le mieux est la sortie de la sono de la salle, reliée par une interface audio USB. À défaut, posez un micro de table près du président.
- Le président touche le nom de l'élu qui prend la parole. Chaque phrase reçue est attribuée à l'orateur actif au moment où elle commence.
- À la fin, utilisez **Exporter** pour récupérer la séance, puis **Importer** dans la version Claude pour rédiger et valider le procès-verbal.

## Sécurité

- La clé Gladia ne quitte jamais le serveur. Le navigateur reçoit seulement un jeton temporaire, valable pour une session.
- Le serveur n'accepte que les demandes venant de votre site (`ALLOWED_ORIGINS`) et limite chaque adresse IP à 12 ouvertures de session par tranche de 10 minutes. Par précaution, fixez aussi une limite de dépense dans votre compte Gladia.
- Les séances importées sont contrôlées champ par champ : un contenu piégé s'affiche comme du simple texte.

## Tests

- `python3 tests/e2e.py` : tests de bout en bout (Playwright, Chromium, iPhone émulé) : appel des élus, grille des orateurs, dictée Chrome et Safari simulées, erreurs de micro, transcription Gladia simulée, import hostile, politique de sécurité, procès-verbal, aperçu et PDF.
- `node tests/worker.test.mjs` : tests du serveur (origines, erreurs, limitation de débit).

L'appli hébergée se compose de `index.html`, `app.css` et `app.js`, avec une politique de sécurité de contenu stricte : scripts du site uniquement, connexions limitées au serveur de transcription et à Gladia.
