'use strict';

/* ============ Utilities ============ */
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const todayISO = () => new Date().toISOString().slice(0, 10);
const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtGiorno(iso) {
  const dt = new Date(iso + 'T00:00:00');
  const g = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][dt.getDay()];
  return `${g} ${fmtData(iso)}`;
}

/* ============ Icone SVG ============ */
const _sv = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  dashboard: _sv('<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>'),
  agenda: _sv('<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8 14h3"/>'),
  pazienti: _sv('<circle cx="9" cy="8" r="3.1"/><path d="M3.4 20a5.6 5.6 0 0 1 11.2 0"/><path d="M16.2 5.3a3.1 3.1 0 0 1 0 5.9M21 20a5.6 5.6 0 0 0-4-5.4"/>'),
  contabilita: _sv('<rect x="2.5" y="5.5" width="19" height="14" rx="2.6"/><path d="M2.5 10h19"/><circle cx="17" cy="14.7" r="1.3"/>'),
  ricevute: _sv('<path d="M6 2.5h12v19l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8h6M9 12h6"/>'),
  report: _sv('<path d="M3 21h18"/><rect x="5" y="10.5" width="3.4" height="7.5" rx="1"/><rect x="10.3" y="6.5" width="3.4" height="11.5" rx="1"/><rect x="15.6" y="13" width="3.4" height="5" rx="1"/>'),
  impostazioni: _sv('<circle cx="12" cy="12" r="3.1"/><path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6M5 5l1.9 1.9M17.1 17.1 19 19M19 5l-1.9 1.9M6.9 17.1 5 19"/>'),
  esci: _sv('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>'),
  more: _sv('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>')
};
const LOGO_SVG = '<svg viewBox="0 0 32 32" fill="none" aria-label="Rehab"><path d="M4 19h4.2l2.3-6.4a1 1 0 0 1 1.9.05L16 22l2.4-11.5a1 1 0 0 1 1.95.06L22.3 19H28" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const VIEW_TITLES = { dashboard: 'Dashboard', agenda: 'Agenda', pazienti: 'Pazienti', contabilita: 'Contabilità', ricevute: 'Ricevute', report: 'Report', impostazioni: 'Impostazioni' };
const BOTTOM_PRIMARY = ['dashboard', 'agenda', 'pazienti', 'contabilita'];
function injectSvgAssets() {
  document.querySelectorAll('[data-icon]').forEach(e => { const n = e.getAttribute('data-icon'); if (ICONS[n]) e.innerHTML = ICONS[n]; });
  document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
}
injectSvgAssets();

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401) { showLogin(); throw new Error('unauth'); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Errore'); }
  return res.status === 204 ? null : res.json();
}

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ============ Modal ============ */
function openModal(html, wide = false) {
  closeModal();
  const bg = el(`<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) closeModal(); });
  $('#modalRoot').appendChild(bg);
  const first = bg.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return bg;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* Conferma interna (sostituisce window.confirm, affidabile anche su mobile) */
function askConfirm(message, { okText = 'Elimina', cancelText = 'Annulla', danger = true } = {}) {
  return new Promise((resolve) => {
    const bg = el(`<div class="modal-bg confirm-bg"><div class="modal" style="max-width:400px">
      <h3>Conferma</h3>
      <p style="color:var(--ink-soft);margin:-2px 0 4px">${esc(message)}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-no>${esc(cancelText)}</button>
        <button class="btn ${danger ? 'danger' : ''}" data-yes>${esc(okText)}</button>
      </div></div></div>`);
    const done = (v) => { bg.remove(); resolve(v); };
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) done(false); });
    bg.querySelector('[data-no]').onclick = () => done(false);
    bg.querySelector('[data-yes]').onclick = () => done(true);
    $('#modalRoot').appendChild(bg);
    setTimeout(() => bg.querySelector('[data-yes]').focus(), 30);
  });
}

/* ============ Auth ============ */
async function checkAuth() {
  try { const r = await api('/me'); return r.auth; } catch { return false; }
}
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
async function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); await loadBase(); navigate('dashboard'); }

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    await api('/login', { method: 'POST', body: { password: $('#loginPassword').value } });
    showApp();
  } catch (err) {
    $('#loginError').textContent = 'Password errata. Riprova.';
  }
});
$('#logoutBtn').addEventListener('click', async () => { await api('/logout', { method: 'POST' }); showLogin(); });

/* ============ Navigation ============ */
const views = {};
let currentView = 'dashboard';
function navigate(view) {
  currentView = view;
  $('#nav').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const mt = $('#mTitle'); if (mt) mt.textContent = VIEW_TITLES[view] || 'Rehab';
  $('#bottomnav').querySelectorAll('button').forEach(b => {
    const isMore = b.dataset.nav === 'more';
    b.classList.toggle('active', isMore ? !BOTTOM_PRIMARY.includes(view) : b.dataset.view === view);
  });
  window.scrollTo({ top: 0 });
  (views[view] || views.dashboard)();
}
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]'); if (b) navigate(b.dataset.view);
});
$('#bottomnav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.nav === 'more') openMoreSheet(); else if (b.dataset.view) navigate(b.dataset.view);
});

/* Bottom sheet "Altro" (mobile) */
function openMoreSheet() {
  const items = [
    { view: 'ricevute', label: 'Ricevute', icon: 'ricevute' },
    { view: 'report', label: 'Report', icon: 'report' },
    { view: 'impostazioni', label: 'Impostazioni', icon: 'impostazioni' }
  ];
  const rows = items.map(i => `<button data-go="${i.view}"><span class="ic">${ICONS[i.icon]}</span>${i.label}</button>`).join('');
  const bg = el(`<div class="sheet-bg"><div class="sheet"><div class="handle"></div>${rows}
    <button class="danger" data-logout><span class="ic">${ICONS.esci}</span>Esci</button></div></div>`);
  bg.addEventListener('click', (e) => {
    if (e.target === bg) return bg.remove();
    const go = e.target.closest('[data-go]');
    if (go) { bg.remove(); navigate(go.dataset.go); return; }
    if (e.target.closest('[data-logout]')) { bg.remove(); doLogout(); }
  });
  $('#modalRoot').appendChild(bg);
}
async function doLogout() { await api('/logout', { method: 'POST' }); showLogin(); }

/* cache */
let PAZIENTI = [], LISTINO = [], IMPOST = {};
async function loadBase() {
  [PAZIENTI, LISTINO, IMPOST] = await Promise.all([api('/pazienti'), api('/listino'), api('/impostazioni')]);
}
const nomePaz = (id) => { const p = PAZIENTI.find(x => x.id === id); return p ? `${p.cognome} ${p.nome}` : '—'; };
function pazienteOptions(sel) {
  return `<option value="">— nessuno —</option>` + PAZIENTI.map(p => `<option value="${p.id}" ${p.id == sel ? 'selected' : ''}>${esc(p.cognome)} ${esc(p.nome)}</option>`).join('');
}

/* ============ DASHBOARD ============ */
views.dashboard = async () => {
  const m = $('#main');
  m.innerHTML = `<div class="topbar"><h2>Dashboard</h2><div class="muted" id="dataOggi"></div></div><div id="dashBody"><div class="empty">Caricamento…</div></div>`;
  const d = await api('/dashboard');
  $('#dataOggi').textContent = fmtGiorno(d.oggi);
  const saldo = d.entrateMese - d.usciteMese;
  const appHtml = d.appOggi.length ? d.appOggi.map(a => `
    <div class="appt">
      <div class="time">${esc(a.ora_inizio)}</div>
      <div class="who"><b>${a.paziente_id ? esc(a.p_cognome + ' ' + a.p_nome) : '<i>Senza paziente</i>'}</b><br><small>${esc(a.tipo_seduta || '')}${a.p_telefono ? ' · ' + esc(a.p_telefono) : ''}</small></div>
      <div>${statoBadge(a)}</div>
    </div>`).join('') : `<div class="empty">Nessun appuntamento per oggi</div>`;

  $('#dashBody').innerHTML = `
    <div class="grid cols-4" style="margin-bottom:16px">
      <div class="card stat"><div class="label">Appuntamenti oggi</div><div class="value">${d.appOggi.length}</div></div>
      <div class="card stat green"><div class="label">Entrate mese</div><div class="value">${eur(d.entrateMese)}</div></div>
      <div class="card stat red"><div class="label">Uscite mese</div><div class="value">${eur(d.usciteMese)}</div></div>
      <div class="card stat amber"><div class="label">Da incassare</div><div class="value">${eur(d.daIncassare)}</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <div class="topbar" style="margin-bottom:12px"><h3 style="margin:0">Agenda di oggi</h3><button class="btn sm" id="addApptToday">+ Appuntamento</button></div>
        ${appHtml}
      </div>
      <div class="card">
        <h3>Riepilogo mese</h3>
        <table>
          <tr><td>Pazienti totali</td><td style="text-align:right"><b>${d.nPazienti}</b></td></tr>
          <tr><td>Entrate</td><td style="text-align:right;color:var(--green)"><b>${eur(d.entrateMese)}</b></td></tr>
          <tr><td>Uscite</td><td style="text-align:right;color:var(--red)"><b>${eur(d.usciteMese)}</b></td></tr>
          <tr><td><b>Saldo</b></td><td style="text-align:right"><b>${eur(saldo)}</b></td></tr>
        </table>
      </div>
    </div>`;
  $('#addApptToday').onclick = () => apptModal({ data: d.oggi });
};

function statoBadge(a) {
  if (a.stato === 'annullato') return `<span class="badge b-ann">Annullato</span>`;
  if (a.stato === 'completato') return `<span class="badge b-ok">Completato</span>`;
  return `<span class="badge b-prog">Programmato</span>`;
}

/* ============ AGENDA ============ */
views.agenda = async () => {
  const m = $('#main');
  const oggi = todayISO();
  const dal = m.dataset.dal || oggi;
  const alDef = (() => { const d = new Date(dal + 'T00:00:00'); d.setDate(d.getDate() + 13); return d.toISOString().slice(0, 10); })();
  const al = m.dataset.al || alDef;
  m.innerHTML = `
    <div class="topbar"><h2>Agenda</h2><button class="btn" id="addAppt">+ Nuovo appuntamento</button></div>
    <div class="toolbar card">
      <label class="field" style="margin:0"><span>Dal</span><input type="date" id="fDal" value="${dal}"></label>
      <label class="field" style="margin:0"><span>Al</span><input type="date" id="fAl" value="${al}"></label>
      <button class="btn ghost sm" id="applyRange" style="align-self:flex-end">Aggiorna</button>
      <div class="grow"></div>
      <button class="btn ghost sm" id="todayBtn" style="align-self:flex-end">Oggi</button>
    </div>
    <div id="agendaBody"><div class="empty">Caricamento…</div></div>`;
  $('#addAppt').onclick = () => apptModal({ data: oggi });
  $('#applyRange').onclick = () => { m.dataset.dal = $('#fDal').value; m.dataset.al = $('#fAl').value; views.agenda(); };
  $('#todayBtn').onclick = () => { delete m.dataset.dal; delete m.dataset.al; views.agenda(); };

  const list = await api(`/appuntamenti?dal=${dal}&al=${al}`);
  const body = $('#agendaBody');
  if (!list.length) { body.innerHTML = `<div class="card empty">Nessun appuntamento nel periodo selezionato</div>`; return; }
  const byDay = {};
  list.forEach(a => { (byDay[a.data] = byDay[a.data] || []).push(a); });
  body.innerHTML = Object.keys(byDay).sort().map(day => `
    <div class="card" style="margin-bottom:14px">
      <div class="agenda-day">${fmtGiorno(day)}</div>
      ${byDay[day].map(a => apptRow(a)).join('')}
    </div>`).join('');
  body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const a = list.find(x => x.id == b.dataset.edit); apptModal(a); });
  body.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => incassaAppt(list.find(x => x.id == b.dataset.pay)));
};

/* --- Promemoria WhatsApp --- */
function waDigits(tel) {
  let d = (tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('39')) return d;
  if (d.length === 10 && d[0] === '3') return '39' + d;
  if (d[0] === '0') return '39' + d.replace(/^0+/, '');
  return d;
}
function promemoriaMsg(a) {
  const p = PAZIENTI.find(x => x.id === a.paziente_id);
  const nome = a.p_nome || (p ? (p.nome || '') : '');
  const link = location.origin + '/conferma/' + a.token;
  const studio = IMPOST.studio_nome || 'Rehab';
  return `Ciao ${nome}, ti ricordo l'appuntamento presso ${studio} di ${fmtData(a.data)} alle ${a.ora_inizio}.\nPuoi confermare qui: ${link}\nGrazie!`;
}
function waHref(a) {
  const d = waDigits(a.p_telefono || (PAZIENTI.find(x => x.id === a.paziente_id) || {}).telefono);
  const msg = encodeURIComponent(promemoriaMsg(a));
  return d ? `https://wa.me/${d}?text=${msg}` : `https://wa.me/?text=${msg}`;
}
function confermaBadge(a) {
  if (a.conferma === 'confermato') return '<span class="badge b-ok">Confermato ✓</span>';
  if (a.conferma === 'disdetto') return '<span class="badge b-ann">Disdetto</span>';
  return '<span class="badge b-nopay">Da confermare</span>';
}

function apptRow(a) {
  const pay = a.pagato ? `<span class="badge b-pay">Pagato</span>` :
    (a.stato !== 'annullato' ? `<button class="btn ghost sm" data-pay="${a.id}">Incassa</button>` : '');
  const attivo = a.paziente_id && a.stato !== 'annullato';
  const wa = attivo ? `<a class="btn ghost sm wa" target="_blank" rel="noopener" href="${waHref(a)}" title="Invia promemoria WhatsApp">Promemoria</a>` : '';
  const conf = attivo ? confermaBadge(a) : '';
  return `<div class="appt">
    <div class="time">${esc(a.ora_inizio)}${a.ora_fine ? '<br><small class="muted">' + esc(a.ora_fine) + '</small>' : ''}</div>
    <div class="who"><b>${a.paziente_id ? esc(a.p_cognome + ' ' + a.p_nome) : '<i>Senza paziente</i>'}</b><br>
      <small>${esc(a.tipo_seduta || '')}${a.prezzo ? ' · ' + eur(a.prezzo) : ''}${a.p_telefono ? ' · ' + esc(a.p_telefono) : ''}</small></div>
    <div class="appt-actions">${statoBadge(a)} ${conf} ${wa} ${pay}
      <button class="btn ghost sm" data-edit="${a.id}">Modifica</button></div>
  </div>`;
}

async function incassaAppt(a) {
  const html = `<h3>Incassa seduta</h3>
    <p class="muted">${esc(nomePaz(a.paziente_id))} · ${esc(a.tipo_seduta || '')} · <b>${eur(a.prezzo)}</b></p>
    <label class="field"><span>Metodo di pagamento</span>
      <select id="mMetodo"><option>contanti</option><option>carta</option><option>bonifico</option><option>altro</option></select></label>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Annulla</button><button class="btn" id="mOk">Conferma incasso</button></div>`;
  openModal(html);
  $('#mOk').onclick = async () => {
    await api(`/appuntamenti/${a.id}/incassa`, { method: 'POST', body: { metodo: $('#mMetodo').value } });
    closeModal(); toast('Incasso registrato'); navigate(currentView);
  };
}

function apptModal(a = {}) {
  const isEdit = !!a.id;
  const listinoOpts = LISTINO.map(l => `<option value="${esc(l.nome)}" data-prezzo="${l.prezzo}">${esc(l.nome)} (${eur(l.prezzo)})</option>`).join('');
  const html = `<h3>${isEdit ? 'Modifica' : 'Nuovo'} appuntamento</h3>
    <label class="field"><span>Paziente</span><select id="aPaz">${pazienteOptions(a.paziente_id)}</select></label>
    <div class="form-2">
      <label class="field"><span>Data</span><input type="date" id="aData" value="${a.data || todayISO()}"></label>
      <label class="field"><span>Tipo seduta</span><select id="aTipo"><option value="">—</option>${listinoOpts}</select></label>
      <label class="field"><span>Ora inizio</span><input type="time" id="aInizio" value="${a.ora_inizio || '09:00'}"></label>
      <label class="field"><span>Ora fine</span><input type="time" id="aFine" value="${a.ora_fine || ''}"></label>
      <label class="field"><span>Prezzo (€)</span><input type="number" step="0.01" id="aPrezzo" value="${a.prezzo || ''}"></label>
      <label class="field"><span>Stato</span><select id="aStato">
        <option value="programmato" ${a.stato === 'programmato' ? 'selected' : ''}>Programmato</option>
        <option value="completato" ${a.stato === 'completato' ? 'selected' : ''}>Completato</option>
        <option value="annullato" ${a.stato === 'annullato' ? 'selected' : ''}>Annullato</option>
      </select></label>
    </div>
    <label class="field"><span>Note</span><textarea id="aNote" rows="2">${esc(a.note || '')}</textarea></label>
    ${isEdit && a.paziente_id ? `<div class="appt-remind">
      <span>Conferma: ${confermaBadge(a)}</span>
      <a class="btn ghost sm wa" target="_blank" rel="noopener" href="${waHref(a)}">Invia promemoria WhatsApp</a>
    </div>` : ''}
    <div class="modal-actions">
      ${isEdit ? '<button class="btn danger" id="aDel" style="margin-right:auto">Elimina</button>' : ''}
      <button class="btn ghost" onclick="closeModal()">Annulla</button>
      <button class="btn" id="aOk">Salva</button>
    </div>`;
  openModal(html);
  if (a.tipo_seduta) $('#aTipo').value = a.tipo_seduta;
  $('#aTipo').onchange = (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt && opt.dataset.prezzo && !$('#aPrezzo').value) $('#aPrezzo').value = opt.dataset.prezzo;
  };
  $('#aOk').onclick = async () => {
    const body = {
      paziente_id: $('#aPaz').value || null, data: $('#aData').value, ora_inizio: $('#aInizio').value,
      ora_fine: $('#aFine').value, tipo_seduta: $('#aTipo').value, prezzo: parseFloat($('#aPrezzo').value) || 0,
      stato: $('#aStato').value, note: $('#aNote').value
    };
    if (!body.data || !body.ora_inizio) { toast('Data e ora sono obbligatorie'); return; }
    if (isEdit) await api('/appuntamenti/' + a.id, { method: 'PUT', body });
    else await api('/appuntamenti', { method: 'POST', body });
    closeModal(); toast('Appuntamento salvato'); navigate(currentView);
  };
  if (isEdit) $('#aDel').onclick = async () => {
    if (!await askConfirm('Vuoi eliminare questo appuntamento?')) return;
    await api('/appuntamenti/' + a.id, { method: 'DELETE' }); closeModal(); toast('Eliminato'); navigate(currentView);
  };
}

/* ============ PAZIENTI ============ */
views.pazienti = async () => {
  const m = $('#main');
  m.innerHTML = `
    <div class="topbar"><h2>Pazienti</h2><button class="btn" id="addPaz">+ Nuovo paziente</button></div>
    <div class="toolbar card"><input type="text" id="qPaz" placeholder="Cerca per nome, telefono, email…" class="grow"></div>
    <div class="card table-wrap"><table><thead><tr><th>Cognome e nome</th><th>Telefono</th><th>Email</th><th></th></tr></thead><tbody id="pazBody"></tbody></table></div>`;
  const render = async () => {
    const q = $('#qPaz').value.trim();
    const list = await api('/pazienti' + (q ? '?q=' + encodeURIComponent(q) : ''));
    const b = $('#pazBody');
    if (!list.length) { b.innerHTML = `<tr><td colspan="4" class="empty">Nessun paziente</td></tr>`; return; }
    b.innerHTML = list.map(p => `<tr>
      <td><b>${esc(p.cognome)} ${esc(p.nome)}</b></td><td>${esc(p.telefono || '')}</td><td>${esc(p.email || '')}</td>
      <td class="row-actions" style="justify-content:flex-end">
        <button class="btn ghost sm" data-open="${p.id}">Scheda</button>
        <button class="btn ghost sm" data-edit="${p.id}">Modifica</button></td></tr>`).join('');
    b.querySelectorAll('[data-open]').forEach(x => x.onclick = () => schedaPaziente(x.dataset.open));
    b.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => pazModal(list.find(p => p.id == x.dataset.edit)));
  };
  let t; $('#qPaz').oninput = () => { clearTimeout(t); t = setTimeout(render, 250); };
  $('#addPaz').onclick = () => pazModal({});
  render();
};

function pazModal(p = {}) {
  const isEdit = !!p.id;
  const html = `<h3>${isEdit ? 'Modifica' : 'Nuovo'} paziente</h3>
    <div class="form-2">
      <label class="field"><span>Nome</span><input id="pNome" value="${esc(p.nome || '')}"></label>
      <label class="field"><span>Cognome</span><input id="pCognome" value="${esc(p.cognome || '')}"></label>
      <label class="field"><span>Telefono</span><input id="pTel" value="${esc(p.telefono || '')}"></label>
      <label class="field"><span>Email</span><input id="pEmail" value="${esc(p.email || '')}"></label>
      <label class="field"><span>Data di nascita</span><input type="date" id="pNascita" value="${esc(p.data_nascita || '')}"></label>
      <label class="field"><span>Codice fiscale</span><input id="pCf" value="${esc(p.codice_fiscale || '')}"></label>
    </div>
    <label class="field"><span>Indirizzo</span><input id="pIndir" value="${esc(p.indirizzo || '')}"></label>
    <label class="field"><span>Note (anamnesi, obiettivi…)</span><textarea id="pNote" rows="3">${esc(p.note || '')}</textarea></label>
    <div class="modal-actions">
      ${isEdit ? '<button class="btn danger" id="pDel" style="margin-right:auto">Elimina</button>' : ''}
      <button class="btn ghost" onclick="closeModal()">Annulla</button><button class="btn" id="pOk">Salva</button></div>`;
  openModal(html, true);
  $('#pOk').onclick = async () => {
    const body = {
      nome: $('#pNome').value, cognome: $('#pCognome').value, telefono: $('#pTel').value, email: $('#pEmail').value,
      data_nascita: $('#pNascita').value, codice_fiscale: $('#pCf').value, indirizzo: $('#pIndir').value, note: $('#pNote').value
    };
    if (!body.nome && !body.cognome) { toast('Inserisci almeno nome o cognome'); return; }
    if (isEdit) await api('/pazienti/' + p.id, { method: 'PUT', body });
    else await api('/pazienti', { method: 'POST', body });
    await loadBase(); closeModal(); toast('Paziente salvato'); navigate(currentView);
  };
  if (isEdit) $('#pDel').onclick = async () => {
    if (!await askConfirm('Eliminare il paziente? Gli appuntamenti resteranno senza paziente associato.')) return;
    await api('/pazienti/' + p.id, { method: 'DELETE' }); await loadBase(); closeModal(); toast('Eliminato'); navigate(currentView);
  };
}

async function schedaPaziente(id) {
  const p = await api('/pazienti/' + id);
  const eta = p.data_nascita ? Math.floor((Date.now() - new Date(p.data_nascita)) / 31557600000) + ' anni' : '';
  const appts = p.appuntamenti.map(a => `<tr><td>${fmtData(a.data)} ${esc(a.ora_inizio)}</td><td>${esc(a.tipo_seduta || '')}</td><td>${eur(a.prezzo)}</td><td>${statoBadge(a)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty">Nessun appuntamento</td></tr>`;
  const mov = p.movimenti.map(mv => `<tr><td>${fmtData(mv.data)}</td><td>${esc(mv.descrizione || mv.categoria || '')}</td><td style="color:${mv.tipo === 'entrata' ? 'var(--green)' : 'var(--red)'}">${mv.tipo === 'entrata' ? '+' : '−'}${eur(mv.importo)}</td></tr>`).join('') || `<tr><td colspan="3" class="empty">Nessun movimento</td></tr>`;
  const html = `<h3>${esc(p.cognome)} ${esc(p.nome)}</h3>
    <p class="muted">${[p.telefono, p.email, eta].filter(Boolean).map(esc).join(' · ')}</p>
    ${p.codice_fiscale ? `<p class="muted" style="margin-top:-6px">CF: ${esc(p.codice_fiscale)}${p.indirizzo ? ' · ' + esc(p.indirizzo) : ''}</p>` : ''}
    ${p.note ? `<div class="card" style="background:var(--bg);margin-bottom:14px"><b>Note</b><br>${esc(p.note).replace(/\n/g, '<br>')}</div>` : ''}
    <h4 style="margin:16px 0 6px">Storico appuntamenti</h4>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Prezzo</th><th>Stato</th></tr></thead><tbody>${appts}</tbody></table></div>
    <h4 style="margin:18px 0 6px">Pagamenti</h4>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th>Descrizione</th><th>Importo</th></tr></thead><tbody>${mov}</tbody></table></div>
    <div class="modal-actions">
      <button class="btn ghost" id="scNew" style="margin-right:auto">+ Appuntamento</button>
      <button class="btn ghost" id="scRic">Crea ricevuta</button>
      <button class="btn" onclick="closeModal()">Chiudi</button></div>`;
  openModal(html, true);
  $('#scNew').onclick = () => apptModal({ paziente_id: p.id, data: todayISO() });
  $('#scRic').onclick = () => ricevutaModal({ paziente_id: p.id });
}

/* ============ CONTABILITA ============ */
views.contabilita = async () => {
  const m = $('#main');
  const oggi = todayISO();
  const dal = m.dataset.dal || (oggi.slice(0, 7) + '-01');
  const al = m.dataset.al || oggi;
  m.innerHTML = `
    <div class="topbar"><h2>Contabilità</h2>
      <div style="display:flex;gap:8px"><button class="btn ghost" id="addUscita">+ Spesa</button><button class="btn" id="addEntrata">+ Entrata</button></div></div>
    <div class="toolbar card">
      <label class="field" style="margin:0"><span>Dal</span><input type="date" id="cDal" value="${dal}"></label>
      <label class="field" style="margin:0"><span>Al</span><input type="date" id="cAl" value="${al}"></label>
      <select id="cTipo" style="align-self:flex-end;width:auto"><option value="">Tutti</option><option value="entrata">Solo entrate</option><option value="uscita">Solo uscite</option></select>
      <button class="btn ghost sm" id="cApply" style="align-self:flex-end">Aggiorna</button>
      <div class="grow"></div>
      <button class="btn ghost sm" id="cListino" style="align-self:flex-end">Gestisci listino</button>
    </div>
    <div class="grid cols-3" style="margin-bottom:16px" id="cStat"></div>
    <div class="card table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrizione</th><th>Paziente</th><th>Metodo</th><th style="text-align:right">Importo</th><th></th></tr></thead><tbody id="cBody"></tbody></table></div>`;
  $('#addEntrata').onclick = () => movModal({ tipo: 'entrata' });
  $('#addUscita').onclick = () => movModal({ tipo: 'uscita' });
  $('#cListino').onclick = () => listinoModal();
  $('#cApply').onclick = () => { m.dataset.dal = $('#cDal').value; m.dataset.al = $('#cAl').value; m.dataset.tipo = $('#cTipo').value; views.contabilita(); };
  if (m.dataset.tipo) $('#cTipo').value = m.dataset.tipo;

  const q = `?dal=${dal}&al=${al}` + (m.dataset.tipo ? '&tipo=' + m.dataset.tipo : '');
  const list = await api('/movimenti' + q);
  const entrate = list.filter(x => x.tipo === 'entrata').reduce((s, x) => s + x.importo, 0);
  const uscite = list.filter(x => x.tipo === 'uscita').reduce((s, x) => s + x.importo, 0);
  $('#cStat').innerHTML = `
    <div class="card stat green"><div class="label">Entrate periodo</div><div class="value">${eur(entrate)}</div></div>
    <div class="card stat red"><div class="label">Uscite periodo</div><div class="value">${eur(uscite)}</div></div>
    <div class="card stat"><div class="label">Saldo</div><div class="value">${eur(entrate - uscite)}</div></div>`;
  const b = $('#cBody');
  if (!list.length) { b.innerHTML = `<tr><td colspan="7" class="empty">Nessun movimento nel periodo</td></tr>`; return; }
  b.innerHTML = list.map(mv => `<tr>
    <td>${fmtData(mv.data)}</td>
    <td><span class="badge ${mv.tipo === 'entrata' ? 'b-in' : 'b-out'}">${mv.tipo === 'entrata' ? 'Entrata' : 'Uscita'}</span></td>
    <td>${esc(mv.descrizione || mv.categoria || '')}${mv.categoria && mv.descrizione ? ' <small class="muted">(' + esc(mv.categoria) + ')</small>' : ''}</td>
    <td>${mv.paziente_id ? esc(mv.p_cognome + ' ' + mv.p_nome) : ''}</td>
    <td>${esc(mv.metodo || '')}</td>
    <td style="text-align:right;color:${mv.tipo === 'entrata' ? 'var(--green)' : 'var(--red)'}"><b>${mv.tipo === 'entrata' ? '+' : '−'}${eur(mv.importo)}</b></td>
    <td><button class="btn ghost sm" data-edit="${mv.id}">✎</button></td></tr>`).join('');
  b.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => movModal(list.find(mv => mv.id == x.dataset.edit)));
};

function movModal(mv = {}) {
  const isEdit = !!mv.id;
  const isEntrata = (mv.tipo || 'entrata') === 'entrata';
  const cats = isEntrata ? ['Seduta', 'Ricevuta', 'Pacchetto', 'Altro'] : ['Affitto', 'Utenze', 'Materiali', 'Formazione', 'Tasse', 'Altro'];
  const html = `<h3>${isEdit ? 'Modifica' : 'Nuovo/a'} ${isEntrata ? 'entrata' : 'spesa'}</h3>
    <div class="form-2">
      <label class="field"><span>Data</span><input type="date" id="mData" value="${mv.data || todayISO()}"></label>
      <label class="field"><span>Importo (€)</span><input type="number" step="0.01" id="mImporto" value="${mv.importo || ''}"></label>
      <label class="field"><span>Categoria</span><select id="mCat">${cats.map(c => `<option ${mv.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="field"><span>Metodo</span><select id="mMet"><option value="">—</option>${['contanti', 'carta', 'bonifico', 'altro'].map(x => `<option ${mv.metodo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Descrizione</span><input id="mDesc" value="${esc(mv.descrizione || '')}"></label>
    ${isEntrata ? `<label class="field"><span>Paziente (facoltativo)</span><select id="mPaz">${pazienteOptions(mv.paziente_id)}</select></label>` : ''}
    <div class="modal-actions">
      ${isEdit ? '<button class="btn danger" id="mDel" style="margin-right:auto">Elimina</button>' : ''}
      <button class="btn ghost" onclick="closeModal()">Annulla</button><button class="btn" id="mOk">Salva</button></div>`;
  openModal(html);
  $('#mOk').onclick = async () => {
    const body = {
      data: $('#mData').value, tipo: mv.tipo || 'entrata', categoria: $('#mCat').value, descrizione: $('#mDesc').value,
      importo: parseFloat($('#mImporto').value) || 0, metodo: $('#mMet').value,
      paziente_id: isEntrata ? ($('#mPaz').value || null) : null
    };
    if (!body.data || !body.importo) { toast('Data e importo sono obbligatori'); return; }
    if (isEdit) await api('/movimenti/' + mv.id, { method: 'PUT', body });
    else await api('/movimenti', { method: 'POST', body });
    closeModal(); toast('Movimento salvato'); navigate(currentView);
  };
  if (isEdit) $('#mDel').onclick = async () => {
    if (!await askConfirm('Eliminare questo movimento?')) return;
    await api('/movimenti/' + mv.id, { method: 'DELETE' }); closeModal(); toast('Eliminato'); navigate(currentView);
  };
}

/* ============ LISTINO ============ */
async function listinoModal() {
  LISTINO = await api('/listino');
  const rows = LISTINO.map(l => `<tr>
    <td>${esc(l.nome)}</td><td>${l.durata_min}′</td><td>${eur(l.prezzo)}</td>
    <td class="row-actions" style="justify-content:flex-end"><button class="btn ghost sm" data-edit="${l.id}">✎</button><button class="btn ghost sm" data-del="${l.id}">🗑</button></td></tr>`).join('') || `<tr><td colspan="4" class="empty">Nessuna voce</td></tr>`;
  const html = `<h3>Listino sedute</h3>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Durata</th><th>Prezzo</th><th></th></tr></thead><tbody id="lBody">${rows}</tbody></table></div>
    <div class="modal-actions"><button class="btn ghost" id="lAdd" style="margin-right:auto">+ Aggiungi voce</button><button class="btn" onclick="closeModal()">Chiudi</button></div>`;
  openModal(html, true);
  const bind = () => {
    $('#lBody').querySelectorAll('[data-edit]').forEach(x => x.onclick = () => listinoEdit(LISTINO.find(l => l.id == x.dataset.edit)));
    $('#lBody').querySelectorAll('[data-del]').forEach(x => x.onclick = async () => {
      if (!await askConfirm('Eliminare questa voce di listino?')) return;
      await api('/listino/' + x.dataset.del, { method: 'DELETE' }); await loadBase(); listinoModal();
    });
  };
  bind();
  $('#lAdd').onclick = () => listinoEdit({});
}
function listinoEdit(l = {}) {
  const html = `<h3>${l.id ? 'Modifica' : 'Nuova'} voce di listino</h3>
    <label class="field"><span>Nome</span><input id="lNome" value="${esc(l.nome || '')}"></label>
    <div class="form-2">
      <label class="field"><span>Durata (min)</span><input type="number" id="lDur" value="${l.durata_min || 60}"></label>
      <label class="field"><span>Prezzo (€)</span><input type="number" step="0.01" id="lPrezzo" value="${l.prezzo || ''}"></label>
    </div>
    <div class="modal-actions"><button class="btn ghost" id="lBack">Indietro</button><button class="btn" id="lOk">Salva</button></div>`;
  openModal(html);
  $('#lBack').onclick = () => listinoModal();
  $('#lOk').onclick = async () => {
    const body = { nome: $('#lNome').value, durata_min: parseInt($('#lDur').value) || 60, prezzo: parseFloat($('#lPrezzo').value) || 0 };
    if (!body.nome) { toast('Inserisci il nome'); return; }
    if (l.id) await api('/listino/' + l.id, { method: 'PUT', body });
    else await api('/listino', { method: 'POST', body });
    await loadBase(); listinoModal();
  };
}

/* ============ RICEVUTE ============ */
views.ricevute = async () => {
  const m = $('#main');
  m.innerHTML = `<div class="topbar"><h2>Ricevute</h2><button class="btn" id="addRic">+ Nuova ricevuta</button></div>
    <div class="card table-wrap"><table><thead><tr><th>Numero</th><th>Data</th><th>Paziente</th><th>Descrizione</th><th style="text-align:right">Importo</th><th></th></tr></thead><tbody id="rBody"></tbody></table></div>`;
  $('#addRic').onclick = () => ricevutaModal({});
  const list = await api('/ricevute');
  const b = $('#rBody');
  if (!list.length) { b.innerHTML = `<tr><td colspan="6" class="empty">Nessuna ricevuta emessa</td></tr>`; return; }
  b.innerHTML = list.map(r => `<tr>
    <td><b>${r.numero}/${r.anno}</b></td><td>${fmtData(r.data)}</td>
    <td>${r.paziente_id ? esc(r.p_cognome + ' ' + r.p_nome) : '—'}</td><td>${esc(r.descrizione || '')}</td>
    <td style="text-align:right"><b>${eur(r.importo)}</b></td>
    <td class="row-actions" style="justify-content:flex-end"><button class="btn ghost sm" data-print="${r.id}">Stampa</button><button class="btn ghost sm" data-del="${r.id}">🗑</button></td></tr>`).join('');
  b.querySelectorAll('[data-print]').forEach(x => x.onclick = () => stampaRicevuta(list.find(r => r.id == x.dataset.print)));
  b.querySelectorAll('[data-del]').forEach(x => x.onclick = async () => {
    if (!await askConfirm('Eliminare la ricevuta? (il movimento contabile collegato resta)')) return;
    await api('/ricevute/' + x.dataset.del, { method: 'DELETE' }); toast('Eliminata'); views.ricevute();
  });
};

function ricevutaModal(r = {}) {
  const html = `<h3>Nuova ricevuta</h3>
    <label class="field"><span>Paziente</span><select id="rPaz">${pazienteOptions(r.paziente_id)}</select></label>
    <div class="form-2">
      <label class="field"><span>Data</span><input type="date" id="rData" value="${todayISO()}"></label>
      <label class="field"><span>Importo (€)</span><input type="number" step="0.01" id="rImporto" value="${r.importo || ''}"></label>
    </div>
    <label class="field"><span>Descrizione prestazione</span><input id="rDesc" value="${esc(r.descrizione || 'Seduta di chinesiologia')}"></label>
    <label class="field"><span>Metodo di pagamento</span><select id="rMet">${['contanti', 'carta', 'bonifico', 'altro'].map(x => `<option>${x}</option>`).join('')}</select></label>
    <label class="field" style="display:flex;gap:8px;align-items:center;flex-direction:row"><input type="checkbox" id="rMov" checked style="width:auto"><span style="margin:0">Registra automaticamente l'entrata in contabilità</span></label>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Annulla</button><button class="btn" id="rOk">Crea e stampa</button></div>`;
  openModal(html);
  $('#rOk').onclick = async () => {
    const body = {
      paziente_id: $('#rPaz').value || null, data: $('#rData').value, importo: parseFloat($('#rImporto').value) || 0,
      descrizione: $('#rDesc').value, metodo: $('#rMet').value, registra_movimento: $('#rMov').checked
    };
    if (!body.importo) { toast('Inserisci l\'importo'); return; }
    const res = await api('/ricevute', { method: 'POST', body });
    const full = await api('/ricevute/' + res.id);
    closeModal(); toast('Ricevuta creata'); stampaRicevuta(full); if (currentView === 'ricevute') views.ricevute();
  };
}

function stampaRicevuta(r) {
  const s = IMPOST;
  const paz = r.paziente_id ? `${r.p_cognome} ${r.p_nome}` : '________________________';
  const w = window.open('', '_blank', 'width=800,height=900');
  w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Ricevuta ${r.numero}/${r.anno}</title>
  <style>
    body{font-family:Georgia,'Times New Roman',serif;color:#24313f;max-width:720px;margin:40px auto;padding:0 30px;}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2f8fb3;padding-bottom:16px;margin-bottom:26px;}
    .brandrow{display:flex;align-items:center;gap:12px;margin-bottom:6px;}
    .logo-tile{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#3aa0c4,#26788f);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .logo-tile svg{width:30px;height:30px;}
    .studio b{font-size:22px;color:#26788f;letter-spacing:-0.02em;} .studio small{color:#6b7c8f;display:block;line-height:1.5;}
    .doc-title{text-align:right;} .doc-title h1{font-size:20px;margin:0;} .doc-title .num{font-size:15px;color:#6b7c8f;}
    .row{display:flex;justify-content:space-between;margin:6px 0;}
    .box{border:1px solid #e4ebf2;border-radius:10px;padding:14px 18px;margin:18px 0;}
    table{width:100%;border-collapse:collapse;margin:22px 0;}
    th,td{padding:11px 8px;border-bottom:1px solid #e4ebf2;text-align:left;}
    th{color:#6b7c8f;font-size:13px;text-transform:uppercase;}
    .tot{text-align:right;font-size:20px;margin-top:8px;}
    .note{color:#6b7c8f;font-size:12.5px;margin-top:40px;border-top:1px solid #e4ebf2;padding-top:12px;}
    .firma{margin-top:56px;text-align:right;color:#6b7c8f;}
    @media print{body{margin:0;padding:20px;} .noprint{display:none;}}
  </style></head><body>
    <div class="head">
      <div class="studio">
        <div class="brandrow"><div class="logo-tile">${LOGO_SVG}</div><b>${esc(s.studio_nome || 'Rehab')}</b></div>
        <small>${esc(s.studio_sottotitolo || '')}</small>
        <small>${esc(s.studio_indirizzo || '')}</small>
        ${s.studio_telefono ? `<small>Tel. ${esc(s.studio_telefono)}</small>` : ''}
        ${s.studio_partitaiva ? `<small>P.IVA ${esc(s.studio_partitaiva)}</small>` : ''}
        ${s.studio_codicefiscale ? `<small>C.F. ${esc(s.studio_codicefiscale)}</small>` : ''}
      </div>
      <div class="doc-title"><h1>RICEVUTA</h1><div class="num">n. ${r.numero}/${r.anno}</div><div class="num">${fmtData(r.data)}</div></div>
    </div>
    <div class="box">
      <div class="row"><span><b>Ricevuto da:</b> ${esc(paz)}</span></div>
      ${r.p_cf ? `<div class="row"><span>C.F.: ${esc(r.p_cf)}</span></div>` : ''}
      ${r.p_indirizzo ? `<div class="row"><span>${esc(r.p_indirizzo)}</span></div>` : ''}
    </div>
    <table><thead><tr><th>Descrizione</th><th style="text-align:right">Importo</th></tr></thead>
      <tbody><tr><td>${esc(r.descrizione || 'Prestazione')}</td><td style="text-align:right">${eur(r.importo)}</td></tr></tbody></table>
    <div class="tot"><b>Totale: ${eur(r.importo)}</b></div>
    ${r.metodo ? `<div class="row" style="justify-content:flex-end;color:#6b7c8f">Pagamento: ${esc(r.metodo)}</div>` : ''}
    <div class="firma">Firma _______________________</div>
    <div class="note">${esc(s.ricevuta_note || '')}</div>
    <div class="noprint" style="text-align:center;margin-top:30px"><button onclick="window.print()" style="padding:10px 22px;font-size:15px;background:#2f8fb3;color:#fff;border:none;border-radius:8px;cursor:pointer">Stampa / Salva PDF</button></div>
  </body></html>`);
  w.document.close();
}

/* ============ REPORT ============ */
let chartRefs = [];
views.report = async () => {
  const m = $('#main');
  const annoCorr = new Date().getFullYear();
  const anno = m.dataset.anno || String(annoCorr);
  const anni = []; for (let y = annoCorr; y >= annoCorr - 4; y--) anni.push(y);
  m.innerHTML = `<div class="topbar"><h2>Report</h2>
    <select id="repAnno" style="width:auto">${anni.map(y => `<option ${y == anno ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
    <div class="grid cols-3" style="margin-bottom:16px" id="repStat"></div>
    <div class="grid cols-2">
      <div class="card"><h3>Entrate e uscite per mese</h3><div class="chart-box"><canvas id="chMesi"></canvas></div></div>
      <div class="card"><h3>Sedute completate per mese</h3><div class="chart-box"><canvas id="chSedute"></canvas></div></div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Uscite per categoria</h3><div class="chart-box"><canvas id="chCat"></canvas></div></div>`;
  $('#repAnno').onchange = (e) => { m.dataset.anno = e.target.value; views.report(); };

  const d = await api('/report?anno=' + anno);
  $('#repStat').innerHTML = `
    <div class="card stat green"><div class="label">Entrate ${anno}</div><div class="value">${eur(d.totEntrate)}</div></div>
    <div class="card stat red"><div class="label">Uscite ${anno}</div><div class="value">${eur(d.totUscite)}</div></div>
    <div class="card stat"><div class="label">Saldo ${anno}</div><div class="value">${eur(d.totEntrate - d.totUscite)}</div></div>`;

  chartRefs.forEach(c => c.destroy()); chartRefs = [];
  const mesiLabel = Array.from({ length: 12 }, (_, i) => MESI[i]);
  const entrateArr = Array(12).fill(0), usciteArr = Array(12).fill(0), seduteArr = Array(12).fill(0);
  d.mesi.forEach(x => { const i = parseInt(x.mese.slice(5, 7)) - 1; entrateArr[i] = x.entrate; usciteArr[i] = x.uscite; });
  d.sedute.forEach(x => { const i = parseInt(x.mese.slice(5, 7)) - 1; seduteArr[i] = x.n; });

  const grid = { grid: { color: '#eef3f8' } };
  chartRefs.push(new Chart($('#chMesi'), {
    type: 'bar',
    data: { labels: mesiLabel, datasets: [
      { label: 'Entrate', data: entrateArr, backgroundColor: '#34a780', borderRadius: 6 },
      { label: 'Uscite', data: usciteArr, backgroundColor: '#e07567', borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ...grid }, x: grid } }
  }));
  chartRefs.push(new Chart($('#chSedute'), {
    type: 'line',
    data: { labels: mesiLabel, datasets: [{ label: 'Sedute', data: seduteArr, borderColor: '#2f8fb3', backgroundColor: 'rgba(47,143,179,.15)', fill: true, tension: .35, pointBackgroundColor: '#2f8fb3' }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ...grid }, x: grid } }
  }));
  const catUscite = d.perCategoria.filter(x => x.tipo === 'uscita');
  chartRefs.push(new Chart($('#chCat'), {
    type: 'doughnut',
    data: { labels: catUscite.map(x => x.categoria || 'Altro'), datasets: [{ data: catUscite.map(x => x.totale), backgroundColor: ['#e07567', '#dda14f', '#2f8fb3', '#34a780', '#8a86cf', '#7d8ea0', '#c47ca0'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  }));
};

/* ============ IMPOSTAZIONI ============ */
views.impostazioni = async () => {
  const m = $('#main');
  const s = await api('/impostazioni');
  const calUrl = s.calendar_token ? location.origin + '/calendar/' + s.calendar_token + '/rehab.ics' : '';
  const f = (k, lbl) => `<label class="field"><span>${lbl}</span><input id="s_${k}" value="${esc(s[k] || '')}"></label>`;
  m.innerHTML = `<div class="topbar"><h2>Impostazioni</h2></div>
    <div class="card" style="max-width:640px">
      <h3>Dati dello studio</h3>
      <p class="muted" style="margin-top:-4px">Compaiono in intestazione alle ricevute.</p>
      <div class="form-2">
        ${f('studio_nome', 'Nome studio')}${f('studio_sottotitolo', 'Sottotitolo')}
        ${f('studio_telefono', 'Telefono')}${f('studio_email', 'Email')}
        ${f('studio_partitaiva', 'Partita IVA')}${f('studio_codicefiscale', 'Codice fiscale')}
      </div>
      ${f('studio_indirizzo', 'Indirizzo')}
      <label class="field"><span>Nota a piè di ricevuta</span><textarea id="s_ricevuta_note" rows="2">${esc(s.ricevuta_note || '')}</textarea></label>
      <div class="modal-actions"><button class="btn" id="sSave">Salva impostazioni</button></div>
    </div>

    <div class="card" style="max-width:640px;margin-top:16px">
      <h3>Sincronizza con Google Calendar</h3>
      <p class="muted" style="margin-top:-4px">Aggiungi questo link una volta sola: i tuoi appuntamenti compariranno automaticamente in Google Calendar (e Apple/Outlook) su tutti i dispositivi.</p>
      <label class="field"><span>Link di abbonamento (privato — non condividerlo)</span>
        <input id="calUrl" readonly value="${esc(calUrl)}" onclick="this.select()"></label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn ghost sm" id="calCopy">Copia link</button>
        <a class="btn ghost sm" href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noopener">Apri Google Calendar</a>
      </div>
      <div style="background:var(--primary-softer);border:1px solid var(--primary-soft);border-radius:12px;padding:13px 15px;font-size:13.5px;color:var(--ink-soft);line-height:1.6">
        <b>Come fare (da computer):</b> apri Google Calendar → nella colonna a sinistra, accanto a "Altri calendari" tocca <b>+</b> → <b>Da URL</b> → incolla il link → <b>Aggiungi calendario</b>.<br>
        <span class="muted">Google aggiorna i calendari in abbonamento ogni qualche ora, quindi le modifiche possono comparire con un piccolo ritardo. Gli appuntamenti si creano e si gestiscono qui nell'app.</span>
      </div>
    </div>`;
  $('#sSave').onclick = async () => {
    const keys = ['studio_nome', 'studio_sottotitolo', 'studio_telefono', 'studio_email', 'studio_partitaiva', 'studio_codicefiscale', 'studio_indirizzo', 'ricevuta_note'];
    const body = {}; keys.forEach(k => body[k] = $('#s_' + k).value);
    await api('/impostazioni', { method: 'PUT', body });
    IMPOST = await api('/impostazioni'); toast('Impostazioni salvate');
  };
  $('#calCopy').onclick = async () => {
    const inp = $('#calUrl'); inp.select();
    try { await navigator.clipboard.writeText(inp.value); } catch { try { document.execCommand('copy'); } catch (e) {} }
    toast('Link copiato');
  };
};

/* ============ Boot ============ */
(async function boot() {
  if (await checkAuth()) { await loadBase(); showApp(); }
  else showLogin();
})();
