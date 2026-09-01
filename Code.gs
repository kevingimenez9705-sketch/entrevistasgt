// Google Apps Script — pegar esto en Extensiones > Apps Script del Google Sheet
// y publicarlo como Web App (ver README, sección "Conectar con Apps Script").
//
// Espera una hoja llamada "Turnos" con esta fila de encabezados en la fila 1:
// ID | Nombre | Apellido | Mail | Celular | Sede | Fecha | Horario | Estado | CreadoEn

const SHEET_NAME = 'Turnos';
const ESTADOS = ['Postulado', 'Presente', 'Ausente', 'Cancelado'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function headers_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function normalizar_(s) {
  return String(s || '').trim().toLowerCase();
}

// Mapa "encabezado normalizado" -> índice de columna (0-based).
// Así una columna "Fecha " (con espacio de más) o "fecha" en minúscula igual matchea.
function mapaColumnas_(heads) {
  const mapa = {};
  heads.forEach((h, i) => { mapa[normalizar_(h)] = i; });
  return mapa;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function formatearFecha_(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(valor || '');
}

// --- Validación de Estado en la hoja (desplegable, evita errores de tipeo) ---
// Se aplica sola cada vez que se abre la hoja. Para aplicarla ya mismo, sin
// esperar a reabrir el archivo, corré esta función una vez desde el editor
// (▶ Ejecutar, eligiendo "aplicarValidacionEstado_").

function onOpen() {
  aplicarValidacionEstado_();
}

function aplicarValidacionEstado_() {
  const sheet = getSheet_();
  const colIdx = mapaColumnas_(headers_(sheet));
  const col = colIdx['estado'];
  if (col === undefined) return;

  const filas = Math.max(sheet.getMaxRows() - 1, 500);
  const regla = SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, col + 1, filas, 1).setDataValidation(regla);
}

// --- Lectura: GET ?action=listar ---

function doGet(e) {
  const accion = (e.parameter && e.parameter.action) || 'listar';
  if (accion !== 'listar') return jsonOut_({ ok: false, error: 'Acción no soportada' });

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonOut_([]);

  const heads = headers_(sheet);
  const colIdx = mapaColumnas_(heads);
  const filas = sheet.getRange(2, 1, lastRow - 1, heads.length).getValues();

  function val(fila, campo) {
    const i = colIdx[campo];
    return i === undefined ? '' : fila[i];
  }

  const turnos = filas.map((fila) => ({
    id: String(val(fila, 'id') || ''),
    nombre: val(fila, 'nombre') || '',
    apellido: val(fila, 'apellido') || '',
    mail: val(fila, 'mail') || '',
    celular: val(fila, 'celular') || '',
    sede: val(fila, 'sede') || '',
    fecha: formatearFecha_(val(fila, 'fecha')),
    horario: val(fila, 'horario') || '',
    estado: val(fila, 'estado') || 'Postulado',
    creadoEn: val(fila, 'creadoen') || '',
  })).filter((t) => t.id);

  return jsonOut_(turnos);
}

// --- Escritura: POST { action: 'crear', ... } ---
// El estado sólo se edita a mano en la hoja (con el desplegable de arriba),
// no hay endpoint para cambiarlo desde afuera.

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'JSON inválido' });
  }

  if (body.action === 'crear') return crearTurno_(body.turno || body);
  return jsonOut_({ ok: false, error: 'Acción no soportada' });
}

function crearTurno_(t) {
  const valores = {
    id: t.id, nombre: t.nombre, apellido: t.apellido, mail: t.mail, celular: t.celular,
    sede: t.sede, fecha: t.fecha, horario: t.horario, estado: t.estado || 'Postulado', creadoen: t.creadoEn,
  };

  const obligatorios = ['id', 'nombre', 'apellido', 'mail', 'celular', 'sede', 'fecha', 'horario'];
  const faltantes = obligatorios.filter((c) => !valores[c]);
  if (faltantes.length) {
    return jsonOut_({ ok: false, error: 'Faltan datos obligatorios: ' + faltantes.join(', ') });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSheet_();
    const heads = headers_(sheet);
    const colIdx = mapaColumnas_(heads);

    const fila = new Array(heads.length).fill('');
    Object.keys(valores).forEach((campo) => {
      const i = colIdx[campo];
      if (i !== undefined) fila[i] = valores[campo];
    });

    sheet.appendRow(fila);
    aplicarValidacionEstado_();
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

