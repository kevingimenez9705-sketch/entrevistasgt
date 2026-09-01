# Turnos de Selección

Página para reservar turno de selección de personal en Florida, Merlo o Adrogué. Los datos se guardan en una **Google Sheet**, conectada directo por un **Google Apps Script** (sin servicios de por medio) — se puede cargar y editar el estado tanto desde la página como directamente desde Drive.

## Archivos

- `index.html`, `styles.css`, `app.js` — la página.
- `config.js` — acá va la URL de tu Web App de Apps Script.
- `Code.gs` — el script que se pega en el Google Sheet (no se sube al hosting de la página).

## 1. Preparar la Google Sheet

En tu hoja ([link](https://docs.google.com/spreadsheets/d/1ACEhOwCwAg9_216w9vRgJelp2fRQxdZBknbBoirVrVs/edit)):

1. Nombrá la pestaña **"Turnos"**.
2. Poné esta fila de encabezados exacta en la fila 1:

| ID | Nombre | Apellido | Mail | Celular | Sede | Fecha | Horario | Estado | CreadoEn |
|----|--------|----------|------|---------|------|-------|---------|--------|----------|

`Estado` acepta: `Postulado`, `Presente`, `Ausente`, `Cancelado`. Si alguien lo cambia manualmente desde Drive, la página lo refleja al sincronizar (botón **Actualizar desde Sheets** en el Panel, o al recargar).

## 2. Conectar con Apps Script

1. Abrí la hoja → **Extensiones → Apps Script**.
2. Borrá el contenido de `Código.gs` y pegá el contenido de `Code.gs` de este repo.
3. Guardá, y arriba a la derecha: **Implementar → Nueva implementación**.
4. Tipo: **Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**.
5. Implementar → autorizá los permisos (es tu propia hoja) → copiá la URL que termina en `/exec`.

## 3. Conectar la página

Editá `config.js`:

```js
const APP_CONFIG = {
  SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
};
```

Vacío = modo local (`localStorage`, solo en ese navegador), útil para probar el diseño sin depender de la hoja.

> Cada vez que edites `Code.gs` en Apps Script tenés que hacer **Implementar → Gestionar implementaciones → editar (lápiz) → Nueva versión** para que los cambios se reflejen en la URL ya publicada.

## 4. Publicar

Subí los archivos a GitHub y activá GitHub Pages, o desplegá con Vercel — no requiere build.

## Funcionalidad

- **Reservar turno**: nombre, apellido, mail corporativo, celular, sede, fecha (calendario limitado a **lunes a viernes**, hasta 3 turnos por sede/día) y horario.
- **Panel**: resumen numérico, dos gráficos (estado de postulantes y turnos por sede) y una tabla con filtros donde se marca Presente/Ausente/Cancelado — el cambio se guarda en la misma Google Sheet.
