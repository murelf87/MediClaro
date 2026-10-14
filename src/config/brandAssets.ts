/**
 * Recursos gráficos de marca aportados por el propietario.
 *
 * FOTOGRAFÍA DE BIENVENIDA (pareja de personas mayores de las referencias):
 * no se incluye en el proyecto porque no disponemos del archivo original en
 * alta resolución. Para activarla:
 *   1. Copia la foto (JPG, mínimo 1200×800 px, con derechos de uso) en
 *      assets/images/brand-seniors.jpg
 *   2. Sustituye la línea de abajo por:
 *      export const BRAND_HERO_IMAGE: ImageSourcePropType | null = require('../../assets/images/brand-seniors.jpg');
 * Mientras tanto se muestra una ilustración vectorial de marca.
 */
import type { ImageSourcePropType } from 'react-native';

export const BRAND_HERO_IMAGE: ImageSourcePropType | null = null;
