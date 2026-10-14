/**
 * Componente de mapa integrado en la pantalla de llamada.
 * Muestra la ubicación del otro usuario en tiempo real durante la llamada.
 * Similar a WhatsApp Live Location.
 * Usa WebView + OpenStreetMap (sin react-native-maps — no instalado).
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { careAction } from '../services/CaregiverService';
import { calculateDistance } from '../services/LocationService';

interface CallLocationMapProps {
  callId: string;
  myName: string;
  otherUserName: string;
  isMinimized?: boolean;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  updated_at: string;
  user_id: string;
  user_name?: string;
}

export const CallLocationMap: React.FC<CallLocationMapProps> = ({
  callId,
  myName,
  otherUserName,
  isMinimized = false,
}) => {
  const [otherLocation, setOtherLocation] = useState<LocationData | null>(null);
  const [myLocation, setMyLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const screenHeight = Dimensions.get('window').height;

  // Obtener ubicación en tiempo real cada 5 segundos
  const fetchLocation = useCallback(async () => {
    try {
      const response = await careAction('get_call_location', { callId });
      if (response?.latitude && response?.longitude) {
        setOtherLocation(response);
        setError(null);

        // Calcular distancia si tenemos ambas ubicaciones
        if (myLocation) {
          const dist = calculateDistance(
            myLocation.latitude,
            myLocation.longitude,
            response.latitude,
            response.longitude
          );
          setDistance(dist);
        }
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setError('Ubicación no disponible');
    } finally {
      setLoading(false);
    }
  }, [callId, myLocation]);

  // Obtener mi ubicación actual
  const fetchMyLocation = useCallback(async () => {
    try {
      const response = await careAction('get_my_location', {});
      if (response?.latitude && response?.longitude) {
        setMyLocation(response);
      }
    } catch (err) {
      console.error('Error fetching my location:', err);
    }
  }, []);

  // Cargar ubicaciones al montar
  useFocusEffect(
    useCallback(() => {
      fetchMyLocation();
      fetchLocation();

      // Actualizar ubicación cada 5 segundos
      const interval = setInterval(() => {
        fetchMyLocation();
        fetchLocation();
      }, 5000);

      return () => clearInterval(interval);
    }, [fetchLocation, fetchMyLocation])
  );

  if (isMinimized) {
    return (
      <View style={styles.minimizedContainer}>
        <Text style={styles.minimizedText}>
          📍 Ubicación compartida en directo
        </Text>
      </View>
    );
  }

  if (loading && !otherLocation) {
    return (
      <View style={[styles.container, { height: screenHeight * 0.4 }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Cargando ubicación...</Text>
      </View>
    );
  }

  if (error && !otherLocation) {
    return (
      <View style={[styles.container, { height: screenHeight * 0.4 }]}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <Text style={styles.errorSubtext}>
          El usuario aún no ha compartido su ubicación.
        </Text>
      </View>
    );
  }

  if (!otherLocation) {
    return null;
  }

  // HTML para OpenStreetMap con Leaflet vía CDN
  const mapHtml = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>html,body,#map{width:100%;height:100%;margin:0;padding:0}</style>
</head><body>
<div id="map"></div>
<script>
const lat=${otherLocation.latitude},lon=${otherLocation.longitude};
const map=L.map('map').setView([lat,lon],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
const redIcon=L.icon({iconUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',iconSize:[25,41],iconAnchor:[12,41]});
L.marker([lat,lon],{icon:redIcon}).addTo(map).bindPopup('${otherUserName.replace(/'/g,"\\'")}').openPopup();
${myLocation ? `L.marker([${myLocation.latitude},${myLocation.longitude}]).addTo(map).bindPopup('${myName.replace(/'/g,"\\'")} (tú)');` : ''}
</script></body></html>`;

  return (
    <View style={styles.mapContainer}>
      <WebView
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        originWhitelist={['*']}
      />

      {/* Info panel flotante */}
      <View style={styles.infoPanel}>
        <View style={styles.infoPanelContent}>
          <View style={styles.userInfo}>
            <View
              style={[styles.statusDot, { backgroundColor: '#ef4444' }]}
            />
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>{otherUserName}</Text>
              <Text style={styles.updateTime}>
                Actualizado hace {getTimeAgo(otherLocation.updated_at)}
              </Text>
            </View>
          </View>

          {distance !== null && (
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceLabel}>Distancia</Text>
              <Text style={styles.distanceValue}>
                {distance < 1
                  ? `${Math.round(distance * 1000)} m`
                  : `${distance.toFixed(1)} km`}
              </Text>
            </View>
          )}

          {otherLocation.speed !== null && otherLocation.speed !== undefined && (
            <View style={styles.speedContainer}>
              <Text style={styles.speedLabel}>Velocidad</Text>
              <Text style={styles.speedValue}>
                {(otherLocation.speed * 3.6).toFixed(0)} km/h
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Botón para centrar en la ubicación */}
      <TouchableOpacity style={styles.centerButton}>
        <Text style={styles.centerButtonText}>📍</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Formatea el tiempo transcurrido desde la última actualización
 */
function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diff < 30) return 'ahora';
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginVertical: 10,
  },
  map: {
    flex: 1,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginVertical: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  errorSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 5,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  infoPanelContent: {
    flexDirection: 'row',
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  updateTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  distanceContainer: {
    alignItems: 'center',
    marginLeft: 15,
  },
  distanceLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  distanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  speedContainer: {
    alignItems: 'center',
    marginLeft: 15,
  },
  speedLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  speedValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
  },
  centerButton: {
    position: 'absolute',
    bottom: 80,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  centerButtonText: {
    fontSize: 20,
  },
  minimizedContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    marginVertical: 5,
  },
  minimizedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
});
