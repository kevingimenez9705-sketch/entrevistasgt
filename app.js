const SEDES = ['Florida', 'Merlo', 'Adrogué'];
const HORARIOS = ['9 a 13hs', '14 a 18hs', '9 a 18hs'];
const ESTADOS = ['Postulado', 'Presente', 'Ausente', 'Cancelado'];
const CUPO_POR_SEDE_Y_FECHA = 3;
const STORAGE_KEY = 'turnos-seleccion:turnos';

const state = {
  sede: null,
  fecha: null,
  mesActual: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  ocupacionMes: {},
};

// --- Almacenamiento local ---

function cargarTurnos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('No se pudo leer el almacenamiento local:', err.message);
    return [];
  }
}

function guardarTurnos(turnos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(turnos));
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

function contarOcupados(turnos, sede, fecha) {
  return turnos.filter((t) => t.sede === sede && t.fecha === fecha && t.estado !== 'Cancelado').length;
}

// --- Tabs ---

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');

    document.querySelectorAll('.view').forEach((v) => v.classList.remove('is-active'));
    document.getElementById(`view-${tab.dataset.view}`).classList.add('is-active');

    if (tab.dataset.view === 'panel') renderPanel();
  });
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

// --- Calendario ---

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const turnos = cargarTurnos();
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
    const count = state.sede ? contarOcupados(turnos, state.sede, iso) : 0;
    const isFull = count >= CUPO_POR_SEDE_Y_FECHA;

    if (isPast) {
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

  const count = contarOcupados(cargarTurnos(), state.sede, iso);
  const note = document.getElementById('occupancy-note');
  note.hidden = false;
  note.textContent = `${count} de ${CUPO_POR_SEDE_Y_FECHA} turnos ocupados en ${state.sede} el ${formatDisplayDate(iso)}.`;

  document.getElementById('horario-field').hidden = false;
  updateSubmitState();
}

// --- Formulario ---

['nombre', 'apellido'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateSubmitState);
});

document.querySelectorAll('input[name="horario"]').forEach((r) => {
  r.addEventListener('change', updateSubmitState);
});

function updateSubmitState() {
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const horario = document.querySelector('input[name="horario"]:checked');
  const ok = Boolean(nombre && apellido && state.sede && state.fecha && horario);
  document.getElementById('btn-submit').disabled = !ok;
}

function resetForm() {
  document.getElementById('nombre').value = '';
  document.getElementById('apellido').value = '';
  document.querySelectorAll('input[name="horario"]').forEach((r) => { r.checked = false; });
  state.fecha = null;
  document.getElementById('horario-field').hidden = true;
  document.getElementById('occupancy-note').hidden = true;
  updateSubmitState();
  renderCalendar();
}

document.getElementById('form-turno').addEventListener('submit', (e) => {
  e.preventDefault();

  const msg = document.getElementById('form-message');
  msg.className = 'form-message';

  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const horario = document.querySelector('input[name="horario"]:checked').value;

  const turnos = cargarTurnos();
  const ocupados = contarOcupados(turnos, state.sede, state.fecha);

  if (ocupados >= CUPO_POR_SEDE_Y_FECHA) {
    msg.textContent = 'Ese cupo se completó recién. Elegí otra fecha.';
    msg.classList.add('is-error');
    renderCalendar();
    return;
  }

  turnos.push({
    id: generarId(),
    nombre,
    apellido,
    sede: state.sede,
    fecha: state.fecha,
    horario,
    estado: 'Postulado',
    creadoEn: new Date().toISOString(),
  });
  guardarTurnos(turnos);

  msg.textContent = `Turno confirmado para ${nombre} ${apellido} el ${formatDisplayDate(state.fecha)} (${horario}) en ${state.sede}.`;
  msg.classList.add('is-success');
  resetForm();
});

// --- Panel ---

function renderPanel() {
  const turnos = cargarTurnos()
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  renderSummary(turnos);
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

function renderTabla(turnos) {
  const sedeF = document.getElementById('filtro-sede').value;
  const estadoF = document.getElementById('filtro-estado').value;
  const tbody = document.getElementById('tabla-turnos-body');

  const filtrados = turnos.filter(
    (t) => (!sedeF || t.sede === sedeF) && (!estadoF || t.estado === estadoF)
  );

  if (!filtrados.length) {
    tbody.innerHTML = '<tr class="table-empty"><td colspan="5">No hay turnos con estos filtros.</td></tr>';
    return;
  }

  tbody.innerHTML = filtrados.map((t) => `
    <tr>
      <td>${escapeHtml(t.nombre)} ${escapeHtml(t.apellido)}</td>
      <td><span class="tag tag-${sedeSlug(t.sede)}">${t.sede}</span></td>
      <td>${formatDisplayDate(t.fecha)}</td>
      <td>${t.horario}</td>
      <td>
        <select class="estado-select estado-${estadoSlug(t.estado)}" data-id="${t.id}">
          ${ESTADOS.map((e) => `<option value="${e}" ${e === t.estado ? 'selected' : ''}>${e}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.estado-select').forEach((sel) => {
    sel.addEventListener('change', () => updateEstado(sel.dataset.id, sel.value, sel));
  });
}

function updateEstado(id, estado, selectEl) {
  const turnos = cargarTurnos();
  const t = turnos.find((t) => t.id === id);
  if (!t) return;
  t.estado = estado;
  guardarTurnos(turnos);
  selectEl.className = `estado-select estado-${estadoSlug(estado)}`;
  renderSummary(turnos);
}

document.getElementById('filtro-sede').addEventListener('change', () => renderTabla(cargarTurnos()));
document.getElementById('filtro-estado').addEventListener('change', () => renderTabla(cargarTurnos()));

// --- Init ---

updateSubmitState();
