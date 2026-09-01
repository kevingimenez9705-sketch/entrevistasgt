# Turnos de Selección

Página estática para reservar turno de selección de personal en Florida, Merlo o Adrogué.

## Uso

Son 3 archivos, sin ningún paso de instalación: `index.html`, `styles.css`, `app.js`. Subilos a un repo de GitHub y activá GitHub Pages (Settings → Pages → rama `main`), o simplemente abrí `index.html` en el navegador.

- **Reservar turno**: nombre, apellido, sede, fecha en un calendario (los días con 3 turnos activos en esa sede quedan marcados como completos) y horario (9 a 13hs / 14 a 18hs / 9 a 18hs).
- **Panel**: resumen (total, presentes, ausentes, cancelados), filtros por sede/estado, y una tabla donde se marca presente/ausente/cancelado. Un cancelado libera el cupo de esa fecha.

## Importante

Los datos se guardan en el `localStorage` del navegador — quedan solo en el dispositivo/navegador donde se cargan, no se comparten entre distintas computadoras ni usuarios. Sirve para cargar los turnos desde un mismo equipo; si más adelante hace falta que varias personas carguen desde distintos dispositivos y vean lo mismo, va a hacer falta sumar algún almacenamiento compartido (Supabase u otro).
