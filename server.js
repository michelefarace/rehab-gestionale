const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { data, save, nowLocal } = require('./db');

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
    pagato: b.pagato ? 1 : 0, note: b.note || '', creato_il: nowLocal()
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

app.listen(PORT, () => console.log(`Rehab gestionale in ascolto sulla porta ${PORT}`));
