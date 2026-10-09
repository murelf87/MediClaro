# Capturas para las tiendas

Generadas el 28-09-2026 desde la **versión de tienda** (sin compras dentro de la app) con **datos de ejemplo**: la
persona «María», medicamentos de muestra y un servicio de asistencia ficticio («Mi teleasistencia»). No aparece ningún
dato real de ninguna persona ni ningún teléfono personal. Titulares: `store/FICHA_TIENDAS.md` §3, en el mismo orden.

Todas son **PNG sin transparencia** (RGB), en los tamaños exactos que piden las tiendas.

| Carpeta | Tamaño | Dónde se sube |
|---|---|---|
| `iphone-6.9/` | 1320 × 2868 | App Store Connect → capturas de iPhone de 6,9" (las que Apple usa por defecto) |
| `iphone-6.5/` | 1284 × 2778 | App Store Connect → iPhone de 6,5" (Apple las exige si no hay de 6,9"; se incluyen por si acaso) |
| `android/` | 1080 × 1920 (9:16) | Play Console → Ficha de Play Store → Capturas de pantalla del teléfono |
| `google-play/grafico-destacado-1024x500.png` | 1024 × 500 | Play Console → Gráfico destacado (obligatorio) |
| `google-play/icono-512.png` | 512 × 512 | Play Console → Icono de la aplicación |

En App Store Connect el icono lo toma Apple de la propia compilación (`assets/icon.png`).

| Nº | Archivo | Titular | Pantalla |
|---|---|---|---|
| 1 | `01-identificar.png` | Una foto y sabrás qué medicamento es | Resultado: medicamento identificado |
| 2 | `02-ficha.png` | Información oficial, clara y sencilla | Ficha en lenguaje sencillo |
| 3 | `03-voz.png` | Escúchalo en voz alta, a tu ritmo | Lectura en voz alta (leyendo) |
| 4 | `04-asistente.png` | Pregunta tus dudas sobre el prospecto | Asistente con contexto del medicamento |
| 5 | `05-mis-medicamentos.png` | Tus medicamentos, siempre a mano | Mis medicamentos |
| 6 | `06-emergencia.png` | Emergencia: el 112 siempre a la vista | Emergencia: 112 separado del servicio privado |

Notas:

- La pantalla de voz se capturó con una voz simulada, porque el navegador de pruebas no tiene voces; en el teléfono se
  usa la voz del sistema. La pantalla es la misma.
- La foto del envase es la ilustración que la app muestra cuando la base oficial no tiene foto de esa caja.
- Para regenerarlas tras cambiar la interfaz: `scripts/store-screenshots.js` y `scripts/store-feature-graphic.js`
  (instrucciones dentro de cada archivo).
