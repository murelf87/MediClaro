/**
 * Foto de homenaje de la entrada (la familia del propietario de MediClaro).
 *
 * Para poner las fotos:
 *  1. Copia las fotos en `assets/images/homenaje/` (JPG, mejor horizontales, de 1600 px de ancho como mucho).
 *  2. Añádelas aquí, en el orden en que deben salir:
 *       fotos: [
 *         { source: require('../../assets/images/homenaje/familia-1.jpg'), descripcion: 'Foto de homenaje a nuestra familia' },
 *       ],
 *  3. Con más de una foto, van cambiando solas cada 6 segundos con un fundido suave (si el teléfono tiene
 *     «Reducir movimiento», se queda la primera).
 *
 * Mientras `fotos` esté vacío, en las pruebas sale un marco con «Aquí irá vuestra foto» y en la versión de las
 * tiendas no sale nada (la entrada queda como siempre). `node scripts/release-check.mjs` avisa si falta.
 */
import type { ImageSourcePropType } from 'react-native';

export interface HomenajeFoto {
  source: ImageSourcePropType;
  /** Lo que lee el lector de pantalla (VoiceOver / TalkBack). */
  descripcion: string;
}

export const HOMENAJE: {
  fotos: HomenajeFoto[];
  /** Frase opcional sobre la foto (por ejemplo «Con cariño, a nuestra familia»). null = sin frase. */
  dedicatoria: string | null;
} = {
  fotos: [
    {
      source: require('../../assets/images/homenaje/isabel-y-jose.jpg'),
      descripcion: 'Isabel y José, abrazados y sonriendo: ella con un rosario en la mano y él con su caña de pescar.',
    },
  ],
  dedicatoria: null,
};
