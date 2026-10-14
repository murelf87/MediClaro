# MediClaro · 08/10/2026 (tarde) — Explicación continua y correcciones del panel

> **Actualización 09/10/2026:** «Conocer MediClaro» es ahora **una sola toma con una sola voz (Sulafat)**, con
> 11 imágenes y una barra de progreso; ya no existe `tour-full-achird.wav` ni la elección de voz de la explicación.
> Lo vigente está en `CAMBIOS_2026-10-09.md` (apartado de la explicación) y en `src/config/tourScript.json`.

Continuación de `CAMBIOS_VOCES_Y_EXPO_GO_2026-10-08.md`. Todo es de la app (frontend) salvo un cambio de
configuración del servidor que debe aplicar el propietario (apartado 5).

## 1. «Conocer MediClaro»: ya no son tarjetas

Petición: «en lugar de hacer tarjetas, que vayan pasando sin que sean tarjetas: la voz por un lado y las imágenes
cambiando mientras habla».

- **Una sola grabación continua** por voz (Sulafat o Achird; Aoede usa Sulafat): no hay cortes entre pantallas.
- **26 imágenes sincronizadas con la voz**: cada una aparece en la frase que le toca. Medido con reconocimiento de voz
  sobre las pistas reales: la imagen llega entre 0,3 s después y 0,8 s antes de la frase (media 0,1 s antes).
- **«La voz»**: la guía de MediClaro abajo, con su onda mientras habla y un botón grande de pausa/continuar.
- **Barra en 5 partes** (Presentación, Identificar, Asistente, Escuchar, Emergencias): tocar una va a su principio.
- «Repetir esta parte», «Saltar», altavoz para verla **sin voz** (las imágenes siguen al mismo ritmo) y, al final,
  «Ver planes / Empezar / Terminar» + «Ver otra vez». Sin botón «Siguiente».
- Se para al salir de la pantalla o bloquear el móvil y continúa al volver. Si la voz no llega a sonar en 12 s,
  la explicación sigue sin voz y ofrece «Reintentar voz» (nunca se queda parada).
- Imágenes dibujadas para cualquier tamaño (lienzo 320 × 260 escalado): probadas en iPhone 15, Pro Max, SE,
  Android, Pixel, Fold y 320 px. Las maquetas de la app llevan la etiqueta «Ejemplo».

Archivos: `src/screens/premium/TourScreen.tsx` (nuevo diseño), `src/screens/premium/TourScenes.tsx` (imágenes),
`src/hooks/useTourPresentation.ts`, `src/config/tour.ts`, `src/config/tourScript.json` (textos e imágenes),
`src/config/tourTimeline.json` (GENERADO), `src/config/tourAudio.ts`. Eliminados: `useTourNarration.ts`,
`TourExamples.tsx`. Pistas: `assets/audio/tour-full-sulafat.wav` y `tour-full-achird.wav` (las grabaciones por
partes siguen en `assets/audio` como fuente; la app ya no las carga; el peso total de la app no cambia).

## 2. Por qué «no terminaban la frase»

Comprobado con reconocimiento de voz y con la continuidad de la onda: **las propias grabaciones estaban
desplazadas**. Varias empezaban con el final de la anterior y por eso a esa anterior le faltaba la última palabra.

| Grabación | Problema | Solución automática (`scripts/tour-recording-repairs.json`) |
|---|---|---|
| Sulafat · presentación | Se corta al empezar «…por **t-**» | Termina en «…con tu número de teléfono.» |
| Sulafat · asistente | Empieza con «-llas», acaba en «farma-» | Se le quita el resto y se le une «-macéutico» (estaba en la siguiente): **frase completa** |
| Sulafat · prospecto | Empieza con «-macéutico», acaba en «a tu r-» | Termina en «…te lo lee en voz alta.» |
| Achird · identificar | Acaba en «palabras sen-» | Se le une «-cillas» (estaba en la siguiente): **frase completa** |
| Achird · asistente | Empieza con «-cillas» | Se le quita el resto |

Las reparaciones solo se aplican si el archivo es exactamente el actual (sha256). Para recuperar los dos finales
de Sulafat que faltan hay que regenerarlas: **`REGENERAR_VOCES_EXPLICACION.bat`** (apartado 3).

## 3. Herramientas nuevas

- `node scripts/build-tour-track.mjs` — monta las pistas continuas y la línea de tiempo (quita restos y silencios,
  iguala volumen, pausas de 1 s entre partes, sitúa cada imagen alineando las pausas reales con el texto).
  `--check` comprueba que todo está al día (también lo comprueba Jest).
- `node scripts/generate-tour-consistent-rc.mjs` — regenera con Gemini (`tts-preview`, clave pública) **solo las
  grabaciones defectuosas**, comprueba cada una (empieza y termina en silencio, duración razonable) y la repite hasta
  6 veces. Si alguna no sale bien, **no toca las actuales**. `--revisar` (sin red) dice cuáles están mal; `--todas`
  las regenera todas. Probado aquí con un servidor de voz falso (descarta las cortadas, sustituye, monta y deja
  las 26 imágenes); con Gemini real no se puede probar desde este entorno.
- `REGENERAR_VOCES_EXPLICACION.bat` — lo anterior con doble clic + comprobación con Jest.
- `scripts/audit-tour-ui-rc.cjs` — auditoría con Edge actualizada a la presentación continua
  (`CONTINUOUS_TOUR_REAL_PLAYBACK=PASS`; con `FULL_TOUR=1` la escucha entera).

## 4. Correcciones del panel de la vista previa (10 notas, todas hechas)

| Pantalla | Nota | Cambio |
|---|---|---|
| Lucía | «No lee con voz de forma automática, ni sale poco a poco como si alguien escribiese» | La respuesta **se escribe poco a poco** (25 letras/s, máx. ~20 s; tocarla la muestra entera; con «Reducir movimiento», al instante) y **se lee sola**. El efecto existía pero se pintaba el texto entero (fallo corregido). |
| Lucía | «Tiene que reproducirse automáticamente» | Igual que la anterior (lectura automática tras escribir o hablar). |
| Lucía | «El logo ponlo al lado del icono de enviar» | El micrófono va **junto a «Enviar»**; se quita el panel grande. Grabando, la caja se pone roja: «Te escucho…». |
| Lucía | «Está activado el micrófono y no me deja» | En el iPhone ya graba (arreglo de la mañana). En la vista previa el panel de Claude bloquea el micrófono: ofrece un mensaje de voz de **ejemplo**. |
| Lectura en voz alta | «Debería leer el prospecto» | En la app lee el prospecto real con voz natural. En la vista previa (sin servidor) lee el texto real con la voz del navegador. |
| Inicio | «Elimina elegir o cambiar mi perfil… no 97» | Quitado (ser cuidador/a sigue en Perfil). Sin contador con Premium. |
| Inicio | «¿Qué quieres hacer hoy? hazlo responsive» | Nuevo `FitText`: el título se ajusta al ancho y cabe en una línea en todos los móviles. |
| Historial | «Quita las identificaciones de este mes» | Sin contador con Premium ilimitado. Cuenta y Premium dicen «Identificaciones ilimitadas». |
| Añadir medicamento | «El código de barras no tiene sentido» | Quitado de Añadir, de la cámara, de «no encontrado», de la ayuda, del permiso de IA y de Privacidad. Queda foto o C.N. (`/add-medication?form=cn` abre el campo). |
| Cuenta | «Tienes que poder subir fotos y cambiarla» | Foto de perfil: **Añadir/Cambiar** (galería), **Hacer una foto** (cámara frontal) y **Quitar**. Se recorta cuadrada y se reduce a 512 px. |

La lógica de identificación por foto no se ha tocado (hash de `identifyMedication`
`3a50b5953a560ca36583e555dce41b2294b58e9580f2db89f7cf2f42e8449342`; funciones `identify-medicine` y proveedores
idénticos). Sí cambian textos/botones en `src/screens/identify` (Añadir, cámara y «no encontrado»), así que
`verify-photo-unchanged-rc.mjs` los marcará como cambiados: son cambios pedidos de interfaz, no de lógica.

## 5. Servidor: identificaciones ilimitadas con Premium (lo aplica el propietario)

Hoy el servidor da a Premium 100 identificaciones al mes y cobra las adicionales. Para que sean **ilimitadas
mientras dure la suscripción** y sin pago por uso: `supabase/migrations/20261008200000_premium_unlimited_scans.sql`
(`npx supabase db push`) o pegar en Supabase → SQL Editor:

```sql
update public.plan_config
set monthly_scans = 1000000, hard_cap = 1000000, overage_enabled = false, updated_at = now()
where plan = 'premium';
```

Solo cambia datos de configuración (ni tablas, ni funciones, ni RLS). **Hasta aplicarlo, la app sigue mostrando el
uso real** que aplica el servidor (nunca oculta un cobro). La regla está en `src/config/plans.ts`
(`UNLIMITED_SCANS_FROM`).

## 6. Verificado aquí

- TypeScript: 0 errores. Jest: **33 suites / 404 pruebas OK** (nuevas: presentación continua, línea de tiempo y
  pistas, identificaciones ilimitadas).
- Paquete iOS (Hermes) generado sin errores: solo 2 audios de la explicación (6,98 + 6,63 MB).
- Vista previa web probada en navegador sin cabeza: voz continua, imágenes en su sitio, pausa, partes, final,
  sin voz; Lucía escribiendo y leyendo; ejemplo de micrófono; lectura del prospecto; foto de perfil; Inicio,
  Historial, Cuenta, Premium y Añadir medicamento; 7 tamaños de móvil.

**No verificado aquí:** voz real en el iPhone con Expo Go, regeneración con Gemini real y el cambio del servidor.
