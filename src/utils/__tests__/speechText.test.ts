import { endWithPause, limitSpeechParts, prepareSpeechText } from '../speechText';

describe('Texto para la voz natural', () => {
  test.each([
    ['Tome 1 comprimido de 1 g cada 6-8 horas, sin pasar de 3 g/día.', 'Tome 1 comprimido de 1 gramo cada 6 a 8 horas, sin pasar de 3 gramos por día.'],
    ['Paracetamol 500mg c/8h.', 'Paracetamol 500 miligramos cada 8 horas.'],
    ['Jarabe 250 mg/5 ml.', 'Jarabe 250 miligramos por cada 5 mililitros.'],
    ['Solución 100 mg/ml.', 'Solución 100 miligramos por mililitro.'],
    ['0,5 mg; 1 mg; 1,5 g; 1000 UI; 30 min; 5 %; 1000 mcg', '0,5 miligramos; 1 miligramo; 1,5 gramos; 1000 unidades internacionales; 30 minutos; 5 por ciento; 1000 microgramos'],
    ['Si te encuentras mal, llama al 112 o acude a urgencias.', 'Si te encuentras mal, llama al uno, uno, dos o acude a urgencias.'],
    ['El teléfono 024 atiende 24 h.', 'El teléfono cero, dos, cuatro atiende 24 horas.'],
    ['Toma aprox. 2 comprimidos, p. ej. con el desayuno, etc. Después descansa.', 'Toma aproximadamente 2 comprimidos, por ejemplo con el desayuno, etcétera. Después descansa.'],
  ])('%s', (input, expected) => {
    expect(prepareSpeechText(input)).toBe(expected);
  });

  test('una dosis de 112 microgramos NO se lee como el teléfono de emergencias', () => {
    expect(prepareSpeechText('Eutirox 112 mcg comprimidos')).toBe('Eutirox 112 microgramos comprimidos');
    expect(prepareSpeechText('Toma el 112 mcg por la mañana')).toBe('Toma el 112 microgramos por la mañana');
  });

  test('no toca fechas, teléfonos, direcciones ni vitaminas', () => {
    const text = 'Llamada del 08-10-2026 al teléfono 91-562-04-20. Vivo en c/ Mayor 5. Vitamina B12.';
    expect(prepareSpeechText(text)).toBe(text);
  });

  test('quita el formato y deja una pausa al final de cada línea de una lista', () => {
    expect(prepareSpeechText('**Importante**: no lo tomes con alcohol.\n- Bebe agua\n• Consulta a tu médico'))
      .toBe('Importante: no lo tomes con alcohol. Bebe agua. Consulta a tu médico');
  });

  test('no lee enlaces ni emojis en voz alta', () => {
    expect(prepareSpeechText('Puedes consultarlo en https://cima.aemps.es/cima/dochtml/p/68339/P_68339.html. ¡Ánimo! 😊👍'))
      .toBe('Puedes consultarlo en el enlace. ¡Ánimo!');
    expect(prepareSpeechText('Fuente oficial (www.aemps.gob.es) ✅ revisada.')).toBe('Fuente oficial revisada.');
  });

  test('es idempotente (se puede aplicar dos veces)', () => {
    const once = prepareSpeechText('Paracetamol 1 g c/8 h, máx. 3 g/día. Llama al 112. Jarabe 250 mg/5 ml, 5 %.');
    expect(prepareSpeechText(once)).toBe(once);
  });

  test('endWithPause añade el punto solo si falta', () => {
    expect(endWithPause('Qué es')).toBe('Qué es.');
    expect(endWithPause('¿Para qué sirve?')).toBe('¿Para qué sirve?');
  });
});

describe('Lectura continua limitada', () => {
  test('incluye apartados completos en orden y avisa si deja alguno fuera', () => {
    expect(limitSpeechParts(['Uno. Dos.', 'Tres cuatro.', 'Cinco.'], 22)).toEqual({ parts: ['Uno. Dos.', 'Tres cuatro.'], truncated: true });
    expect(limitSpeechParts(['Uno.', 'Dos.'], 100)).toEqual({ parts: ['Uno.', 'Dos.'], truncated: false });
  });

  test('si el primer apartado ya es largo, corta al final de una frase (nunca a mitad de palabra)', () => {
    const { parts, truncated } = limitSpeechParts(['Frase uno larga. Frase dos larga. Frase tres larga.'], 36);
    expect(truncated).toBe(true);
    expect(parts).toEqual(['Frase uno larga. Frase dos larga.']);
  });

  test('sin final de frase, corta en un espacio y termina con pausa', () => {
    const { parts } = limitSpeechParts(['palabras sencillas sin puntos que siguen y siguen'], 20);
    expect(parts[0]).toBe('palabras sencillas.');
    expect(parts[0]).not.toMatch(/senci$/);
  });
});
