# Turnos de Selección

Página para reservar turno de selección de personal en Florida, Merlo o Adrogué. Los datos se guardan en una **Google Sheet** (vía un workflow de n8n) para que se puedan cargar y editar tanto desde la página como directamente desde Drive.

## Archivos

- `index.html`, `styles.css`, `app.js` — la página.
- `config.js` — acá van las URLs de tus 3 webhooks de n8n.

## 1. Preparar la Google Sheet

En tu hoja ([link](https://docs.google.com/spreadsheets/d/1ACEhOwCwAg9_216w9vRgJelp2fRQxdZBknbBoirVrVs/edit)) dejá una fila de encabezados con estas columnas exactas:

| ID | Nombre | Apellido | Mail | Celular | Sede | Fecha | Horario | Estado | CreadoEn |
|----|--------|----------|------|---------|------|-------|---------|--------|----------|

`Estado` acepta: `Postulado`, `Presente`, `Ausente`, `Cancelado`. Si alguien lo cambia manualmente desde Drive, la página lo va a reflejar la próxima vez que sincronice (botón **Actualizar desde Sheets** en el Panel, o al recargar).

## 2. Workflow de n8n (3 webhooks)

Creá un workflow con 3 disparadores **Webhook**, cada uno conectado a un nodo **Google Sheets** apuntando a esa hoja:

1. **Listar** — `GET /turnos-listar` → nodo Google Sheets, operación *Read/Get rows* → responder con el array de filas (JSON).
2. **Crear** — `POST /turnos-crear` → nodo Google Sheets, operación *Append row* → guarda el body recibido (id, nombre, apellido, mail, celular, sede, fecha, horario, estado, creadoEn) → responder `{ "ok": true }`.
3. **Actualizar estado** — `POST /turnos-actualizar-estado` → nodo Google Sheets, operación *Update row* (matching por columna `ID`) → actualiza solo `Estado` con el body `{ id, estado }` → responder `{ "ok": true }`.

En cada nodo Webhook:
- Modo de respuesta: **Using 'Respond to Webhook' Node**.
- **Allowed Origins (CORS)**: `*` (o el dominio donde publiques la página).

Activá el workflow y copiá las 3 URLs de producción.

## 3. Conectar la página

Editá `config.js`:

```js
const APP_CONFIG = {
  N8N_LISTAR_URL: 'https://tu-n8n.com/webhook/turnos-listar',
  N8N_CREAR_URL: 'https://tu-n8n.com/webhook/turnos-crear',
  N8N_ACTUALIZAR_URL: 'https://tu-n8n.com/webhook/turnos-actualizar-estado',
};
```

Si dejás las URLs vacías, la página funciona en modo local (`localStorage`, solo en ese navegador) — útil para probar el diseño sin depender de n8n.

## 4. Publicar

Subí los 4 archivos a GitHub y activá GitHub Pages, o desplegá con Vercel — no requiere build.

## Funcionalidad

- **Reservar turno**: nombre, apellido, mail corporativo, celular, sede, fecha (calendario limitado a **lunes a viernes**, hasta 3 turnos por sede/día) y horario.
- **Panel**: resumen numérico, dos gráficos (estado de postulantes y turnos por sede) y una tabla con filtros donde se marca Presente/Ausente/Cancelado — el cambio se guarda en la misma Google Sheet.
