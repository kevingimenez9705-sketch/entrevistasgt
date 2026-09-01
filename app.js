const SEDES = ['Florida', 'Merlo', 'Adrogué'];
const HORARIOS = ['9 a 13hs', '14 a 18hs', '9 a 18hs'];
const CUPO_POR_SEDE_Y_FECHA = 3;
const STORAGE_KEY = 'turnos-seleccion:turnos-cache';

const CONFIG = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};
const MODO_LOCAL = !CONFIG.SHEETS_WEB_APP_URL;

const state = {
  sede: null,
  fecha: null,
  mesActual: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  turnos: [],
  cargando: false,
};

let chartEstados = null;
let chartSedes = null;

// --- Estado de sincronización ---

function setSyncStatus(kind, label) {
  const el = document.getElementById('sync-status');
  const lbl = document.getElementById('sync-status-label');
  el.className = `sync-status is-${kind}`;
  lbl.textContent = label;
}

// --- Almacenamiento (cache local + backend en Sheets vía n8n) ---

function cargarCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('No se pudo leer la cache local:', err.message);
    return [];
  }
}

function guardarCache(turnos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(turnos));
  } catch (err) {
    console.error('No se pudo guardar la cache local:', err.message);
  }
}

function normalizarTurno(raw) {
  return {
    id: String(raw.id ?? raw.ID ?? ''),
    nombre: raw.nombre ?? raw.Nombre ?? '',
    apellido: raw.apellido ?? raw.Apellido ?? '',
    mail: raw.mail ?? raw.Mail ?? raw['Mail corporativo'] ?? '',
    celular: raw.celular ?? raw.Celular ?? '',
    sede: raw.sede ?? raw.Sede ?? '',
    fecha: raw.fecha ?? raw.Fecha ?? '',
    horario: raw.horario ?? raw.Horario ?? '',
    estado: raw.estado ?? raw.Estado ?? 'Postulado',
    creadoEn: raw.creadoEn ?? raw['Creado el'] ?? new Date().toISOString(),
  };
}

async function obtenerTurnos({ silencioso = false } = {}) {
  if (MODO_LOCAL) {
    state.turnos = cargarCache();
    setSyncStatus('error', 'Modo local (sin Google Sheets)');
    return state.turnos;
  }

  if (!silencioso) setSyncStatus('loading', 'Sincronizando…');
  try {
    const url = `${CONFIG.SHEETS_WEB_APP_URL}?action=listar`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lista = Array.isArray(data) ? data : (data.turnos || []);
    state.turnos = lista.map(normalizarTurno);
    guardarCache(state.turnos);
    setSyncStatus('ok', 'Sincronizado con Google Sheets');
  } catch (err) {
    console.error('No se pudo leer la hoja de cálculo:', err.message);
    state.turnos = cargarCache();
    setSyncStatus('error', 'Sin conexión — mostrando última copia');
  }
  return state.turnos;
}

async function crearTurnoRemoto(turno) {
  if (MODO_LOCAL) {
    state.turnos.push(turno);
    guardarCache(state.turnos);
    return { ok: true };
  }
  try {
    // Sin header Content-Type: así el POST queda como "simple request" y
    // Apps Script lo puede recibir sin problemas de CORS (no soporta preflight OPTIONS).
    const res = await fetch(CONFIG.SHEETS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'crear', turno }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');
    state.turnos.push(turno);
    guardarCache(state.turnos);
    return { ok: true };
  } catch (err) {
    console.error('No se pudo guardar el turno en Sheets:', err.message);
    return { ok: false, error: err.message };
  }
}

function generarId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// --- Helpers ---

function sedeSlug(s) {
  return { 'Florida': 'florida', 'Merlo': 'merlo', 'Adrogué': 'adrogue' }[s] || '';
}

function estadoSlug(s) {
  return { 'Postulado': 'postulado', 'Presente': 'presente', 'Ausente': 'ausente', 'Cancelado': 'cancelado' }[s] || '';
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function esFinDeSemana(d) {
  const day = d.getDay(); // 0 domingo, 6 sábado
  return day === 0 || day === 6;
}

function contarOcupados(turnos, sede, fecha) {
  return turnos.filter((t) => t.sede === sede && t.fecha === fecha && t.estado !== 'Cancelado').length;
}

// --- Tabs ---

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', async () => {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');

    document.querySelectorAll('.view').forEach((v) => v.classList.remove('is-active'));
    document.getElementById(`view-${tab.dataset.view}`).classList.add('is-active');

    if (tab.dataset.view === 'panel') {
      await obtenerTurnos();
      renderPanel();
    }
  });
});

document.getElementById('btn-refrescar').addEventListener('click', async () => {
  await obtenerTurnos();
  renderPanel();
});

// --- Selección de sede ---

document.querySelectorAll('.sede-chip').forEach((chip) => {
  chip.addEventListener('click', () => selectSede(chip.dataset.sede));
});

function selectSede(sede) {
  state.sede = sede;
  state.fecha = null;

  document.querySelectorAll('.sede-chip').forEach((chip) => {
    chip.classList.toggle('is-selected', chip.dataset.sede === sede);
  });

  document.getElementById('calendar-field').hidden = false;
  document.getElementById('horario-field').hidden = true;
  document.getElementById('occupancy-note').hidden = true;
  document.querySelectorAll('input[name="horario"]').forEach((r) => { r.checked = false; });

  updateSubmitState();
  renderCalendar();
}

// --- Calendario (solo días hábiles, lunes a viernes) ---

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const turnos = state.turnos;
  const year = state.mesActual.getFullYear();
  const month = state.mesActual.getMonth();

  const label = state.mesActual.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  document.getElementById('cal-month-label').textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // semana arranca en lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day is-empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const iso = toISODate(d);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = String(day);

    const isPast = d < today;
    const isWeekend = esFinDeSemana(d);
    const count = state.sede ? contarOcupados(turnos, state.sede, iso) : 0;
    const isFull = count >= CUPO_POR_SEDE_Y_FECHA;

    if (isWeekend) {
      btn.classList.add('is-weekend');
      btn.disabled = true;
    } else if (isPast) {
      btn.classList.add('is-past');
      btn.disabled = true;
    } else if (isFull) {
      btn.classList.add('is-full');
      btn.disabled = true;
    } else {
      const dot = document.createElement('span');
      dot.className = 'dot dot-open';
      btn.appendChild(dot);
      btn.addEventListener('click', () => selectFecha(iso));
    }

    if (state.fecha === iso) btn.classList.add('is-selected');

    grid.appendChild(btn);
  }
}

document.getElementById('cal-prev').addEventListener('click', () => {
  state.mesActual = new Date(state.mesActual.getFullYear(), state.mesActual.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  state.mesActual = new Date(state.mesActual.getFullYear(), state.mesActual.getMonth() + 1, 1);
  renderCalendar();
});

function selectFecha(iso) {
  state.fecha = iso;
  renderCalendar();

  const count = contarOcupados(state.turnos, state.sede, iso);
  const note = document.getElementById('occupancy-note');
  note.hidden = false;
  note.textContent = `${count} de ${CUPO_POR_SEDE_Y_FECHA} turnos ocupados en ${state.sede} el ${formatDisplayDate(iso)}.`;

  document.getElementById('horario-field').hidden = false;
  updateSubmitState();
}

// --- Formulario ---

['nombre', 'apellido', 'mail', 'celular'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateSubmitState);
});

document.querySelectorAll('input[name="horario"]').forEach((r) => {
  r.addEventListener('change', updateSubmitState);
});

function mailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function celularValido(v) {
  return v.replace(/\D/g, '').length >= 8;
}

function updateSubmitState() {
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const mail = document.getElementById('mail').value.trim();
  const celular = document.getElementById('celular').value.trim();
  const horario = document.querySelector('input[name="horario"]:checked');
  const ok = Boolean(
    nombre && apellido &&
    mail && mailValido(mail) &&
    celular && celularValido(celular) &&
    state.sede && state.fecha && horario
  );
  document.getElementById('btn-submit').disabled = !ok;
}

function resetForm() {
  document.getElementById('nombre').value = '';
  document.getElementById('apellido').value = '';
  document.getElementById('mail').value = '';
  document.getElementById('celular').value = '';
  document.querySelectorAll('input[name="horario"]').forEach((r) => { r.checked = false; });
  state.fecha = null;
  document.getElementById('horario-field').hidden = true;
  document.getElementById('occupancy-note').hidden = true;
  updateSubmitState();
  renderCalendar();
}

document.getElementById('form-turno').addEventListener('submit', async (e) => {
  e.preventDefault();

  const msg = document.getElementById('form-message');
  const btn = document.getElementById('btn-submit');
  msg.className = 'form-message';

  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const mail = document.getElementById('mail').value.trim();
  const celular = document.getElementById('celular').value.trim();
  const horario = document.querySelector('input[name="horario"]:checked').value;

  const ocupados = contarOcupados(state.turnos, state.sede, state.fecha);
  if (ocupados >= CUPO_POR_SEDE_Y_FECHA) {
    msg.textContent = 'Ese cupo se completó recién. Elegí otra fecha.';
    msg.classList.add('is-error');
    renderCalendar();
    return;
  }

  const turno = {
    id: generarId(),
    nombre,
    apellido,
    mail,
    celular,
    sede: state.sede,
    fecha: state.fecha,
    horario,
    estado: 'Postulado',
    creadoEn: new Date().toISOString(),
  };

  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const resultado = await crearTurnoRemoto(turno);

  btn.textContent = 'Confirmar turno';

  if (!resultado.ok) {
    msg.textContent = 'No se pudo guardar el turno. Probá de nuevo en unos segundos.';
    msg.classList.add('is-error');
    updateSubmitState();
    return;
  }

  msg.textContent = `${nombre} ${apellido}, tu turno es el ${formatDisplayDate(state.fecha)} (${horario}) en ${state.sede}. Te vamos a confirmar el turno por Google Calendar.`;
  msg.classList.add('is-success');
  resetForm();
});

// --- Panel ---

function renderPanel() {
  const turnos = state.turnos
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  renderSummary(turnos);
  renderCharts(turnos);
  renderTabla(turnos);
}

function renderSummary(turnos) {
  const el = document.getElementById('panel-summary');
  const counts = { Postulado: 0, Presente: 0, Ausente: 0, Cancelado: 0 };
  turnos.forEach((t) => { counts[t.estado] = (counts[t.estado] || 0) + 1; });

  el.innerHTML = `
    <div class="summary-card"><span class="num">${turnos.length}</span><span class="lbl">Total postulados</span></div>
    <div class="summary-card"><span class="num">${counts.Presente}</span><span class="lbl">Presentes</span></div>
    <div class="summary-card"><span class="num">${counts.Ausente}</span><span class="lbl">Ausentes</span></div>
    <div class="summary-card"><span class="num">${counts.Cancelado}</span><span class="lbl">Cancelados</span></div>
  `;
}

const PALETA_ESTADOS = {
  Postulado: '#5B6270',
  Presente: '#2F8558',
  Ausente: '#C24A3D',
  Cancelado: '#8A93A3',
};

const PALETA_SEDES = {
  Florida: '#2F6690',
  Merlo: '#3F7D5C',
  Adrogué: '#B9862B',
};

function renderCharts(turnos) {
  const ctxEstados = document.getElementById('chart-estados');
  const ctxSedes = document.getElementById('chart-sedes');

  if (!turnos.length) {
    if (chartEstados) { chartEstados.destroy(); chartEstados = null; }
    if (chartSedes) { chartSedes.destroy(); chartSedes = null; }
    return;
  }

  const countsEstado = { Postulado: 0, Presente: 0, Ausente: 0, Cancelado: 0 };
  turnos.forEach((t) => { countsEstado[t.estado] = (countsEstado[t.estado] || 0) + 1; });

  const countsSede = { Florida: 0, Merlo: 0, Adrogué: 0 };
  turnos.forEach((t) => { if (countsSede[t.sede] !== undefined) countsSede[t.sede] += 1; });

  if (typeof Chart === 'undefined') return;

  if (chartEstados) chartEstados.destroy();
  chartEstados = new Chart(ctxEstados, {
    type: 'doughnut',
    data: {
      labels: Object.keys(countsEstado),
      datasets: [{
        data: Object.values(countsEstado),
        backgroundColor: Object.keys(countsEstado).map((k) => PALETA_ESTADOS[k]),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11.5 } } },
      },
      cutout: '62%',
    },
  });

  if (chartSedes) chartSedes.destroy();
  chartSedes = new Chart(ctxSedes, {
    type: 'bar',
    data: {
      labels: Object.keys(countsSede),
      datasets: [{
        data: Object.values(countsSede),
        backgroundColor: Object.keys(countsSede).map((k) => PALETA_SEDES[k]),
        borderRadius: 6,
        maxBarThickness: 46,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function renderTabla(turnos) {
  const sedeF = document.getElementById('filtro-sede').value;
  const estadoF = document.getElementById('filtro-estado').value;
  const tbody = document.getElementById('tabla-turnos-body');

  const filtrados = turnos.filter(
    (t) => (!sedeF || t.sede === sedeF) && (!estadoF || t.estado === estadoF)
  );

  if (!filtrados.length) {
    tbody.innerHTML = '<tr class="table-empty"><td colspan="6">No hay turnos con estos filtros.</td></tr>';
    return;
  }

  tbody.innerHTML = filtrados.map((t) => `
    <tr>
      <td>${escapeHtml(t.nombre)} ${escapeHtml(t.apellido)}</td>
      <td class="contact-cell">
        <span class="mail">${escapeHtml(t.mail)}</span>
        <span class="cel">${escapeHtml(t.celular)}</span>
      </td>
      <td><span class="tag tag-${sedeSlug(t.sede)}">${t.sede}</span></td>
      <td>${formatDisplayDate(t.fecha)}</td>
      <td>${t.horario}</td>
      <td><span class="tag tag-estado-${estadoSlug(t.estado)}">${t.estado}</span></td>
    </tr>
  `).join('');
}

document.getElementById('filtro-sede').addEventListener('change', () => renderTabla(state.turnos));
document.getElementById('filtro-estado').addEventListener('change', () => renderTabla(state.turnos));

// --- Init ---

(async function init() {
  updateSubmitState();
  await obtenerTurnos({ silencioso: true });
  renderCalendar();
})();
