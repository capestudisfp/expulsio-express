# Expulsió EXPRESS · Mesures correctores

Web per registrar mesures correctores (expulsió, veto a sortides, tasca restaurativa),
generar el document d'expedient disciplinari per imprimir i consultar el registre.

**Com protegeix les dades:** aquesta web (el codi) és pública a GitHub Pages, però **no conté
cap dada d'alumnes**. Quan entres amb el compte de l'escola, el navegador llegeix i escriu
directament al Google Sheet del Google Workspace de l'escola. Només hi poden accedir les
persones amb qui hagis compartit aquest full. Si algú obre la web sense permís, només veu la
pantalla d'accés.

> ⚠️ No pugis mai a GitHub el fitxer Excel, cap CSV ni cap llistat d'alumnes.
> El `.gitignore` ja bloqueja aquests formats, per si de cas.

Prova-la sense configurar res: obre `index.html?demo` (dades inventades).

---

## 1. Prepara el Google Sheet (5 min)

1. Al Drive de l'escola, obre el full de càlcul original (o importa-hi l'Excel amb *Fitxer → Importa*).
2. Comprova que hi ha la pestanya **`LlistatAlumnes`**, amb el **grup a la columna A** i el **nom a la columna B**.
   Cada curs només cal actualitzar aquesta pestanya.
3. La pestanya **`RegistreWeb`** es crea sola la primera vegada que algú entra a l'app.
4. **Comparteix** el full (com a *Editor*) **només** amb els 3 companys. Aquest és el control d'accés de veritat.
5. Copia l'**ID** del full: és el tros de l'URL entre `/d/` i `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xyz`**`/edit`

## 2. Crea l'accés de Google (10 min, només un cop)

Fes-ho amb el **compte de l'escola** (@biada.net). Si no et deixa crear projectes, demana-ho a l'administrador del Google Workspace del centre.

1. Ves a <https://console.cloud.google.com> → **Crea un projecte** (p. ex. `expulsio-express`).
2. *APIs i serveis → Biblioteca* → cerca **Google Sheets API** → **Habilita**.
3. *APIs i serveis → Pantalla de consentiment OAuth* (o *Google Auth Platform*):
   - Tipus d'usuari: **Intern**. Així només hi poden entrar comptes @biada.net.
   - Nom de l'app: `Expulsió EXPRESS`, i el teu correu de suport.
4. *Credencials → Crea credencials → ID de client OAuth*:
   - Tipus: **Aplicació web**
   - **Orígens de JavaScript autoritzats**: `https://EL-TEU-USUARI.github.io`
     (i, si vols provar-la al teu ordinador, `http://localhost:8000`)
   - No cal posar URI de redirecció.
5. Copia l'**ID de client**: acaba en `.apps.googleusercontent.com`.

## 3. Omple `config.js`

```js
GOOGLE_CLIENT_ID: "1234567890-xxxx.apps.googleusercontent.com",
SPREADSHEET_ID: "1AbC...xyz",
USUARIS_AUTORITZATS: [
  "tu@biada.net",
  "company1@biada.net",
  "company2@biada.net",
  "company3@biada.net",
],
```

Aquí també pots canviar el nom del director, les faltes i les hores de la restaurativa.
L'ID de client i l'ID del full no són secrets: sense permís sobre el full no serveixen de res.

## 4. Publica-la a GitHub Pages

1. A <https://github.com/new> crea un repositori, p. ex. `expulsio-express`.
   Pot ser **públic**: només conté codi. GitHub Pages gratuït requereix que ho sigui.
2. *Add file → Upload files* → arrossega-hi **index.html, app.js, styles.css, config.js, README.md i .gitignore**
   → **Commit changes**.
3. *Settings → Pages* → *Source: Deploy from a branch* → branca **main**, carpeta **/ (root)** → **Save**.
4. En un minut la tindràs a `https://EL-TEU-USUARI.github.io/expulsio-express/`.
   Comprova que `https://EL-TEU-USUARI.github.io` és un dels orígens autoritzats del pas 2.

## Ús

- **Nova mesura**: tria grup i alumne/a (o fes servir la cerca ràpida), marca les faltes i les
  mesures. La vista prèvia es va actualitzant. El text de "DECIDEIXO" es pot retocar a mà.
  *Desa al registre i imprimeix* afegeix una fila a `RegistreWeb` i obre la impressió (també serveix per desar-lo en PDF).
- Si l'alumne/a ja té mesures registrades, l'app t'ho avisa.
- **Registre**: cerca, filtra, torna a imprimir un document, esborra registres erronis o exporta-ho a CSV.

## Equivalències amb el full original

| Full original | Web |
|---|---|
| Expulsió EXPRESS (formulari) | Pestanya *Nova mesura* |
| Escrits possibles (23 plantilles) | Es composa automàticament el text segons les mesures triades |
| Full IMPRIMIBLE | Vista prèvia i impressió |
| Registre | Pestanya *Registre* (dades a la pestanya `RegistreWeb` del Google Sheet) |
| LlistatAlumnes | Es llegeix directament del Google Sheet |

## Protecció de dades

- Les dades (noms d'alumnes menors i sancions) es queden al Google Workspace del centre.
- GitHub només guarda el codi de la web.
- L'accés es limita en tres nivells: compte @biada.net (app interna), llista `USUARIS_AUTORITZATS` i permisos de compartició del full.
- Recomanació: informeu-ne la direcció i consulteu el delegat de protecció de dades del Departament d'Educació, perquè quedi recollit al registre d'activitats de tractament del centre.
