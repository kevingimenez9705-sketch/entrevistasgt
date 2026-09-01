// Configuración de la conexión con n8n / Google Sheets.
// Completá las 3 URLs con los webhooks de tu workflow de n8n (ver README).
// Podés dejarlas vacías para probar la página en modo local (localStorage).
const APP_CONFIG = {
  N8N_LISTAR_URL: '',      // GET  -> devuelve todos los turnos (lee la hoja de Drive)
  N8N_CREAR_URL: '',       // POST -> crea un turno nuevo (agrega fila en la hoja)
  N8N_ACTUALIZAR_URL: '',  // POST -> actualiza el estado de un turno (busca por id)
};
