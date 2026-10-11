import * as Speech from 'expo-speech';
import { deviceVoiceQuality, pickDeviceVoice, speakOnDevice } from '../../utils/deviceSpeech';
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
