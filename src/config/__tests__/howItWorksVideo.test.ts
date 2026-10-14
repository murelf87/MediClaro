import { parseVideoUrl } from '../app';

describe('parseVideoUrl (EXPO_PUBLIC_HOW_IT_WORKS_VIDEO_URL)', () => {
  it('sin URL no hay vídeo (ningún acceso en la app)', () => {
    expect(parseVideoUrl(undefined)).toBe('');
    expect(parseVideoUrl('')).toBe('');
    expect(parseVideoUrl('   ')).toBe('');
  });
  it('acepta una URL https pública (recortando espacios)', () => {
    expect(parseVideoUrl(' https://cdn.mediclaro.es/video/como-funciona.mp4 ')).toBe('https://cdn.mediclaro.es/video/como-funciona.mp4');
  });
  it('acepta localhost para las pruebas', () => {
    expect(parseVideoUrl('http://localhost:9300/video/como-funciona.mp4')).toBe('http://localhost:9300/video/como-funciona.mp4');
  });
  it('rechaza esquemas no seguros, rutas relativas y texto suelto', () => {
    expect(parseVideoUrl('http://cdn.mediclaro.es/video.mp4')).toBe('');
    expect(parseVideoUrl('javascript:alert(1)')).toBe('');
    expect(parseVideoUrl('/video/como-funciona.mp4')).toBe('');
    expect(parseVideoUrl('como-funciona.mp4')).toBe('');
  });
});
