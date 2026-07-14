const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { data, save, nowLocal, newToken } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'rehab';
const SESSION_SECRET = process.env.SESSION_SECRET || 'cambia-questo-segreto';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'rehab_sess',
  secret: SESSION_SECRET,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  httpOnly: true
}));

/* ---------- helpers ---------- */
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const int = (v, d = null) => { const n = parseInt(v); return isNaN(n) ? d : n; };
const byId = (coll, id) => data[coll].find(x => x.id === int(id));
const nextId = (coll) => (++data.seq[coll]);
function paziente(id) { return id ? data.pazienti.find(p => p.id === int(id)) : null; }
function withPaziente(m) {
  const p = paziente(m.paziente_id);
  return { ...m, p_nome: p ? p.nome : null, p_cognome: p ? p.cognome : null, p_telefono: p ? p.telefono : null,
    p_cf: p ? p.codice_fiscale : null, p_indirizzo: p ? p.indirizzo : null };
}

/* ---------- Auth ---------- */
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === APP_PASSWORD) { req.session.auth = true; return res.json({ ok: true }); }
  return res.status(401).json({ ok: false, error: 'Password errata' });
});
app.post('/api/logout', (req, res) => { req.session = null; res.json({ ok: true }); });
app.get('/api/me', (req, res) => { res.json({ auth: !!(req.session && req.session.auth) }); });
function requireAuth(req, res, next) {
  if (req.session && req.session.auth) return next();
  return res.status(401).json({ error: 'Non autorizzato' });
}

app.use(express.static(path.join(__dirname, 'public')));

const api = express.Router();
api.use(requireAuth);

/* ---------- Impostazioni ---------- */
api.get('/impostazioni', (req, res) => res.json(data.impostazioni));
api.put('/impostazioni', (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) data.impostazioni[k] = String(v ?? '');
  save(); res.json({ ok: true });
});

/* ---------- Pazienti ---------- */
api.get('/pazienti', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  let list = data.pazienti.slice();
  if (q) list = list.filter(p => [p.nome, p.cognome, p.telefono, p.email].some(v => (v || '').toLowerCase().includes(q)));
  list.sort((a, b) => (a.cognome + a.nome).localeCompare(b.cognome + b.nome, 'it'));
  res.json(list);
});
api.get('/pazienti/:id', (req, res) => {
  const p = byId('pazienti', req.params.id);
  if (!p) return res.status(404).json({ error: 'Non trovato' });
  const out = { ...p };
  out.appuntamenti = data.appuntamenti.filter(a => a.paziente_id === p.id)
    .sort((a, b) => (b.data + b.ora_inizio).localeCompare(a.data + a.ora_inizio));
  out.movimenti = data.movimenti.filter(m => m.paziente_id === p.id).sort((a, b) => b.data.localeCompare(a.data));
  res.json(out);
});
api.post('/pazienti', (req, res) => {
  const b = req.body || {};
  const p = {
    id: nextId('pazienti'), nome: b.nome || '', cognome: b.cognome || '', telefono: b.telefono || '', email: b.email || '',
    data_nascita: b.data_nascita || '', codice_fiscale: b.codice_fiscale || '', indirizzo: b.indirizzo || '', note: b.note || '',
    creato_il: nowLocal()
  };
  data.pazienti.push(p); save(); res.json({ id: p.id });
});
api.put('/pazienti/:id', (req, res) => {
  const p = byId('pazienti', req.params.id); if (!p) return res.status(404).json({ error: 'Non trovato' });
  const b = req.body || {};
  Object.assign(p, {
    nome: b.nome || '', cognome: b.cognome || '', telefono: b.telefono || '', email: b.email || '',
    data_nascita: b.data_nascita || '', codice_fiscale: b.codice_fiscale || '', indirizzo: b.indirizzo || '', note: b.note || ''
  });
  save(); res.json({ ok: true });
});
api.delete('/pazienti/:id', (req, res) => {
  const id = int(req.params.id);
  data.pazienti = data.pazienti.filter(p => p.id !== id);
  data.appuntamenti.forEach(a => { if (a.paziente_id === id) a.paziente_id = null; });
  data.movimenti.forEach(m => { if (m.paziente_id === id) m.paziente_id = null; });
  data.ricevute.forEach(r => { if (r.paziente_id === id) r.paziente_id = null; });
  save(); res.json({ ok: true });
});

/* ---------- Listino ---------- */
api.get('/listino', (req, res) => {
  res.json(data.listino.slice().sort((a, b) => (b.attivo - a.attivo) || a.nome.localeCompare(b.nome, 'it')));
});
api.post('/listino', (req, res) => {
  const b = req.body || {};
  const l = { id: nextId('listino'), nome: b.nome || '', durata_min: int(b.durata_min, 60), prezzo: num(b.prezzo), attivo: b.attivo == null ? 1 : int(b.attivo, 1) };
  data.listino.push(l); save(); res.json({ id: l.id });
});
api.put('/listino/:id', (req, res) => {
  const l = byId('listino', req.params.id); if (!l) return res.status(404).json({ error: 'Non trovato' });
  const b = req.body || {};
  Object.assign(l, { nome: b.nome || '', durata_min: int(b.durata_min, 60), prezzo: num(b.prezzo), attivo: b.attivo == null ? 1 : int(b.attivo, 1) });
  save(); res.json({ ok: true });
});
api.delete('/listino/:id', (req, res) => {
  const id = int(req.params.id); data.listino = data.listino.filter(l => l.id !== id); save(); res.json({ ok: true });
});

/* ---------- Appuntamenti ---------- */
api.get('/appuntamenti', (req, res) => {
  const { dal, al } = req.query;
  let list = data.appuntamenti.slice();
  if (dal) list = list.filter(a => a.data >= dal);
  if (al) list = list.filter(a => a.data <= al);
  list.sort((a, b) => (a.data + a.ora_inizio).localeCompare(b.data + b.ora_inizio));
  res.json(list.map(withPaziente));
});
api.post('/appuntamenti', (req, res) => {
  const b = req.body || {};
  if (!b.data || !b.ora_inizio) return res.status(400).json({ error: 'Data e ora obbligatorie' });
  const a = {
    id: nextId('appuntamenti'), paziente_id: int(b.paziente_id) || null, data: b.data, ora_inizio: b.ora_inizio,
    ora_fine: b.ora_fine || '', tipo_seduta: b.tipo_seduta || '', prezzo: num(b.prezzo), stato: b.stato || 'programmato',
    pagato: b.pagato ? 1 : 0, note: b.note || '', conferma: '', token: newToken(), creato_il: nowLocal()
  };
  data.appuntamenti.push(a); save(); res.json({ id: a.id });
});
api.put('/appuntamenti/:id', (req, res) => {
  const a = byId('appuntamenti', req.params.id); if (!a) return res.status(404).json({ error: 'Non trovato' });
  const b = req.body || {};
  Object.assign(a, {
    paziente_id: int(b.paziente_id) || null, data: b.data, ora_inizio: b.ora_inizio, ora_fine: b.ora_fine || '',
    tipo_seduta: b.tipo_seduta || '', prezzo: num(b.prezzo), stato: b.stato || 'programmato', pagato: b.pagato ? 1 : 0, note: b.note || ''
  });
  save(); res.json({ ok: true });
});
api.delete('/appuntamenti/:id', (req, res) => {
  const id = int(req.params.id); data.appuntamenti = data.appuntamenti.filter(a => a.id !== id); save(); res.json({ ok: true });
});
api.post('/appuntamenti/:id/incassa', (req, res) => {
  const a = byId('appuntamenti', req.params.id); if (!a) return res.status(404).json({ error: 'Non trovato' });
  const metodo = (req.body && req.body.metodo) || 'contanti';
  a.pagato = 1; a.stato = 'completato';
  data.movimenti.push({
    id: nextId('movimenti'), data: a.data, tipo: 'entrata', categoria: 'Seduta', descrizione: a.tipo_seduta || 'Seduta',
    importo: num(a.prezzo), metodo, paziente_id: a.paziente_id, appuntamento_id: a.id, creato_il: nowLocal()
  });
  save(); res.json({ ok: true });
});

/* ---------- Movimenti ---------- */
api.get('/movimenti', (req, res) => {
  const { dal, al, tipo } = req.query;
  let list = data.movimenti.slice();
  if (dal) list = list.filter(m => m.data >= dal);
  if (al) list = list.filter(m => m.data <= al);
  if (tipo) list = list.filter(m => m.tipo === tipo);
  list.sort((a, b) => b.data.localeCompare(a.data) || (b.id - a.id));
  res.json(list.map(withPaziente));
});
api.post('/movimenti', (req, res) => {
  const b = req.body || {};
  if (!b.data) return res.status(400).json({ error: 'Data obbligatoria' });
  const m = {
    id: nextId('movimenti'), data: b.data, tipo: b.tipo || 'entrata', categoria: b.categoria || '', descrizione: b.descrizione || '',
    importo: num(b.importo), metodo: b.metodo || '', paziente_id: int(b.paziente_id) || null, appuntamento_id: null, creato_il: nowLocal()
  };
  data.movimenti.push(m); save(); res.json({ id: m.id });
});
api.put('/movimenti/:id', (req, res) => {
  const m = byId('movimenti', req.params.id); if (!m) return res.status(404).json({ error: 'Non trovato' });
  const b = req.body || {};
  Object.assign(m, {
    data: b.data, tipo: b.tipo || 'entrata', categoria: b.categoria || '', descrizione: b.descrizione || '',
    importo: num(b.importo), metodo: b.metodo || '', paziente_id: int(b.paziente_id) || null
  });
  save(); res.json({ ok: true });
});
api.delete('/movimenti/:id', (req, res) => {
  const id = int(req.params.id); data.movimenti = data.movimenti.filter(m => m.id !== id); save(); res.json({ ok: true });
});

/* ---------- Ricevute ---------- */
api.get('/ricevute', (req, res) => {
  const list = data.ricevute.slice().sort((a, b) => (b.anno - a.anno) || (b.numero - a.numero));
  res.json(list.map(withPaziente));
});
api.get('/ricevute/:id', (req, res) => {
  const r = byId('ricevute', req.params.id); if (!r) return res.status(404).json({ error: 'Non trovato' });
  res.json(withPaziente(r));
});
api.post('/ricevute', (req, res) => {
  const b = req.body || {};
  if (!b.data) return res.status(400).json({ error: 'Data obbligatoria' });
  const anno = int(b.anno, new Date().getFullYear());
  const maxN = data.ricevute.filter(r => r.anno === anno).reduce((mx, r) => Math.max(mx, r.numero), 0);
  const numero = maxN + 1;
  let movId = null;
  if (b.registra_movimento !== false) {
    const mv = {
      id: nextId('movimenti'), data: b.data, tipo: 'entrata', categoria: 'Ricevuta',
      descrizione: `Ricevuta n. ${numero}/${anno}`, importo: num(b.importo), metodo: b.metodo || '',
      paziente_id: int(b.paziente_id) || null, appuntamento_id: null, creato_il: nowLocal()
    };
    data.movimenti.push(mv); movId = mv.id;
  }
  const r = {
    id: nextId('ricevute'), numero, anno, data: b.data, paziente_id: int(b.paziente_id) || null,
    descrizione: b.descrizione || '', importo: num(b.importo), metodo: b.metodo || '', movimento_id: movId, creato_il: nowLocal()
  };
  data.ricevute.push(r); save(); res.json({ id: r.id, numero, anno });
});
api.delete('/ricevute/:id', (req, res) => {
  const id = int(req.params.id); data.ricevute = data.ricevute.filter(r => r.id !== id); save(); res.json({ ok: true });
});

/* ---------- Dashboard ---------- */
api.get('/dashboard', (req, res) => {
  const oggi = nowLocal().slice(0, 10);
  const appOggi = data.appuntamenti.filter(a => a.data === oggi)
    .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio)).map(withPaziente);
  const meseInizio = oggi.slice(0, 7) + '-01';
  const sum = (arr) => arr.reduce((s, x) => s + num(x.importo), 0);
  const entrateMese = sum(data.movimenti.filter(m => m.tipo === 'entrata' && m.data >= meseInizio));
  const usciteMese = sum(data.movimenti.filter(m => m.tipo === 'uscita' && m.data >= meseInizio));
  const daIncassare = data.appuntamenti.filter(a => !a.pagato && a.stato !== 'annullato').reduce((s, a) => s + num(a.prezzo), 0);
  res.json({ oggi, appOggi, nPazienti: data.pazienti.length, entrateMese, usciteMese, daIncassare });
});

/* ---------- Report ---------- */
api.get('/report', (req, res) => {
  const anno = String(req.query.anno || new Date().getFullYear());
  const inAnno = (d) => (d || '').slice(0, 4) === anno;
  const mesiMap = {};
  data.movimenti.filter(m => inAnno(m.data)).forEach(m => {
    const k = m.data.slice(0, 7);
    mesiMap[k] = mesiMap[k] || { mese: k, entrate: 0, uscite: 0 };
    if (m.tipo === 'entrata') mesiMap[k].entrate += num(m.importo); else mesiMap[k].uscite += num(m.importo);
  });
  const catMap = {};
  data.movimenti.filter(m => inAnno(m.data)).forEach(m => {
    const k = (m.categoria || 'Altro') + '|' + m.tipo;
    catMap[k] = catMap[k] || { categoria: m.categoria || 'Altro', tipo: m.tipo, totale: 0 };
    catMap[k].totale += num(m.importo);
  });
  const seduteMap = {};
  data.appuntamenti.filter(a => inAnno(a.data) && a.stato === 'completato').forEach(a => {
    const k = a.data.slice(0, 7); seduteMap[k] = (seduteMap[k] || { mese: k, n: 0 }); seduteMap[k].n++;
  });
  const totEntrate = data.movimenti.filter(m => m.tipo === 'entrata' && inAnno(m.data)).reduce((s, m) => s + num(m.importo), 0);
  const totUscite = data.movimenti.filter(m => m.tipo === 'uscita' && inAnno(m.data)).reduce((s, m) => s + num(m.importo), 0);
  res.json({
    anno,
    mesi: Object.values(mesiMap).sort((a, b) => a.mese.localeCompare(b.mese)),
    perCategoria: Object.values(catMap).sort((a, b) => b.totale - a.totale),
    sedute: Object.values(seduteMap).sort((a, b) => a.mese.localeCompare(b.mese)),
    totEntrate, totUscite
  });
});

app.use('/api', api);

/* ===== Pagina pubblica di conferma appuntamento (paziente, senza login) ===== */
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
function dataEstesa(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI_IT[d.getMonth()]} ${d.getFullYear()}`;
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const LOGO_SVG = '<svg viewBox="0 0 32 32" fill="none"><path d="M4 19h4.2l2.3-6.4a1 1 0 0 1 1.9.05L16 22l2.4-11.5a1 1 0 0 1 1.95.06L22.3 19H28" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function confirmPage({ a, p, s, notfound }) {
  const studio = (s && s.studio_nome) || 'Rehab';
  const sub = (s && s.studio_sottotitolo) || 'Studio di Chinesiologia';
  const indir = (s && s.studio_indirizzo) || '';
  const head = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#2f8fb3"><title>Conferma appuntamento — ${escapeHtml(studio)}</title>
    <style>
      *{box-sizing:border-box} body{margin:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:radial-gradient(1000px 500px at 50% -10%,#dcecf4,#f6fafc 55%);color:#1f2d3a;
        min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:22px}
      .card{background:#fff;border:1px solid #e7eef4;border-radius:22px;box-shadow:0 20px 60px rgba(31,45,58,.14);
        width:100%;max-width:420px;padding:30px 26px;text-align:center}
      .logo{width:60px;height:60px;border-radius:18px;margin:0 auto 14px;background:linear-gradient(135deg,#3aa0c4,#26788f);
        display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(47,143,179,.35)}
      .logo svg{width:38px;height:38px}
      h1{font-size:21px;margin:0 0 2px} .sub{color:#7d8ea0;font-size:13px;margin:0 0 20px}
      .box{background:#f1f8fb;border:1px solid #e6f3f8;border-radius:14px;padding:16px 18px;margin:8px 0 20px;text-align:left}
      .box .when{font-size:18px;font-weight:700;color:#26788f} .box .meta{color:#47586a;font-size:14px;margin-top:4px}
      .ask{font-size:15px;color:#47586a;margin-bottom:16px}
      .btns{display:flex;flex-direction:column;gap:10px}
      button{border:none;border-radius:12px;padding:14px;font-size:15.5px;font-weight:650;font-family:inherit;cursor:pointer}
      .ok{background:linear-gradient(135deg,#3aa0c4,#26788f);color:#fff;box-shadow:0 6px 16px rgba(47,143,179,.28)}
      .no{background:#fff;color:#c9614f;border:1px solid #f2d6d1}
      .result{font-size:16px;font-weight:600;padding:18px;border-radius:14px;margin-top:6px}
      .result.green{background:#e4f5ee;color:#2a7d5f} .result.red{background:#fcecea;color:#c9614f}
      .foot{color:#9fb0be;font-size:12px;margin-top:18px}
    </style></head><body><div class="card">
      <div class="logo">${LOGO_SVG}</div>
      <h1>${escapeHtml(studio)}</h1><p class="sub">${escapeHtml(sub)}</p>`;
  const foot = `<div class="foot">${escapeHtml(indir)}</div></div></body></html>`;

  if (notfound) {
    return head + `<div class="result red">Link non valido o scaduto.</div>` + foot;
  }
  const nome = p ? escapeHtml(p.nome || '') : '';
  const already = a.conferma === 'confermato' ? 'green' : (a.conferma === 'disdetto' ? 'red' : '');
  const info = `<div class="box"><div class="when">${dataEstesa(a.data)}</div>
      <div class="meta">Ore ${escapeHtml(a.ora_inizio)}${a.tipo_seduta ? ' · ' + escapeHtml(a.tipo_seduta) : ''}</div></div>`;
  let body;
  if (a.conferma === 'confermato') {
    body = info + `<div class="result green" id="res">✓ Appuntamento confermato. Grazie${nome ? ', ' + nome : ''}!</div>
      <div class="btns" style="margin-top:14px"><button class="no" onclick="setStato('disdetto')">Non posso più venire</button></div>`;
  } else if (a.conferma === 'disdetto') {
    body = info + `<div class="result red" id="res">Hai segnalato che non puoi venire.</div>
      <div class="btns" style="margin-top:14px"><button class="ok" onclick="setStato('confermato')">In realtà confermo</button></div>`;
  } else {
    body = `<p class="ask">Ciao${nome ? ' ' + nome : ''}, confermi questo appuntamento?</p>${info}
      <div class="btns" id="btns">
        <button class="ok" onclick="setStato('confermato')">✓ Confermo</button>
        <button class="no" onclick="setStato('disdetto')">Non posso venire</button>
      </div><div id="res"></div>`;
  }
  const script = `<script>
    async function setStato(stato){
      try{
        const r = await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stato})});
        if(!r.ok) throw 0;
        const el = document.getElementById('res'); const btns = document.getElementById('btns'); if(btns) btns.style.display='none';
        el.className = 'result ' + (stato==='confermato'?'green':'red');
        el.textContent = stato==='confermato' ? '✓ Appuntamento confermato. Grazie!' : 'Grazie per avercelo comunicato.';
        setTimeout(()=>location.reload(), 1400);
      }catch(e){ alert('Si è verificato un errore, riprova.'); }
    }
  </script>`;
  return head + body + script + foot;
}

function findByToken(token) { return data.appuntamenti.find(a => a.token === token); }

app.get('/conferma/:token', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const a = findByToken(req.params.token);
  if (!a) return res.status(404).send(confirmPage({ notfound: true, s: data.impostazioni }));
  const p = a.paziente_id ? data.pazienti.find(x => x.id === a.paziente_id) : null;
  res.send(confirmPage({ a, p, s: data.impostazioni }));
});

app.post('/conferma/:token', (req, res) => {
  const a = findByToken(req.params.token);
  if (!a) return res.status(404).json({ error: 'Non trovato' });
  const stato = (req.body && req.body.stato) === 'disdetto' ? 'disdetto' : 'confermato';
  a.conferma = stato;
  if (stato === 'disdetto') a.stato = 'annullato';
  save();
  res.json({ ok: true, stato });
});

/* ===== Feed calendario iCal (abbonamento Google Calendar / Apple / Outlook) ===== */
function icsEsc(s) { return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function pad2(n) { return String(n).padStart(2, '0'); }
function icsLocal(dateIso, hhmm) {
  const [Y, M, D] = dateIso.split('-');
  const [h, m] = (hhmm || '00:00').split(':');
  return `${Y}${M}${D}T${pad2(h)}${pad2(m)}00`;
}
function addMinutes(hhmm, mins) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  let tot = h * 60 + m + mins;
  tot = ((tot % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(tot / 60))}:${pad2(tot % 60)}`;
}
function durataFor(a) {
  if (a.ora_fine) return null; // usa ora_fine
  const l = data.listino.find(x => x.nome === a.tipo_seduta);
  return (l && l.durata_min) ? l.durata_min : 60;
}
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Rome',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'
];

app.get('/calendar/:token/rehab.ics', (req, res) => {
  if (req.params.token !== data.impostazioni.calendar_token) return res.status(404).send('Not found');
  const s = data.impostazioni;
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rehab//Gestionale//IT', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${icsEsc((s.studio_nome || 'Rehab') + ' — Appuntamenti')}`,
    'X-WR-TIMEZONE:Europe/Rome', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...VTIMEZONE
  ];
  for (const a of data.appuntamenti) {
    if (!a.data || !a.ora_inizio) continue;
    const p = a.paziente_id ? data.pazienti.find(x => x.id === a.paziente_id) : null;
    const fine = a.ora_fine || addMinutes(a.ora_inizio, durataFor(a) || 60);
    const titolo = (p ? `${p.cognome} ${p.nome}` : 'Appuntamento') + (a.tipo_seduta ? ` — ${a.tipo_seduta}` : '');
    const descr = [
      a.tipo_seduta ? `Tipo: ${a.tipo_seduta}` : '',
      p && p.telefono ? `Tel: ${p.telefono}` : '',
      a.conferma === 'confermato' ? 'Stato: confermato dal paziente' : (a.conferma === 'disdetto' ? 'Stato: disdetto' : ''),
      a.note ? `Note: ${a.note}` : ''
    ].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:appt-${a.id}@rehab-gestionale`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Rome:${icsLocal(a.data, a.ora_inizio)}`,
      `DTEND;TZID=Europe/Rome:${icsLocal(a.data, fine)}`,
      `SUMMARY:${icsEsc(titolo)}`,
      `STATUS:${a.stato === 'annullato' ? 'CANCELLED' : 'CONFIRMED'}`
    );
    if (descr) lines.push(`DESCRIPTION:${icsEsc(descr)}`);
    if (s.studio_indirizzo) lines.push(`LOCATION:${icsEsc(s.studio_indirizzo)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'inline; filename="rehab.ics"');
  res.send(lines.join('\r\n'));
});

app.listen(PORT, () => console.log(`Rehab gestionale in ascolto sulla porta ${PORT}`));
