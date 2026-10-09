import * as Speech from 'expo-speech';
import { speakOnDevice } from '../../utils/deviceSpeech';
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
