# 📱 Guía de Integración - VoIP + Geolocalización

**Fecha**: 14 de octubre de 2026  
**Estado**: Código integrado - Listo para conectar en pantallas

---

## 🎯 Resumen

Se han creado todos los servicios y funciones necesarias. Ahora solo falta conectarlos en las pantallas donde se usan.

---

## 📁 Archivos creados/modificados

### Servicios
- ✅ `src/services/CaregiverService.ts` - **Punto único de acceso** a todas las acciones
- ✅ `src/services/LocationService.ts` - Captura de ubicación en tiempo real
- ✅ `src/api/voipFunctions.ts` - Funciones que llaman a Edge Functions

### Componentes
- ✅ `src/components/CallLocationMap.tsx` - Mapa integrado en pantalla de llamada

### Edge Functions
- ✅ `supabase/functions/send-voip-call/` - Envía notificaciones APNs/FCM
- ✅ `supabase/functions/initiate-voip-call/` - Inicia llamada
- ✅ `supabase/functions/get-call-location/` - Obtiene ubicación en tiempo real
- ✅ `supabase/functions/update-patient-location/` - Actualiza ubicación
- ✅ `supabase/functions/get-user-location/` - Obtiene ubicación actual

### Base de Datos
- ✅ `supabase/migrations/20261014230000_patient_location_realtime.sql` - Tablas de ubicación

---

## 🔌 Cómo integrar en las pantallas

### 1. Registrar token VoIP al arrancar la app

**Archivo**: `src/components/CaregiverHost.tsx` o donde inicia tu app

```typescript
import { useEffect } from 'react';
import { careAction } from '../services';
import { registerVoIPTokenIfNeeded } from '../services/CareVoIPService';
import { Platform } from 'react-native';

export function CaregiverHost() {
  useEffect(() => {
    // Registrar token VoIP al arrancar
    const setupVoIP = async () => {
      try {
        // Método 1: Si tienes CareVoIPService
        await registerVoIPTokenIfNeeded();
        
        // O Método 2: Manual con careAction
        // const token = await getExpoPushToken();
        // await careAction('voip_token', {
        //   token,
        //   platform: Platform.OS === 'ios' ? 'ios' : 'android',
        // });
      } catch (error) {
        console.error('Error setting up VoIP:', error);
      }
    };

    setupVoIP();
  }, []);

  return (
    // Tu componente
  );
}
```

---

### 2. Iniciar una llamada VoIP

**Archivo**: Tu pantalla de cuidador (o donde hay botón "Llamar")

```typescript
import { careAction } from '../services';
import { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

export function CaregiverPatientsScreen() {
  const [calling, setCalling] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);

  const handleStartCall = async (patientId: string, linkId: string) => {
    setCalling(true);
    try {
      const result = await careAction('initiate_call', {
        receiverId: patientId,
        linkId,
      });

      if (result.success) {
        console.log('✅ Llamada iniciada:', result.callId);
        setCallId(result.callId);
        
        // Navegar a pantalla de llamada
        navigation.navigate('Call', {
          callId: result.callId,
          patientId,
          patientName: 'Nombre del paciente',
        });
      } else {
        console.error('❌ Error iniciando llamada');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCalling(false);
    }
  };

  return (
    <TouchableOpacity 
      onPress={() => handleStartCall(patientId, linkId)}
      disabled={calling}
    >
      {calling ? (
        <ActivityIndicator />
      ) : (
        <Text>Llamar</Text>
      )}
    </TouchableOpacity>
  );
}
```

---

### 3. Mostrar mapa durante la llamada

**Archivo**: Tu pantalla de llamada (CallScreen o InCallScreen)

```typescript
import { CallLocationMap } from '../components/CallLocationMap';
import { startLocationTracking, stopLocationTracking } from '../services/LocationService';
import { careAction } from '../services';
import { useEffect } from 'react';

export function CallScreen({ route }) {
  const { callId, patientId, patientName } = route.params;
  const [myName, setMyName] = useState('');

  useEffect(() => {
    // Obtener tu nombre del perfil
    const loadMyProfile = async () => {
      // const profile = await ProfileService.getProfile();
      // setMyName(profile.name);
    };

    loadMyProfile();

    // Iniciar seguimiento de ubicación cuando comienza la llamada
    startLocationTracking();

    // Registrar que estás compartiendo ubicación
    careAction('start_location_sharing', { callId });

    return () => {
      // Detener seguimiento cuando termina la llamada
      stopLocationTracking();
      careAction('stop_location_sharing', { callId });
    };
  }, [callId]);

  return (
    <View style={{ flex: 1 }}>
      {/* Controles de llamada */}
      <View style={{ flex: 1, padding: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>
          Llamada con {patientName}
        </Text>

        {/* MAPA INTEGRADO */}
        <CallLocationMap
          callId={callId}
          myName={myName}
          otherUserName={patientName}
          isMinimized={false}
        />

        {/* Botones de control */}
        <View style={{ marginTop: 20 }}>
          {/* Botón de aceptar/rechazar/colgar */}
        </View>
      </View>
    </View>
  );
}
```

---

## 🎬 Flujo completo de una llamada

```
1. App arranca
   ↓ Registra token VoIP
   ↓ CaregiverService.careAction('voip_token', ...)

2. Cuidador inicia llamada
   ↓ Clic en "Llamar"
   ↓ careAction('initiate_call', { receiverId, linkId })
   ↓ Abre pantalla de llamada con callId

3. Paciente recibe notificación
   ↓ APNs/FCM entrega notificación
   ↓ App se abre (o CallKit en iOS)
   ↓ Paciente ve pantalla nativa de llamada

4. Paciente contesta
   ↓ Se abre CallScreen
   ↓ Automáticamente:
      - startLocationTracking() comienza
      - careAction('start_location_sharing', { callId })
      - <CallLocationMap> se muestra

5. Durante la llamada
   ↓ LocationService actualiza ubicación cada 5s
   ↓ careAction('update_location', {...})
   ↓ CallLocationMap se refresca cada 5s
   ↓ careAction('get_call_location', { callId })

6. Llamada termina
   ↓ stopLocationTracking()
   ↓ careAction('stop_location_sharing', { callId })
   ↓ Se cierra CallScreen
```

---

## 🔧 API completo de careAction

```typescript
import { careAction } from '../services';

// ============ Registrar token VoIP ============
await careAction('voip_token', {
  token: 'ExponentPushToken[...]',
  platform: 'ios' // o 'android'
});

// ============ Iniciar llamada ============
const result = await careAction('initiate_call', {
  receiverId: 'uuid-del-paciente',
  linkId: 'uuid-del-vinculo'
});
// Retorna: { success, callId, tokensSent, tokensFailed }

// ============ Obtener ubicación en llamada ============
const location = await careAction('get_call_location', {
  callId: 'uuid-de-llamada'
});
// Retorna: { latitude, longitude, accuracy, updated_at, user_name }

// ============ Actualizar mi ubicación ============
await careAction('update_location', {
  latitude: 40.4168,
  longitude: -3.7038,
  accuracy: 10,
  altitude: 600,
  heading: 45,
  speed: 5.5
});

// ============ Obtener mi ubicación actual ============
const myLocation = await careAction('get_my_location', {});
// Retorna: { latitude, longitude, accuracy, ... }

// ============ Iniciar compartición de ubicación ============
await careAction('start_location_sharing', {
  callId: 'uuid-de-llamada'
});

// ============ Detener compartición de ubicación ============
await careAction('stop_location_sharing', {
  callId: 'uuid-de-llamada'
});
```

---

## ⚙️ Permisos necesarios en `app.json`

```json
{
  "app": {
    "plugins": [
      "expo-location",
      "expo-notifications",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "MediClaro necesita tu ubicación para mostrarla durante las llamadas de cuidado.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "MediClaro necesita tu ubicación en segundo plano durante las llamadas de cuidado.",
        "UIRequiredDeviceCapabilities": [
          "voip"
        ]
      }
    },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ]
    }
  }
}
```

---

## 🧪 Testing

### Test básico:
1. Inicia la app
2. Verifica que `careAction('voip_token', ...)` se ejecuta sin error
3. Intenta iniciar una llamada
4. Verifica que se recibe la notificación (aunque la app esté cerrada)
5. Contesta la llamada
6. Verifica que el mapa aparece
7. Muévete y verifica que la distancia cambia

### En Android:
- Usa 2 dispositivos o emuladores
- Uno para cuidador, otro para paciente
- Verifica que FCM entrega la notificación

### En iOS:
- Usa iPhone real o simulator
- Verifica que APNs entrega la notificación
- Verifica que CallKit muestra pantalla nativa

---

## 🚀 Siguientes pasos

1. ✅ **Integra los servicios** en tus pantallas (pasos 1-3 arriba)
2. ⏳ **Añade permisos** en `app.json`
3. ⏳ **Test en dispositivos** (iOS y Android)
4. ⏳ **Compila versión 1.0.2** con `eas build`

---

## 💡 Notas

- `careAction` es el punto único de acceso a TODAS las operaciones
- LocationService se usa SOLO para capturar ubicación (LocationService.startLocationTracking())
- CallLocationMap se usa SOLO para mostrar el mapa
- El resto del trabajo lo hace CaregiverService internamente

---

## 🆘 Troubleshooting

**Error: "careAction is not a function"**
- Verifica que importas: `import { careAction } from '../services'`

**Ubicación no se actualiza**
- Verifica que LocationService.startLocationTracking() se llama
- Verifica permisos en dispositivo (Ajustes → MediClaro → Ubicación)

**Mapa no se muestra**
- Verifica que react-native-maps está instalado
- Verifica que Google Maps API key está configurada (Android)

**Notificación no llega**
- iOS: Verifica que APNs secrets están en Supabase
- Android: Verifica que FCM está configurado

---

**¿Necesitas ayuda con alguno de estos pasos?** 🎯
