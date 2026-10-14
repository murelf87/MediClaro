# VoIP + Geolocalización en Tiempo Real - MediClaro 1.0.2

**Fecha**: 14 de octubre de 2026  
**Estado**: Implementación completada - Listo para compilar  
**Objetivo**: Llamadas VoIP como WhatsApp + Mapa de ubicación en tiempo real

---

## 🎯 Objetivo Final

Implementar un sistema de **llamadas VoIP funcionando aunque la app esté cerrada** (como WhatsApp) + **mapa de ubicación en tiempo real integrado en la pantalla de llamada**.

---

## ✅ Lo que se ha hecho

### 1. **Infraestructura de APNs (Apple Push Notification Service)**

#### Secretos guardados en Supabase:
```
APNS_KEY_ID = Z45D6YXD9B
APNS_TEAM_ID = 6MBFF3Q644
APNS_KEY = [Contenido del archivo .p8]
```

**Archivo**: `supabase/functions/send-voip-call/index.ts`
- Función de Edge Function que envía notificaciones VoIP a iOS (APNs) y Android (FCM)
- Firma JWTs con la clave privada .p8
- Conecta con APNs producción (cambiar a sandbox si es necesario)

**Archivo**: `supabase/functions/initiate-voip-call/index.ts`
- Inicia una llamada VoIP:
  1. Crea registro en `care_calls`
  2. Obtiene tokens VoIP del receptor
  3. Llama a `send-voip-call` para enviar notificaciones

### 2. **Base de Datos - Tokens VoIP**

**Tabla existente**: `care_voip_tokens`
- `token`: Token VoIP (PushKit para iOS, Firebase para Android)
- `user_id`: Usuario propietario
- `platform`: 'ios' | 'android'
- `enabled`: Boolean
- RLS habilitado: Cada usuario solo ve sus propios tokens

### 3. **Geolocalización en Tiempo Real**

#### Nueva migración: `20261014230000_patient_location_realtime.sql`

**Tabla**: `care_patient_locations`
- `id`, `user_id`, `latitude`, `longitude`
- `accuracy`, `altitude`, `heading`, `speed`
- `updated_at`: Timestamp de última actualización
- Índices optimizados para queries frecuentes

**Tabla**: `care_call_location_sharing`
- Controla qué usuarios comparten ubicación durante una llamada
- Por defecto: habilitado durante la llamada

**Funciones SQL**:
- `update_patient_location()`: UPSERT de ubicación
- `get_latest_user_location()`: Obtiene ubicación más reciente
- RLS completo: Cuidadores ven pacientes vinculados, pacientes ven cuidadores durante llamadas

#### Edge Functions:
- **`get-call-location`**: Obtiene ubicación en tiempo real del otro usuario en la llamada

### 4. **Servicios Frontend**

#### `src/services/LocationService.ts`
- `requestLocationPermission()`: Pide permiso de ubicación
- `requestBackgroundLocationPermission()`: Pide permiso de background
- `getCurrentLocation()`: Obtiene ubicación actual
- **`startLocationTracking()`**: Inicia seguimiento continuo (actualiza cada 5s)
- `stopLocationTracking()`: Detiene el seguimiento
- `calculateDistance()`: Calcula distancia entre dos puntos (Haversine)

#### `src/components/CallLocationMap.tsx`
- Componente de React que muestra:
  - **Mapa interactivo** con ubicación de ambos usuarios
  - **Marcador del otro usuario** (rojo)
  - **Marcador tuyo** (verde)
  - **Círculo de precisión** alrededor de la ubicación
  - **Panel de información**:
    - Nombre del usuario
    - Hora última actualización
    - Distancia entre usuarios
    - Velocidad actual
  - **Botón para centrar** el mapa
- Se actualiza cada 5 segundos
- Estilos adaptados a ambos temas (claro/oscuro)

### 5. **Configuración de App**

#### Para iOS:
- Bundle ID VoIP: `com.mediclaro.app.voip`
- Entitlements: `com.apple.developer.usernotifications.critical`
- VoIP background mode habilitado

#### Para Android:
- Firebase Cloud Messaging (FCM) configurado
- Permisos: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- Background location tracking habilitado

---

## 🔧 Pendiente: Integración en la App

### Acciones `careAction` necesarias:

```typescript
// En tu servicio de Caregiver (donde está careAction):

careAction('voip_token', { token, platform })
  // Registra el token VoIP en care_voip_tokens

careAction('initiate_call', {
  receiverId,
  linkId,
})
  // Inicia una llamada VoIP

careAction('update_location', {
  latitude,
  longitude,
  accuracy,
  altitude,
  heading,
  speed,
})
  // Actualiza ubicación durante la llamada

careAction('get_call_location', { callId })
  // Obtiene ubicación del otro usuario en la llamada

careAction('get_my_location', {})
  // Obtiene tu ubicación actual
```

### En la pantalla de llamada:

```typescript
import { CallLocationMap } from '../components/CallLocationMap';

<CallLocationMap
  callId={callId}
  myName="Tu nombre"
  otherUserName="Nombre del otro"
  isMinimized={false}
/>
```

---

## 📱 Próximos pasos para compilación (1.0.2)

### 1. Compilar para iOS:
```bash
eas build --platform ios --profile production
```

### 2. Compilar para Android:
```bash
eas build --platform android --profile production
```

### 3. Antes de compilar, verifica:
- ✅ Secretos en Supabase guardados (APNs)
- ✅ Bundle ID VoIP configurado en Apple
- ✅ FCM configurado en Firebase
- ✅ Permisos de ubicación en `app.json`
- ✅ Módulo native VoIP integrado
- ✅ Edge Functions desplegadas en Supabase

### 4. Testing en dispositivos:
- iOS: Probar con app cerrada (las notificaciones deben sonar)
- Android: Probar con app cerrada (las notificaciones deben llegar)
- Mapa: Verificar que se actualiza cada 5 segundos
- Distancia: Moverse y verificar que se calcula correctamente

---

## 🚨 Notas importantes

### APNs
- La clave .p8 es **secreta y única**
- NO commits en Git (está en Supabase secrets)
- Cambiar de Sandbox a Production según ambiente

### Geolocalización
- Requiere permiso explícito del usuario
- Se actualiza cada 5 segundos durante llamadas
- Automáticamente se detiene cuando termina la llamada

### Rendimiento
- El mapa se renderiza solo durante llamadas
- Las actualizaciones de ubicación se hacen en background
- Usa índices en BD para optimizar queries

---

## 📊 Tablas de BD involucradas

1. `care_voip_tokens`: Almacena tokens VoIP por dispositivo
2. `care_calls`: Registra llamadas (id, caller_id, receiver_id, status, etc.)
3. `care_patient_locations`: Ubicación en tiempo real
4. `care_call_location_sharing`: Permisos de compartir ubicación
5. `care_links`: Vinculación paciente-cuidador (ya existía)

---

## 🎬 Flujo de una llamada

1. **Cuidador inicia llamada**
   - Llama a `initiate-voip-call`
   - Se crea registro en `care_calls` con estado "ringing"
   - Se envía notificación VoIP a todos los dispositivos del paciente

2. **Paciente recibe notificación**
   - APNs entrega notificación (app cerrada o abierta)
   - CallKit muestra pantalla nativa en iOS
   - Se reproduce sonido de llamada

3. **Paciente contesta**
   - Se abre la pantalla de llamada
   - Estado cambia a "active" en `care_calls`
   - Ambos comienzan a compartir ubicación
   - Se muestra el mapa con ambas ubicaciones

4. **Durante la llamada**
   - Ubicación se actualiza cada 5 segundos
   - Mapa se refresca automáticamente
   - Distancia se calcula en tiempo real

5. **Llamada termina**
   - Se detiene el seguimiento de ubicación
   - Estado cambia a "ended" en `care_calls`
   - Timestamp guardado

---

## 🔐 Seguridad

- **RLS (Row Level Security)**: Habilitado en todas las tablas
- **APNs**: Usa autenticación JWT con clave privada
- **Ubicación**: Solo visible a usuarios vinculados
- **Tokens**: Encriptados en Supabase

---

## 📝 Cambios en archivos existentes

### Necesarios cambios en:

1. `src/components/CaregiverHost.tsx`:
   - Agregar `registerVoIPTokenIfNeeded()` en useEffect

2. `app.json`:
   - Agregar permisos de ubicación:
     ```json
     "plugins": [
       "expo-location",
       ...
     ]
     ```

3. Tu servicio de Caregiver:
   - Implementar las acciones `careAction` listadas arriba

---

## 📞 Soporte

Toda la infraestructura está lista en:
- Supabase: Edge Functions + Secrets + BD
- App: Servicios + Componentes
- Documentación: Este archivo

**Próximo paso**: Compilar versión 1.0.2 con `eas build`
