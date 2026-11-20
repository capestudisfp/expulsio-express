// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓ — Expulsió EXPRESS
//  Aquest fitxer NO conté dades personals ni secrets: és segur
//  pujar-lo a GitHub. Les dades viuen al Google Sheet de l'escola.
// ─────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  // ID de client OAuth de Google Cloud (tipus "Aplicació web").
  // Exemple: "1234567890-abc123.apps.googleusercontent.com"
  GOOGLE_CLIENT_ID: "333848844350-h1ug173bnto4anlbhrvh4ughrft04ikr.apps.googleusercontent.com",

  // ID del Google Sheet (el tros llarg de l'URL entre /d/ i /edit).
  SPREADSHEET_ID: "1UMmXl2rMsoSw8p9V_r-gy81HLyLroMfkwnj4D_1IRFU",

  // Domini del Google Workspace de l'escola (limita el selector de comptes).
  DOMINI: "biada.net",

  // Correus que poden fer servir l'app (en minúscules).
  // El control d'accés REAL és amb qui comparteixes el Google Sheet;
  // aquesta llista només evita que algú altre vegi la interfície.
  USUARIS_AUTORITZATS: [
    "capestudis@biada.net","coordinaciopedagogica@biada.net","coordinacio.pedagogicafp@biada.net","capestudisfp@biada.net"
  ],

  // Pestanyes del Google Sheet
  FULL_ALUMNES: "LlistatAlumnes",   // columna A = grup, columna B = nom
  FULL_REGISTRE: "RegistreWeb",     // es crea automàticament si no existeix

  // Dades del document
  CENTRE: "Institut Miquel Biada de Mataró",
  DIRECTOR: "Jaume Arcos Vinyals",
  CARREC_DIRECTOR: "Director",
  POBLACIO: "Mataró",

  FALTES: [
    "La reiterada alteració injustificada del desenvolupament normal de les activitats del centre.",
    "La reiterada manca de respecte al professorat i/o al PAS.",
    "La reiterada manca de respecte als companys."
  ],

  MAX_DIES_SOLTS: 3,
  MAX_SESSIONS_RESTAURATIVA: 10,
  HORES_ENTRADA: ["14:45h", "15:00h", "15:55h", "16:50h", "18:15h", "19:10h", "20:05h"],
  HORES_SORTIDA: ["15:55h", "16:50h", "17:45h", "19:10h", "20:05h", "21:00h"]
};
