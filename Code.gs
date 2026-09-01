// Google Apps Script — pegar esto en Extensiones > Apps Script del Google Sheet
// y publicarlo como Web App (ver README, sección "Conectar con Apps Script").
//
// Espera una hoja llamada "Turnos" con esta fila de encabezados en la fila 1:
// ID | Nombre | Apellido | Mail | Celular | Sede | Fecha | Horario | Estado | CreadoEn

const SHEET_NAME = 'Turnos';

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function headers_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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

// --- Lectura: GET ?action=listar ---

function doGet(e) {
  const accion = (e.parameter && e.parameter.action) || 'listar';
  if (accion !== 'listar') return jsonOut_({ ok: false, error: 'Acción no soportada' });

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonOut_([]);

  const heads = headers_(sheet);
  const filas = sheet.getRange(2, 1, lastRow - 1, heads.length).getValues();

  const turnos = filas.map((fila) => {
    const obj = {};
    heads.forEach((h, i) => { obj[h] = fila[i]; });
    return {
      id: String(obj.ID || ''),
      nombre: obj.Nombre || '',
      apellido: obj.Apellido || '',
      mail: obj.Mail || '',
      celular: obj.Celular || '',
      sede: obj.Sede || '',
      fecha: formatearFecha_(obj.Fecha),
      horario: obj.Horario || '',
      estado: obj.Estado || 'Postulado',
      creadoEn: obj.CreadoEn || '',
    };
  }).filter((t) => t.id);

  return jsonOut_(turnos);
}

// --- Escritura: POST { action: 'crear' | 'actualizar', ... } ---

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'JSON inválido' });
  }

  if (body.action === 'crear') return crearTurno_(body.turno || body);
  if (body.action === 'actualizar') return actualizarEstado_(body.id, body.estado);
  return jsonOut_({ ok: false, error: 'Acción no soportada' });
}

function crearTurno_(t) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSheet_();
    const heads = headers_(sheet);
    const mapa = {
      ID: t.id, Nombre: t.nombre, Apellido: t.apellido, Mail: t.mail, Celular: t.celular,
      Sede: t.sede, Fecha: t.fecha, Horario: t.horario, Estado: t.estado || 'Postulado', CreadoEn: t.creadoEn,
    };
    const fila = heads.map((h) => (mapa[h] !== undefined ? mapa[h] : ''));
    sheet.appendRow(fila);
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function actualizarEstado_(id, estado) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSheet_();
    const heads = headers_(sheet);
    const colId = heads.indexOf('ID') + 1;
    const colEstado = heads.indexOf('Estado') + 1;
    if (!colId || !colEstado) return jsonOut_({ ok: false, error: 'Faltan columnas ID/Estado' });

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonOut_({ ok: false, error: 'Turno no encontrado' });

    const ids = sheet.getRange(2, colId, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        sheet.getRange(i + 2, colEstado).setValue(estado);
        return jsonOut_({ ok: true });
      }
    }
    return jsonOut_({ ok: false, error: 'Turno no encontrado' });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}
