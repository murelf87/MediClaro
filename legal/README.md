# Textos legales de MediClaro (borradores)

> **BORRADOR: pendiente de revisión jurídica. No publicar sin revisar.**
>
> Preparados el 28-sep-2026 a partir de `COMMERCIAL_BRIEF.md` (fuente de verdad) y de una lectura del código de la app y
> del servidor. No se ha inventado ningún dato del titular ni del servicio. Lo que falta aparece como `[PENDIENTE: …]` y
> lo que hay que comprobar, como `[VERIFICAR: …]`.
>
> Se ha seguido la regla del propietario: no se han buscado leyes, artículos, jurisprudencia ni el BOE en internet. Las
> normas se nombran por su nombre común y cada artículo citado lleva detrás `[VERIFICAR CITA]`. Tampoco hay enlaces a la
> plataforma europea de resolución de litigios en línea.

## Archivos

| Archivo | Contenido | Variable de la app |
|---|---|---|
| `politica-privacidad.html` | Responsable; datos por función; IA y permiso; bases jurídicas (con el consentimiento expreso para datos de salud y el permiso para la IA); datos que solo están en el teléfono; proveedores; transferencias; conservación; derechos (con «Eliminar tu cuenta» en `#eliminar-cuenta`); AEPD; menores; seguridad; cambios | `EXPO_PUBLIC_PRIVACY_URL` |
| `condiciones-uso.html` | Qué es y qué no es MediClaro; fuente CIMA/AEMPS; IA y sus límites; emergencia; cuenta por SMS; uso correcto; planes (gratuito y Premium «cuando esté disponible»); responsabilidad; propiedad intelectual; baja; cambios; ley aplicable | `EXPO_PUBLIC_TERMS_URL` |
| `aviso-legal.html` | Datos del titular (LSSI-CE); objeto; uso de las páginas; propiedad intelectual; responsabilidad; enlaces; fuente AEMPS; cookies; ley aplicable | `EXPO_PUBLIC_LEGAL_NOTICE_URL` |

Formato: HTML completo (`lang="es"` y `viewport`), estilos incrustados, sin scripts ni recursos externos, texto base de
18 px, ancho máximo de 720 px, índice con anclas y enlaces «Volver al índice», banda superior de borrador y huecos
resaltados con `<mark>`. Probado a 320, 360 y 1024 px de ancho: no hay desplazamiento horizontal y la banda no tapa los
títulos al saltar a un ancla.

## 1. Antes de publicar

1. **Revisión jurídica.** Resolver todos los huecos de la [sección 4](#4-lista-completa-de-huecos). Para ver los que
   quedan: `grep -n "<mark>" legal/*.html`. Al publicar no debe salir ninguno.
2. **Versión y fecha** en la cabecera de cada documento. Usar la misma versión que registrará la app en la tabla
   `consents` (requisito R-08 de `BACKEND_REQUIREMENTS.md`). Cada vez que cambie un texto, subir la versión.
3. **Quitar las marcas de borrador:** la banda `<p class="borrador" role="note">…</p>` y la línea
   `<meta name="robots" content="noindex, nofollow">` (esta última es opcional).
4. **Coherencia con la app:** poner en `EXPO_PUBLIC_COMPANY_NAME`, `EXPO_PUBLIC_COMPANY_TAX_ID` y
   `EXPO_PUBLIC_COMPANY_ADDRESS` los mismos datos que en el Aviso legal. Revisar también la [sección 5](#5-comprobaciones-en-la-app-y-el-servidor).

## 2. Cómo publicarlos

- Vale **cualquier alojamiento de páginas estáticas con HTTPS**: el de la web del titular, GitHub Pages, Netlify,
  Cloudflare Pages, etc. No hace falta servidor ni base de datos.
- Subir **los tres archivos juntos y en la misma carpeta**. Se enlazan entre sí con rutas relativas
  (`politica-privacidad.html`, `condiciones-uso.html`, `aviso-legal.html` y anclas como
  `politica-privacidad.html#eliminar-cuenta`). Si se cambian los nombres, hay que actualizar esos enlaces.
- Usar **siempre `https://`**. La app abre estas direcciones en el navegador del teléfono, y App Store y Google Play
  exigen una URL pública para la política de privacidad.
- **Mantener las direcciones fijas.** Las variables `EXPO_PUBLIC_*` se incorporan a la app al compilarla: si cambia una
  URL, hace falta una compilación nueva. Para actualizar un texto, basta con sustituir el archivo en la misma dirección.
- Probar en un móvil que las tres páginas se abren y se leen bien, y que el índice funciona.
- Si el alojamiento añade cookies, analítica o registros de visitas, hay que reflejarlo (hueco del Aviso legal §8).

## 3. Qué URL poner en la app

Ejemplo con una carpeta `/legal/` en la web del titular (`[PENDIENTE: web]`):

```
EXPO_PUBLIC_PRIVACY_URL=https://<dominio>/legal/politica-privacidad.html
EXPO_PUBLIC_TERMS_URL=https://<dominio>/legal/condiciones-uso.html
EXPO_PUBLIC_LEGAL_NOTICE_URL=https://<dominio>/legal/aviso-legal.html
```

- **Dónde:** variables de EAS del perfil `production` (o `.env` para pruebas locales). Si una variable está vacía, la
  app muestra «Pendiente de publicación» en Información legal.
- **En la app** se abren desde Información legal y desde los enlaces de la pantalla de acceso y de
  Perfil → Privacidad y datos → Política de privacidad.
- **Tiendas:** la misma URL de privacidad va en App Store Connect (Privacy Policy URL) y en Play Console (Política de
  privacidad).
- **Eliminación de la cuenta en Google Play:** Play Console pide además una URL web para solicitar la eliminación de la
  cuenta. Puede servir `https://<dominio>/legal/politica-privacidad.html#eliminar-cuenta`, que explica los pasos en la
  app, qué se borra, qué se conserva y cómo pedirlo por correo sin la app
  `[VERIFICAR: que esa página cumple los requisitos de Google Play]`.

## 4. Lista completa de huecos

En los tres HTML hay **62 marcas y 40 huecos distintos** (algunos se repiten en varios documentos). «Privacidad §4»
significa «Política de privacidad, apartado 4».

### 4.1. Datos del titular y de cada versión

| Hueco | Dónde aparece |
|---|---|
| `[PENDIENTE: razón social]` | Privacidad §1 · Condiciones §1 · Aviso legal §1 |
| `[PENDIENTE: NIF]` | Privacidad §1 · Aviso legal §1 |
| `[PENDIENTE: domicilio]` | Privacidad §1 · Aviso legal §1 |
| `[PENDIENTE: inscripción registral]` | Aviso legal §1 |
| `[PENDIENTE: correo de privacidad]` | Privacidad §1 y §9 |
| `[PENDIENTE: correo de contacto]` | Condiciones §16 · Aviso legal §1 |
| `[PENDIENTE: teléfono]` | Privacidad §1 · Aviso legal §1 |
| `[PENDIENTE: web]` | Aviso legal §1 |
| `[PENDIENTE: número de versión]` | Cabecera de los tres documentos |
| `[PENDIENTE: fecha de última actualización]` | Cabecera de los tres documentos |

### 4.2. Decisiones del titular (`[PENDIENTE]`)

| Hueco | Dónde aparece |
|---|---|
| `[PENDIENTE: evaluación de impacto (EIPD) y necesidad de delegado de protección de datos — revisar con el abogado]` | Privacidad §1 |
| `[PENDIENTE: proveedor de SMS, p. ej. Twilio]` | Privacidad §2.1 y §6 |
| `[PENDIENTE: región de Supabase — recomendada UE]` | Privacidad §6 |
| `[PENDIENTE: garantía de transferencia de cada uno (p. ej., decisión de adecuación o cláusulas contractuales tipo) — revisar con el abogado]` | Privacidad §7 (Google, Stripe y proveedor de SMS) |
| `[PENDIENTE: plazos concretos a fijar por el titular]` | Privacidad §8 |
| `[PENDIENTE: confirmar edad mínima con el abogado]` | Privacidad §11 · Condiciones §8 |
| `[PENDIENTE: forma y plazo de aviso de los cambios]` | Privacidad §13 |
| `[PENDIENTE: canal de pago definitivo — compra dentro de la app de Apple/Google o Stripe; si es Apple o Google, adaptar este apartado]` | Privacidad §2.10 |
| `[PENDIENTE: canal de pago (Apple/Google o Stripe) y derecho de desistimiento en contenidos/servicios digitales — revisar con el abogado]` | Condiciones §10 (Premium) |
| `[PENDIENTE: cuándo se cobran las identificaciones adicionales, si cuentan las «no encontradas» y cómo avisa la app antes de empezar a cobrarlas]` | Condiciones §10 (Premium) |
| `[PENDIENTE: dónde se cancela según el canal de pago y qué ocurre si falla un cobro]` | Condiciones §10 (Premium) |
| `[PENDIENTE: qué ocurre con la parte ya pagada del periodo al eliminar la cuenta]` | Condiciones §13 |
| `[PENDIENTE: plazos de preaviso (cambios de condiciones, de precio y cierre del servicio)]` | Condiciones §14 |
| `[PENDIENTE: si el titular ofrece una central propia de MediClaro, indicar quién la presta, en qué condiciones y cómo se tratan los datos]` | Condiciones §7 |
| `[PENDIENTE: el titular debe confirmar que no hay relación con la AEMPS]` | Condiciones §1 · Aviso legal §6 |

### 4.3. Comprobaciones (`[VERIFICAR…]`)

| Hueco | Dónde aparece |
|---|---|
| `[VERIFICAR: confirmar con el titular que no hay publicidad ni cesión de datos con fines comerciales]` | Privacidad, «Lo esencial» |
| `[VERIFICAR: el historial y «Mis medicamentos» pueden revelar datos de salud; si es así, hace falta además una excepción del artículo 9.2 del RGPD [VERIFICAR CITA] (por ejemplo, consentimiento explícito) — revisar con el abogado]` | Privacidad §4 |
| `[VERIFICAR: que hay contrato de encargo del tratamiento con cada proveedor]` | Privacidad §6 |
| `[VERIFICAR: papel de Apple, Google (tiendas) y Stripe — encargados del tratamiento o responsables independientes — revisar con el abogado]` | Privacidad §6 |
| `[VERIFICAR: en la versión actual, los registros internos de uso y errores llevan el identificador de la cuenta (uno indica si una pregunta se derivó a emergencia) y, al eliminar la cuenta, se conservan sin él; además hay un registro de seguridad de bajas y descargas de datos, y copias de seguridad del servidor. Decidir plazos y describirlos aquí]` | Privacidad §8 |
| `[VERIFICAR: que la descarga incluya también el perfil de emergencia (requisito R-06 del servidor)]` | Privacidad §9 |
| `[VERIFICAR: relación con las condiciones de licencia de Apple (EULA estándar) y de Google Play]` | Condiciones §2 |
| `[VERIFICAR con la evaluación MDR del titular]` | Condiciones §4 («No es un producto sanitario») |
| `[VERIFICAR: si el máximo de 500 se refiere a identificaciones en total (100 incluidas + 400 adicionales, como aplica hoy el servidor) o a identificaciones adicionales; indicar aquí el cargo adicional máximo al mes (20 € o 25 €)]` | Condiciones §10 (Premium) |
| `[VERIFICAR: redacción de la limitación de responsabilidad para que no sea abusiva — revisar con el abogado]` | Condiciones §11 |
| `[VERIFICAR: ley aplicable y jurisdicción]` | Condiciones §15 · Aviso legal §9 |
| `[VERIFICAR: si procede alguna mención a resolución alternativa de litigios]` | Condiciones §15 |
| `[VERIFICAR: si la actividad necesita alguna autorización administrativa previa u otros datos que exija la LSSI-CE]` | Aviso legal §1 |
| `[VERIFICAR con el alojamiento elegido: que no instala cookies ni analítica, y si guarda registros de visitas (por ejemplo, la dirección IP); en ese caso, añadirlo a la Política de privacidad]` | Aviso legal §8 |

### 4.4. Citas de artículos (`[VERIFICAR CITA]`)

Hay 8 marcas `[VERIFICAR CITA]` sueltas y una más dentro del hueco sobre el historial (4.3):

| Cita | Dónde aparece |
|---|---|
| RGPD, artículo 6.1.b (ejecución del contrato) | Privacidad §4 |
| RGPD, artículo 6.1.a (consentimiento) | Privacidad §4 |
| RGPD, artículo 9.2.a (consentimiento explícito para datos de salud), 2 veces | Privacidad §4 |
| RGPD, artículo 6.1.c (obligación legal), 2 veces | Privacidad §4 |
| RGPD, artículo 6.1.f (interés legítimo) | Privacidad §4 |
| RGPD, artículo 9.2 (excepción para datos de salud, dentro del hueco del historial) | Privacidad §4 |
| LSSI-CE, artículo 10 (información sobre el titular) | Aviso legal, cabecera |

Fuera de los HTML, en este README: `[VERIFICAR: que esa página cumple los requisitos de Google Play]` (sección 3).

## 5. Comprobaciones en la app y el servidor

Hallazgos de la lectura del código del 28-sep-2026 que afectan a lo que dicen los textos. Los que ya tienen hueco en el
HTML lo indican.

1. **Permiso para la IA.** ✅ Resuelto en la versión 1.1 de la app: antes de la primera foto o pregunta aparece la
   pantalla «Antes de usar la inteligencia artificial» (Aceptar / Ahora no); se puede dar o retirar en Perfil →
   Privacidad y datos → Inteligencia artificial, y cada decisión se registra con fecha en la tabla `consents`
   (`kind = ai_processing`).
2. **Campos del perfil de emergencia.** ✅ Resuelto: Privacidad §2.8 enumera ya los campos reales del formulario
   (comprobados en el código de la v1.1; el médico se guarda solo en el teléfono).
3. **Métricas y auditoría.** `usage_events` guarda el identificador de la cuenta (incluido un evento cuando una pregunta
   se deriva a emergencia) y, al borrar la cuenta, las filas se quedan sin él (`on delete set null`). `audit_log` guarda
   las bajas y descargas con el identificador (hueco en Privacidad §8).
4. **«Descargar mis datos»** ✅ Resuelto en la app (v1.1): el archivo incluye ya el perfil de emergencia y los datos que
   solo están en el teléfono (servicio privado de asistencia, médico, preferencias y permiso para la IA). Sigue siendo
   recomendable que el servidor lo incluya también (R-06).
5. **Borrado parcial.** ✅ Resuelto en la v1.1: además de quitar medicamentos de la lista, se puede borrar el perfil de
   emergencia sin eliminar la cuenta (Perfil de emergencia → «Borrar mi perfil de emergencia»); Privacidad §2.8 lo dice.
6. **Baja con suscripción.** «Eliminar mi cuenta» cancela la suscripción de Stripe en el acto, no al final del periodo.
   Las Condiciones §13 lo dicen así; falta decidir qué pasa con lo ya pagado (hueco).
7. **Tope de Premium.** El servidor aplica un máximo de 500 identificaciones al mes en total (100 incluidas + 400
   adicionales). El brief dice «máximo 500 al mes» (hueco en Condiciones §10).
8. **Función `emergency-assess`.** Existe en el servidor, pero la app no la usa y no está en la lista de despliegue del
   README del proyecto. Si se usara, enviaría a Gemini el nombre, la dirección, los datos de salud y el contacto del perfil
   de emergencia, además de los últimos mensajes. Eso contradice la política («no se envía a Google el nombre…»).
   Recomendación: no desplegarla o, si se quiere usar, cambiar antes la política y el consentimiento.
9. **Cuidadores.** Existe la tabla `caregiver_links` (función preparada, no activa). Si se activa, hay que actualizar los
   textos.
10. **Pantalla de acceso.** Dice «Al continuar aceptas las Condiciones de uso y la Política de privacidad». Conviene que
    el abogado valore un texto del tipo «aceptas las Condiciones de uso y has leído la Política de privacidad», y que el
    consentimiento para los datos de salud se pida aparte (R-08).
11. **Cita de la fuente.** ✅ La ficha muestra ya la frase literal «Fuente de la información: Agencia Española de
    Medicamentos y Productos Sanitarios www.aemps.gob.es», la base de datos (CIMA), la fecha de obtención y, si hay
    resumen con IA, que ese resumen no es un texto de la AEMPS.
12. **Notificaciones.** Hay preferencias de avisos (incluidos «Consejos para usar MediClaro») pero todavía no se envían.
    Si se activan, hay que revisar los textos.

## 6. Otros puntos para el abogado

- **Reglamento europeo de inteligencia artificial:** revisar las obligaciones de transparencia del asistente y del resumen
  generado con IA. Las Condiciones ya dicen que el asistente es un sistema de IA y el resumen va etiquetado.
- **Registro de actividades de tratamiento y EIPD:** son documentos internos, no se publican (hueco de la EIPD en
  Privacidad §1).
- **Premium:** está redactado para cuando se active. Mientras las versiones de tienda no tengan compras, la sección solo
  informa y no debe llevar enlaces de pago.
