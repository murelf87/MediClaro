import * as Speech from 'expo-speech';
import { deviceVoiceGender, deviceVoiceQuality, genderOfVoice, hasDeviceVoice, pickDeviceVoice, speakOnDevice } from '../../utils/deviceSpeech';
const voice=(identifier:string,language:string,quality='Default')=>({identifier,name:identifier,language,quality:quality as Speech.VoiceQuality});
beforeEach(()=>jest.spyOn(Speech,'speak').mockImplementation(()=>undefined as any));
afterEach(()=>jest.restoreAllMocks());
test('selects enhanced Spain Spanish among installed voices',async()=>{
 jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([voice('en','en-US','Enhanced'),voice('basic','es-ES'),voice('mx','es-MX','Enhanced'),voice('best','es-ES','Enhanced')]);
 await speakOnDevice('hola',0.85,()=>true,{});
 expect(Speech.speak).toHaveBeenCalledWith('hola',expect.objectContaining({voice:'best',language:'es-ES'}));
});
test('missing voice inventory still lets the system choose Spanish',async()=>{
 jest.spyOn(Speech,'getAvailableVoicesAsync').mockRejectedValue(new Error('unavailable'));
 await speakOnDevice('hola',0.85,()=>true,{});
 expect(Speech.speak).toHaveBeenCalledWith('hola',expect.objectContaining({language:'es-ES'}));
 expect((Speech.speak as jest.Mock).mock.calls[0][1].voice).toBeUndefined();
});
test('cancelled request never starts device speech',async()=>{
 jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([]);
 await speakOnDevice('hola',0.85,()=>false,{});
 expect(Speech.speak).not.toHaveBeenCalled();
});

test('premium voices (reported by iOS as Default) win over enhanced ones',async()=>{
 jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([voice('com.apple.voice.enhanced.es-ES.Monica','es-ES','Enhanced'),voice('com.apple.voice.premium.es-ES.Marisol','es-ES'),voice('com.apple.voice.compact.es-ES.Jorge','es-ES')]);
 await speakOnDevice('hola',0.85,()=>true,{});
 expect(Speech.speak).toHaveBeenCalledWith('hola',expect.objectContaining({voice:'com.apple.voice.premium.es-ES.Marisol'}));
});
test('never picks robotic Eloquence voices; prefers the normal Spanish voice over them',async()=>{
 jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([voice('com.apple.eloquence.es-ES.Eddy','es-ES'),voice('com.apple.eloquence.es-ES.Flo','es-ES'),voice('com.apple.voice.compact.es-ES.Monica','es-ES')]);
 await speakOnDevice('hola',0.85,()=>true,{});
 expect(Speech.speak).toHaveBeenCalledWith('hola',expect.objectContaining({voice:'com.apple.voice.compact.es-ES.Monica'}));
});
test('only robotic voices installed: lets the system choose its default Spanish voice',async()=>{
 jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([voice('com.apple.eloquence.es-ES.Eddy','es-ES')]);
 await speakOnDevice('hola',0.85,()=>true,{});
 expect((Speech.speak as jest.Mock).mock.calls[0][1].voice).toBeUndefined();
});

test('panel «Revisar la app»: qué voz del teléfono se usaría y con qué calidad',()=>{
 const voices=[voice('com.apple.voice.compact.es-ES.Jorge','es-ES'),voice('com.apple.voice.premium.es-ES.Marisol','es-ES'),voice('com.apple.voice.enhanced.es-MX.Paulina','es-MX','Enhanced')];
 const best=pickDeviceVoice(voices);
 expect(best?.identifier).toBe('com.apple.voice.premium.es-ES.Marisol');
 expect(deviceVoiceQuality(best!)).toBe('Premium');
 expect(deviceVoiceQuality(voices[2])).toBe('Mejorada');
 expect(deviceVoiceQuality(voices[0])).toBe('Normal');
 expect(pickDeviceVoice([voice('com.apple.eloquence.es-ES.Eddy','es-ES'),voice('en','en-US','Enhanced')])).toBeUndefined();
});

describe('voz de mujer o de hombre (la elige cada persona)', () => {
  const ios = [
    voice('com.apple.voice.compact.es-ES.Monica', 'es-ES'),
    voice('com.apple.voice.premium.es-ES.Marisol', 'es-ES'),
    voice('com.apple.voice.compact.es-ES.Jorge', 'es-ES'),
    voice('com.apple.voice.enhanced.es-MX.Juan', 'es-MX', 'Enhanced'),
    voice('com.apple.eloquence.es-ES.Eddy', 'es-ES'),
  ];
  test('se reconoce por el nombre de la voz (con o sin tilde)', () => {
    expect(deviceVoiceGender(voice('com.apple.voice.compact.es-ES.Monica', 'es-ES'))).toBe('female');
    expect(deviceVoiceGender({ identifier: 'x', name: 'Mónica', language: 'es-ES', quality: 'Default' as Speech.VoiceQuality })).toBe('female');
    expect(deviceVoiceGender(voice('com.apple.voice.compact.es-ES.Jorge', 'es-ES'))).toBe('male');
    expect(deviceVoiceGender(voice('es-es-x-eea-local', 'es-ES'))).toBeNull();
  });
  test('Sulafat busca voz de mujer; Achird, de hombre (de España antes que de otros países)', () => {
    expect(genderOfVoice('Sulafat')).toBe('female');
    expect(genderOfVoice('Achird')).toBe('male');
    expect(pickDeviceVoice(ios, 'female')?.name).toBe('com.apple.voice.premium.es-ES.Marisol');
    expect(pickDeviceVoice(ios, 'male')?.name).toBe('com.apple.voice.compact.es-ES.Jorge');
    expect(hasDeviceVoice(ios, 'male')).toBe(true);
  });
  test('si el teléfono no tiene voz del tipo elegido, se usa la mejor que tenga', () => {
    const onlyWomen = [voice('com.apple.voice.premium.es-ES.Marisol', 'es-ES')];
    expect(hasDeviceVoice(onlyWomen, 'male')).toBe(false);
    expect(pickDeviceVoice(onlyWomen, 'male')?.name).toBe('com.apple.voice.premium.es-ES.Marisol');
  });
  test('al leer con la voz del teléfono se usa la del tipo elegido', async () => {
    jest.spyOn(Speech, 'getAvailableVoicesAsync').mockResolvedValue(ios);
    await speakOnDevice('hola', 0.85, () => true, {}, 'male');
    expect(Speech.speak).toHaveBeenCalledWith('hola', expect.objectContaining({ voice: 'com.apple.voice.compact.es-ES.Jorge' }));
  });
});
