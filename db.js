/*
 * Archivio dati in puro JavaScript, persistito su file JSON.
 * Nessuna dipendenza nativa: deploy affidabile ovunque (Railway incluso).
 * Adatto a un uso a utente singolo come questo gestionale.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function newToken() { return crypto.randomBytes(16).toString('hex'); }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'rehab.json');

const DEFAULT_IMPOST = {
  studio_nome: 'Rehab',
  studio_sottotitolo: 'Studio di Chinesiologia',
  studio_indirizzo: 'Via Provinciale 225, Gugnano',
  studio_partitaiva: '',
  studio_codicefiscale: '',
  studio_telefono: '',
  studio_email: '',
  ricevuta_note: 'Documento non valido ai fini fiscali salvo diversa indicazione.'
};

function emptyData() {
  return {
    seq: { pazienti: 0, appuntamenti: 0, movimenti: 0, listino: 0, ricevute: 0 },
    pazienti: [], appuntamenti: [], movimenti: [], listino: [], ricevute: [],
    impostazioni: { ...DEFAULT_IMPOST }
  };
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  // completa eventuali chiavi mancanti
  const base = emptyData();
  data = { ...base, ...data, seq: { ...base.seq, ...data.seq }, impostazioni: { ...base.impostazioni, ...data.impostazioni } };
} catch {
  data = emptyData();
  // Listino di esempio iniziale
  data.listino = [
    { id: ++data.seq.listino, nome: 'Prima valutazione', durata_min: 60, prezzo: 60, attivo: 1 },
    { id: ++data.seq.listino, nome: 'Seduta di chinesiologia', durata_min: 60, prezzo: 50, attivo: 1 },
    { id: ++data.seq.listino, nome: 'Seduta di mantenimento', durata_min: 45, prezzo: 40, attivo: 1 }
  ];
}

// Migrazione: assicura token e stato conferma su ogni appuntamento esistente
let _migrated = false;
for (const a of data.appuntamenti) {
  if (!a.token) { a.token = newToken(); _migrated = true; }
  if (a.conferma === undefined) { a.conferma = ''; _migrated = true; }
}

let saveTimer = null;
function persist() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}
function save() {
  // scrittura immediata ma protetta da errori
  try { persist(); } catch (e) { console.error('Errore salvataggio dati:', e.message); }
}

function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

if (_migrated) { try { persist(); } catch (e) {} }

module.exports = { data, save, nowLocal, newToken };
