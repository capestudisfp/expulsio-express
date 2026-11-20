/* Expulsió EXPRESS — app de mesures correctores
 * Web estàtica (GitHub Pages). Les dades es llegeixen i s'escriuen
 * directament al Google Sheet de l'escola amb el compte de qui entra.
 * No s'emmagatzema cap dada d'alumnes al codi ni a GitHub.
 */
(() => {
  "use strict";
  const C = window.APP_CONFIG;
  const DEMO = new URLSearchParams(location.search).has("demo");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const COLS = ["ID", "Data registre", "Grup", "Alumne/a", "Faltes", "Inici expulsió", "Final expulsió",
    "Dies solts expulsió", "Inici veto", "Final veto", "Dies restaurativa", "Tipus", "Comentari",
    "Registrat per", "Text decisió"];
  const KEYS = ["id", "data", "grup", "alumne", "faltes", "expInici", "expFinal", "expSolts",
    "vetoInici", "vetoFinal", "restaurativa", "tipus", "comentari", "usuari", "decisio"];

  const state = { students: [], records: [], email: "", decisioEditada: false };

  // ───────────────────────── utilitats ─────────────────────────
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fd = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${+d}/${+m}/${y}`; };
  const llista = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " i " + a[a.length - 1];
  const MESOS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
  const dataLlarga = d => { const m = MESOS[d.getMonth()]; return `${d.getDate()} ${/^[aeiou]/.test(m) ? "d'" : "de "}${m} de ${d.getFullYear()}`; };
  const avui = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  function toast(msg, error = false) {
    const t = $("#toast");
    t.textContent = msg; t.className = "toast no-print" + (error ? " error" : ""); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), error ? 6000 : 3000);
  }
  function show(id) {
    $$(".screen").forEach(s => (s.hidden = s.id !== id));
    $$("#tabs button").forEach(b => b.classList.toggle("active", "screen-" + b.dataset.tab === id));
  }

  // ───────────────────────── backend Google Sheets ─────────────────────────
  const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email";
  const API = "https://sheets.googleapis.com/v4/spreadsheets/";
  let tokenClient = null, token = null, tokenExp = 0;

  function loadSavedToken() {
    try {
      const s = JSON.parse(sessionStorage.getItem("ee_tok") || "null");
      if (s && s.exp > Date.now()) { token = s.t; tokenExp = s.exp; }
    } catch (_) { /* sense emmagatzematge */ }
  }
  function saveToken() { try { sessionStorage.setItem("ee_tok", JSON.stringify({ t: token, exp: tokenExp })); } catch (_) {} }

  function waitForGis() {
    return new Promise((res, rej) => {
      let n = 0;
      (function check() {
        if (window.google?.accounts?.oauth2) return res();
        if (++n > 100) return rej(new Error("No s'ha pogut carregar l'inici de sessió de Google."));
        setTimeout(check, 100);
      })();
    });
  }
  function requestToken(prompt) {
    return new Promise((res, rej) => {
      tokenClient.callback = r => {
        if (r.error) return rej(new Error(r.error_description || r.error));
        token = r.access_token; tokenExp = Date.now() + (r.expires_in - 120) * 1000; saveToken(); res(token);
      };
      tokenClient.error_callback = e => rej(new Error(e.message || e.type || "Inici de sessió cancel·lat"));
      tokenClient.requestAccessToken({ prompt, login_hint: state.email || undefined });
    });
  }
  async function api(url, opts = {}, retry = true) {
    if (!token || Date.now() > tokenExp) await requestToken("");
    const r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" } });
    if (r.status === 401 && retry) { token = null; return api(url, opts, false); }
    if (!r.ok) {
      let msg = r.status + "";
      try { msg = (await r.json()).error.message; } catch (_) {}
      if (r.status === 403 || r.status === 404) msg = "No tens accés al full de dades (" + msg + "). Demana que te'l comparteixin.";
      throw new Error(msg);
    }
    return r.json();
  }
  const rng = (sheet, a1) => encodeURIComponent(`'${sheet.replace(/'/g, "''")}'!${a1}`);

  const Sheets = {
    async login(interactive) {
      await waitForGis();
      tokenClient ??= google.accounts.oauth2.initTokenClient({
        client_id: C.GOOGLE_CLIENT_ID, scope: SCOPES, hd: C.DOMINI || undefined, callback: () => {}
      });
      if (!token || Date.now() > tokenExp) await requestToken(interactive ? "select_account" : "");
      const u = await api("https://www.googleapis.com/oauth2/v3/userinfo");
      return (u.email || "").toLowerCase();
    },
    logout() {
      if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
      token = null; try { sessionStorage.removeItem("ee_tok"); } catch (_) {}
    },
    async ensureRegistre() {
      const meta = await api(API + C.SPREADSHEET_ID + "?fields=sheets.properties(sheetId,title)");
      let sh = meta.sheets.find(s => s.properties.title === C.FULL_REGISTRE);
      if (!sh) {
        const r = await api(API + C.SPREADSHEET_ID + ":batchUpdate", {
          method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: C.FULL_REGISTRE, gridProperties: { frozenRowCount: 1 } } } }] })
        });
        sh = { properties: r.replies[0].addSheet.properties };
        await api(API + C.SPREADSHEET_ID + "/values/" + rng(C.FULL_REGISTRE, "A1") + "?valueInputOption=RAW", {
          method: "PUT", body: JSON.stringify({ values: [COLS] })
        });
      }
      this.registreSheetId = sh.properties.sheetId;
    },
    async students() {
      const r = await api(API + C.SPREADSHEET_ID + "/values/" + rng(C.FULL_ALUMNES, "A:B"));
      return (r.values || []).filter(v => v[0] && v[1] && String(v[0]).trim() && String(v[1]).trim())
        .map(v => ({ grup: String(v[0]).trim(), nom: String(v[1]).trim() }));
    },
    async records() {
      const r = await api(API + C.SPREADSHEET_ID + "/values/" + rng(C.FULL_REGISTRE, "A2:O"));
      return (r.values || []).filter(v => v[0]).map(v => Object.fromEntries(KEYS.map((k, i) => [k, v[i] ?? ""])));
    },
    async append(rec) {
      await api(API + C.SPREADSHEET_ID + "/values/" + rng(C.FULL_REGISTRE, "A:O") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", {
        method: "POST", body: JSON.stringify({ values: [KEYS.map(k => rec[k] ?? "")] })
      });
    },
    async remove(id) {
      const r = await api(API + C.SPREADSHEET_ID + "/values/" + rng(C.FULL_REGISTRE, "A:A"));
      const idx = (r.values || []).findIndex(v => v[0] === id);
      if (idx < 1) throw new Error("No s'ha trobat el registre (potser ja s'havia esborrat).");
      await api(API + C.SPREADSHEET_ID + ":batchUpdate", {
        method: "POST", body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: this.registreSheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 } } }] })
      });
    }
  };

  // Backend de demostració: tot inventat i en memòria
  const Demo = {
    data: [],
    async login() { return "demo@exemple.cat"; },
    logout() {},
    async ensureRegistre() {},
    async students() {
      const noms = ["Laia Pons Vidal", "Pau Serra Mas", "Nil Roca Font", "Aina Ribas Coll", "Jan Puig Soler", "Martina Vila Camps",
        "Biel Ferrer Prat", "Júlia Costa Bosch", "Arnau Sala Riera", "Noa Marín Gil", "Èric Torres Pla", "Clara Mora Vives"];
      const grups = ["1r ESO A", "2n ESO B", "3r ESO C", "1CMEV - 1r Electromecànica (demo)"];
      return noms.map((nom, i) => ({ grup: grups[i % grups.length], nom }));
    },
    async records() { return this.data.slice(); },
    async append(rec) { this.data.push(rec); },
    async remove(id) { this.data = this.data.filter(r => r.id !== id); }
  };
  const B = DEMO ? Demo : Sheets;

  // ───────────────────────── arrencada ─────────────────────────
  async function start() {
    if (DEMO) $("#demo-banner").hidden = false;
    if (!DEMO && (!C.GOOGLE_CLIENT_ID || !C.SPREADSHEET_ID)) return show("screen-config");
    loadSavedToken();
    if (DEMO || token) return enter(false).catch(() => show("screen-login"));
    show("screen-login");
  }

  async function enter(interactive) {
    const btn = $("#btn-login"); btn.disabled = true; $("#login-msg").textContent = "Connectant…";
    try {
      const email = await B.login(interactive);
      const allowed = (C.USUARIS_AUTORITZATS || []).map(e => e.toLowerCase());
      if (!DEMO && allowed.length && !allowed.includes(email)) {
        B.logout();
        throw new Error(`El compte ${email} no està autoritzat a fer servir aquesta app.`);
      }
      state.email = email;
      await B.ensureRegistre();
      [state.students, state.records] = await Promise.all([B.students(), B.records()]);
      $("#user-email").textContent = email; $("#user-box").hidden = false; $("#tabs").hidden = false;
      fillStudents(); show("screen-nova"); refreshPreview();
    } catch (e) {
      show("screen-login"); $("#login-msg").textContent = e.message; throw e;
    } finally { btn.disabled = false; }
  }

  // ───────────────────────── formulari ─────────────────────────
  function fillStudents() {
    const grups = [...new Set(state.students.map(s => s.grup))];
    $("#grup").innerHTML = `<option value="">— Tria el grup (${grups.length}) —</option>` + grups.map(g => `<option>${esc(g)}</option>`).join("");
    $("#llista-alumnes").innerHTML = state.students.map(s => `<option value="${esc(s.nom + " · " + s.grup)}"></option>`).join("");
    fillAlumnes();
  }
  function fillAlumnes(sel = "") {
    const g = $("#grup").value, a = $("#alumne");
    const noms = state.students.filter(s => s.grup === g).map(s => s.nom).sort((x, y) => x.localeCompare(y, "ca"));
    a.innerHTML = `<option value="">— Tria l'alumne/a —</option>` + noms.map(n => `<option ${n === sel ? "selected" : ""}>${esc(n)}</option>`).join("");
    a.disabled = !g;
    updateHistorial();
  }
  function updateHistorial() {
    const g = $("#grup").value, n = $("#alumne").value, box = $("#historial-avis");
    if (!n) { box.hidden = true; return; }
    const prev = state.records.filter(r => norm(r.alumne) === norm(n) && norm(r.grup) === norm(g));
    if (!prev.length) { box.hidden = true; return; }
    box.innerHTML = `<strong>Atenció:</strong> aquest alumne/a ja té ${prev.length} mesura${prev.length > 1 ? "es" : ""} registrada${prev.length > 1 ? "es" : ""}: ` +
      prev.map(r => `${esc(r.data)} (${esc(r.tipus)})`).join(", ") + ".";
    box.hidden = false;
  }

  function addDiaSolt(val = "") {
    const box = $("#dies-solts");
    if (box.children.length >= C.MAX_DIES_SOLTS) return toast(`Màxim ${C.MAX_DIES_SOLTS} dies solts.`, true);
    const div = document.createElement("div"); div.className = "list-item";
    div.innerHTML = `<input type="date" value="${esc(val)}" aria-label="Dia d'expulsió"><button type="button" class="icon-btn" title="Treu">✕</button>`;
    box.append(div);
  }
  function addSessio() {
    const box = $("#sessions");
    if (box.children.length >= C.MAX_SESSIONS_RESTAURATIVA) return toast(`Màxim ${C.MAX_SESSIONS_RESTAURATIVA} sessions.`, true);
    const opt = a => a.map(h => `<option>${esc(h)}</option>`).join("");
    const div = document.createElement("div"); div.className = "list-item sessio";
    div.innerHTML = `<input type="date" aria-label="Dia de la sessió">
      <select aria-label="Entrada">${opt(C.HORES_ENTRADA)}</select>
      <select aria-label="Sortida">${opt(C.HORES_SORTIDA)}</select>
      <button type="button" class="icon-btn" title="Treu">✕</button>`;
    // per defecte: entrada 15:55h, sortida 16:50h (com al full original)
    const [e, s] = $$("select", div);
    if (C.HORES_ENTRADA.includes("15:55h")) e.value = "15:55h";
    if (C.HORES_SORTIDA.includes("16:50h")) s.value = "16:50h";
    box.append(div);
  }

  function readForm() {
    const exp = $("input[name=exp]:checked").value;
    return {
      grup: $("#grup").value,
      alumne: $("#alumne").value,
      faltes: $$("#faltes input").map((c, i) => c.checked ? i : -1).filter(i => i >= 0),
      exp: {
        mode: exp,
        inici: $("#exp-inici").value, final: $("#exp-final").value,
        dies: $$("#dies-solts input").map(i => i.value).filter(Boolean).sort()
      },
      veto: { on: $("#veto-on").checked, inici: $("#veto-inici").value, final: $("#veto-final").value },
      rest: {
        on: $("#rest-on").checked,
        sessions: $$("#sessions .list-item").map(d => {
          const [e, s] = $$("select", d);
          return { data: $("input", d).value, entrada: e.value, sortida: s.value };
        }).filter(s => s.data).sort((a, b) => a.data.localeCompare(b.data))
      },
      comentari: $("#comentari").value.trim()
    };
  }

  function validate(m) {
    const e = [];
    if (!m.alumne) e.push("Tria el grup i l'alumne/a.");
    if (!m.faltes.length) e.push("Marca almenys una falta.");
    if (m.exp.mode === "cap" && !m.veto.on && !m.rest.on) e.push("Tria almenys una mesura correctora.");
    if (m.exp.mode === "periode") {
      if (!m.exp.inici) e.push("Indica el dia d'inici de l'expulsió.");
      if (m.exp.final && m.exp.final < m.exp.inici) e.push("El dia final de l'expulsió és anterior al d'inici.");
    }
    if (m.exp.mode === "solts") {
      if (!m.exp.dies.length) e.push("Indica almenys un dia d'expulsió.");
      if (new Set(m.exp.dies).size !== m.exp.dies.length) e.push("Hi ha dies d'expulsió repetits.");
    }
    if (m.veto.on) {
      if (!m.veto.inici) e.push("Indica el dia (o l'inici) del veto a sortides.");
      if (m.veto.final && m.veto.final < m.veto.inici) e.push("El dia final del veto és anterior al d'inici.");
    }
    if (m.rest.on) {
      if (!m.rest.sessions.length) e.push("Indica almenys una sessió de restaurativa amb data.");
      m.rest.sessions.forEach(s => { if (s.entrada.localeCompare(s.sortida, undefined, { numeric: true }) >= 0) e.push(`Restaurativa del ${fd(s.data)}: l'hora d'entrada ha de ser anterior a la de sortida.`); });
    }
    return e;
  }

  // ───────────────────────── text del document ─────────────────────────
  function buildDecisio(m) {
    const nom = m.alumne || "[alumne/a]";
    const hasExp = m.exp.mode !== "cap";
    const restTxt = llista(m.rest.sessions.map(s => `dia ${fd(s.data)} de ${s.entrada} a ${s.sortida}`)) || "[dia]";
    const vetoTxt = (m.veto.final && m.veto.final !== m.veto.inici)
      ? `les sortides que hi hagi programades entre el ${fd(m.veto.inici)} i el ${fd(m.veto.final)}`
      : `la sortida que hi ha programada pel dia ${fd(m.veto.inici) || "[dia]"}`;
    let s;
    if (hasExp) {
      s = `La suspensió d’assistència a classe de l’alumnat ${nom} `;
      if (m.exp.mode === "periode") {
        s += (m.exp.final && m.exp.final !== m.exp.inici)
          ? `des del dia ${fd(m.exp.inici)} al dia ${fd(m.exp.final)}, ambdós inclosos`
          : `el dia ${fd(m.exp.inici) || "[dia]"}`;
      } else {
        s += m.exp.dies.length > 1 ? `els dies ${llista(m.exp.dies.map(fd))}` : `el dia ${fd(m.exp.dies[0]) || "[dia]"}`;
      }
      if (m.rest.on) s += `, com també fer una tasca restaurativa al centre el ${restTxt}`;
      if (m.veto.on) s += `, com també s’informa que no té dret a fer ${vetoTxt}`;
    } else if (m.rest.on) {
      s = `Que vingui l’alumnat ${nom} a fer una tasca restaurativa al centre el ${restTxt}`;
      if (m.veto.on) s += `, com també s’informa que no té dret a fer ${vetoTxt}`;
    } else if (m.veto.on) {
      s = `L’alumnat ${nom} no podrà fer ${vetoTxt}`;
    } else {
      return "";
    }
    s += ", d’acord amb el que estableix l’article 25.7 del Decret 102 de 2010 d’autonomia de centres.";
    if (hasExp) s += " L’alumnat té dret a assistir a les proves avaluatives que se’n derivin aquell dia, els menors hauran de ser recollits després de la prova per un progenitor o tutor legal.";
    if (m.veto.on) s += " El dia de la sortida l’alumnat haurà de restar a casa fent una tasca que comunicarà el professor organitzador de la sortida.";
    if (m.rest.on) s += " En el cas de no presentar-se el dia de la restaurativa i no avisar per correu o trucada amb una justificació adient, derivarà en un enduriment de la mesura correctora i s’haurà de començar de nou el procés signant una nova mesura.";
    return s;
  }

  function docHTML({ alumne, grup, faltes, decisio, data }) {
    const f = C.FALTES.map((t, i) => `<li><span class="cb${faltes.includes(i) ? " on" : ""}"></span><span>${esc(t)}</span></li>`).join("");
    const cap = (C.CAPCALERA || ["Generalitat de Catalunya", "Departament d’Educació", "i Formació Professional"]).map(esc).join("<br>");
    const adr = (C.ADRECA || []).map(esc).join("<br>");
    const P = C.PEU || {};
    return `<div class="doc">
      <header class="doc-head">
        <img class="logo-gene" src="img/logo-generalitat.png" alt="">
        <div class="head-txt">${cap}<br><b>${esc(C.CENTRE_CURT || C.CENTRE)}</b></div>
      </header>
      ${adr ? `<p class="adreca">${adr}</p>` : ""}
      <h2>EXPEDIENT DISCIPLINARI</h2>
      <p class="sub">(Document de reconeixement de la falta comesa i de l’acceptació de la sanció)</p>
      <p>En ${esc(C.DIRECTOR)}, com a ${esc(C.CARREC_DIRECTOR.toLowerCase())} de l’${esc(C.CENTRE)}, he tingut coneixement dels fets que figuren al present escrit, fets que constitueixen una falta de les previstes a l’Article 37.1 de la Llei d’educació de Catalunya (LEC), i dels quals es desprèn la necessitat d’incoar expedient disciplinari a l’alumnat ${esc(alumne || "[alumne/a]")} de ${esc(grup || "[grup]")} per sancionar les presumptes faltes disciplinàries que se’n puguin derivar.</p>
      <p class="reconeix">L’alumne/a reconeix el/s fet/s:</p>
      <ul class="facts">${f}</ul>
      <p class="decideixo">DECIDEIXO:</p>
      <p class="decisio">${esc(decisio || "…").replace(/\n/g, "<br>")}</p>
      <div class="signatures">
        <div>${esc(C.DIRECTOR)}<br>${esc(C.CARREC_DIRECTOR)}</div>
        <div>Signatura, nom, cognom/s i DNI<br>pare/mare o tutor/a legal</div>
      </div>
      <p class="lloc">${esc(C.POBLACIO)}, &nbsp;${esc(data)}</p>
      <table class="doc-peu"><tr>
        <td class="peu-logo"><img src="img/logo-imb.png" alt=""></td>
        <td>Nom document: ${esc(P.nom || "Expedient disciplinari")}</td>
        <td>Versió ${esc(P.versio ?? "0")}</td>
        <td>Vigència des de:<br>${esc(P.vigencia || "Octubre 2022")}</td>
        <td>Pàgina 1 de 1</td>
        <td class="peu-logo"><img src="img/logo-certificacio.png" alt=""></td>
      </tr></table>
    </div>`;
  }

  function refreshPreview() {
    const m = readForm();
    if (!state.decisioEditada) $("#decisio").value = buildDecisio(m);
    $("#preview").innerHTML = docHTML({ ...m, decisio: $("#decisio").value, data: dataLlarga(new Date()) });
  }

  function printDoc(d) {
    $("#print-area").innerHTML = docHTML(d);
    setTimeout(() => window.print(), 50);
  }

  function tipusDe(m) {
    return [m.exp.mode !== "cap" && "Expulsió", m.veto.on && "Veto", m.rest.on && "Restaurativa"].filter(Boolean).join("+");
  }

  function showErrors(e) {
    const box = $("#errors");
    box.hidden = !e.length;
    box.innerHTML = e.length ? `<strong>Revisa:</strong><ul>${e.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    if (e.length) box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onSave(ev) {
    ev.preventDefault();
    const m = readForm(), errs = validate(m);
    showErrors(errs); if (errs.length) return;
    const decisio = $("#decisio").value.trim();
    const rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      data: avui(), grup: m.grup, alumne: m.alumne,
      faltes: m.faltes.map(i => i + 1).join(","),
      expInici: m.exp.mode === "periode" ? fd(m.exp.inici) : "",
      expFinal: m.exp.mode === "periode" ? fd(m.exp.final) : "",
      expSolts: m.exp.mode === "solts" ? m.exp.dies.map(fd).join(", ") : "",
      vetoInici: m.veto.on ? fd(m.veto.inici) : "",
      vetoFinal: m.veto.on ? fd(m.veto.final) : "",
      restaurativa: m.rest.on ? m.rest.sessions.map(s => `${fd(s.data)} ${s.entrada}-${s.sortida}`).join("; ") : "",
      tipus: tipusDe(m), comentari: m.comentari, usuari: state.email, decisio
    };
    const btn = $("#btn-desa"); btn.disabled = true;
    try {
      await B.append(rec);
      state.records.push(rec);
      toast("Mesura desada al registre ✓");
      printDoc({ ...m, decisio, data: dataLlarga(new Date()) });
      resetForm();
    } catch (e) {
      toast("No s'ha pogut desar: " + e.message, true);
    } finally { btn.disabled = false; }
  }

  function onPrintOnly() {
    const m = readForm(), errs = validate(m);
    showErrors(errs); if (errs.length) return;
    printDoc({ ...m, decisio: $("#decisio").value.trim(), data: dataLlarga(new Date()) });
  }

  function resetForm() {
    $("#form").reset();
    $("#dies-solts").innerHTML = ""; $("#sessions").innerHTML = "";
    state.decisioEditada = false; $("#btn-restableix").hidden = true;
    syncMeasures(); fillAlumnes(); showErrors([]); refreshPreview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncMeasures() {
    const exp = $("input[name=exp]:checked").value;
    $("#exp-periode").hidden = exp !== "periode";
    $("#exp-solts").hidden = exp !== "solts";
    if (exp === "solts" && !$("#dies-solts").children.length) addDiaSolt();
    $("#veto-body").hidden = !$("#veto-on").checked;
    $("#rest-body").hidden = !$("#rest-on").checked;
    if ($("#rest-on").checked && !$("#sessions").children.length) addSessio();
  }

  // ───────────────────────── registre ─────────────────────────
  function renderRegistre() {
    const q = norm($("#reg-cerca").value), t = $("#reg-tipus").value;
    const rows = state.records
      .filter(r => (!q || norm(r.alumne + " " + r.grup).includes(q)) && (!t || (r.tipus || "").includes(t)))
      .slice().reverse();
    const tb = $("#reg-taula tbody");
    tb.innerHTML = rows.map(r => `<tr>
      <td>${esc(r.data)}</td><td>${esc(r.grup)}</td><td>${esc(r.alumne)}</td>
      <td>${(r.tipus || "").split("+").filter(Boolean).map(x => `<span class="tag ${esc(x)}">${esc(x)}</span>`).join("")}</td>
      <td>${esc([r.expInici, r.expFinal].filter(Boolean).join(" – ") || r.expSolts)}</td>
      <td>${esc([r.vetoInici, r.vetoFinal].filter(Boolean).join(" – "))}</td>
      <td>${esc(r.restaurativa)}</td>
      <td class="muted">${esc(r.usuari)}</td>
      <td class="actions-cell">
        <button class="ghost small" data-print="${esc(r.id)}" title="Torna a imprimir">🖨</button>
        <button class="ghost small" data-del="${esc(r.id)}" title="Esborra">🗑</button>
      </td></tr>`).join("");
    $("#reg-buit").hidden = rows.length > 0;
    const all = state.records, cnt = k => all.filter(r => (r.tipus || "").includes(k)).length;
    const reinc = Object.values(all.reduce((a, r) => { const k = norm(r.alumne + "|" + r.grup); a[k] = (a[k] || 0) + 1; return a; }, {})).filter(n => n > 1).length;
    $("#reg-stats").innerHTML = [["Mesures", all.length], ["Amb expulsió", cnt("Expulsió")], ["Amb veto", cnt("Veto")], ["Amb restaurativa", cnt("Restaurativa")], ["Alumnes reincidents", reinc]]
      .map(([l, n]) => `<span class="stat"><b>${n}</b>${l}</span>`).join("");
  }

  async function reloadRegistre() {
    try { state.records = await B.records(); renderRegistre(); toast("Registre actualitzat"); }
    catch (e) { toast(e.message, true); }
  }

  function exportCSV() {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [COLS.map(q).join(";"), ...state.records.map(r => KEYS.map(k => q(r[k])).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `registre_mesures_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ───────────────────────── esdeveniments ─────────────────────────
  function bind() {
    $("#faltes").innerHTML = C.FALTES.map((f, i) => `<label><input type="checkbox" value="${i}"> <span>${esc(f)}</span></label>`).join("");
    $("#max-dies").textContent = C.MAX_DIES_SOLTS;

    $("#btn-login").onclick = () => enter(true).catch(() => {});
    $("#btn-logout").onclick = () => { B.logout(); location.href = location.pathname + (DEMO ? "?demo" : ""); };
    $$("#tabs button").forEach(b => b.onclick = () => { show("screen-" + b.dataset.tab); if (b.dataset.tab === "registre") renderRegistre(); });

    $("#grup").onchange = () => { fillAlumnes(); refreshPreview(); };
    $("#alumne").onchange = () => { updateHistorial(); refreshPreview(); };
    $("#cerca").addEventListener("change", e => {
      const v = e.target.value, i = v.lastIndexOf(" · ");
      if (i < 0) return;
      const nom = v.slice(0, i), grup = v.slice(i + 3);
      if (!state.students.some(s => s.nom === nom && s.grup === grup)) return;
      $("#grup").value = grup; fillAlumnes(nom); e.target.value = ""; refreshPreview();
    });

    $("#add-dia").onclick = () => { addDiaSolt(); refreshPreview(); };
    $("#add-sessio").onclick = () => { addSessio(); refreshPreview(); };
    $("#form").addEventListener("click", e => {
      if (e.target.matches(".icon-btn")) { e.target.closest(".list-item").remove(); refreshPreview(); }
    });
    $("#form").addEventListener("change", e => { if (!e.target.matches("#decisio,#cerca")) { syncMeasures(); refreshPreview(); $("#errors").hidden = true; } });
    $("#form").addEventListener("input", e => { if (e.target.matches("input[type=date]")) refreshPreview(); });

    $("#decisio").addEventListener("input", () => {
      state.decisioEditada = true; $("#btn-restableix").hidden = false;
      $("#preview").innerHTML = docHTML({ ...readForm(), decisio: $("#decisio").value, data: dataLlarga(new Date()) });
    });
    $("#btn-restableix").onclick = () => { state.decisioEditada = false; $("#btn-restableix").hidden = true; refreshPreview(); };

    $("#form").addEventListener("submit", onSave);
    $("#btn-imprimeix").onclick = onPrintOnly;
    $("#btn-neteja").onclick = () => { if (confirm("Vols buidar el formulari?")) resetForm(); };

    $("#reg-cerca").oninput = renderRegistre;
    $("#reg-tipus").onchange = renderRegistre;
    $("#reg-refresca").onclick = reloadRegistre;
    $("#reg-csv").onclick = exportCSV;
    $("#reg-taula").addEventListener("click", async e => {
      const pr = e.target.closest("[data-print]"), del = e.target.closest("[data-del]");
      if (pr) {
        const r = state.records.find(x => x.id === pr.dataset.print); if (!r) return;
        printDoc({ alumne: r.alumne, grup: r.grup, faltes: String(r.faltes).split(",").map(n => +n - 1), decisio: r.decisio, data: (([d, m, y]) => y ? dataLlarga(new Date(+y, +m - 1, +d)) : r.data)(String(r.data).split("/")) });
      }
      if (del) {
        const r = state.records.find(x => x.id === del.dataset.del); if (!r) return;
        if (!confirm(`Segur que vols esborrar la mesura de ${r.alumne} (${r.data})?`)) return;
        try { await B.remove(r.id); state.records = state.records.filter(x => x.id !== r.id); renderRegistre(); toast("Registre esborrat"); }
        catch (err) { toast(err.message, true); }
      }
    });
  }

  bind();
  start();
})();
