import React from 'react';
import { act, create } from 'react-test-renderer';
const mockSynthesize=jest.fn();
const mockConfigure=jest.fn(async()=>undefined);
let mockListener: (s:any)=>void;
// Igual que el reproductor real de expo-audio 57: «playbackRate» es SOLO DE LECTURA (asignarlo lanza un error) y la
// velocidad se cambia con setPlaybackRate(). Así una regresión vuelve a fallar aquí y no solo en el teléfono.
const mockPlayer:any={play:jest.fn(),pause:jest.fn(),remove:jest.fn(),setPlaybackRate:jest.fn(),shouldCorrectPitch:false,addListener:jest.fn((_:string,fn:any)=>{mockListener=fn;return {remove:jest.fn()};})};
Object.defineProperty(mockPlayer,'playbackRate',{get:()=>1,enumerable:true});
jest.mock('../../services',()=>({SpeechService:{synthesize:(...a:any[])=>mockSynthesize(...a)}}));
jest.mock('../../utils/audio',()=>({configureAudioForSpeech:()=>mockConfigure()}));
jest.mock('../../utils/dialogs',()=>({showAlert:jest.fn(async()=>undefined)}));
jest.mock('expo-audio',()=>({createAudioPlayer:()=>mockPlayer}),{virtual:true});
const mockReport=jest.fn(async()=>({ref:'E-TEST1'}));
jest.mock('../../services/ProblemReportService',()=>({ProblemReportService:{send:(...a:any[])=>mockReport(...a)}}));
import * as Speech from 'expo-speech';
import { DEVICE_FALLBACK_INTRO, useGeminiContinuousSpeech, useGeminiSectionSpeech, useGeminiSimpleSpeech } from '../useSpeech';
import { VoiceSettings } from '../../services/VoiceSettings';
import { __resetVoiceDiagnostics, clearVoiceFailure, lastVoiceFailure } from '../../services/VoiceDiagnostics';
let output:any;let tree:any;
const sections=[{id:'a',title:'A',text:'one'},{id:'b',title:'B',text:'two'}];
const readingParts=['Qué es. Un analgésico.','Para qué sirve. Para el dolor.'];
function Probe({voice='Sulafat',simple=false,continuous=false,phone}:any){output=continuous?useGeminiContinuousSpeech(readingParts,0.85,voice,phone):simple?useGeminiSimpleSpeech():useGeminiSectionSpeech(sections,0.85,voice);return null;}
async function mount(props:any={}){await act(async()=>{tree=create(React.createElement(Probe,props));});}
beforeEach(()=>{jest.spyOn(Speech, 'speak').mockImplementation(()=>undefined as any);jest.spyOn(Speech, 'getAvailableVoicesAsync').mockResolvedValue([{identifier:'es-premium',name:'Spanish',language:'es-ES',quality:'Enhanced' as any}]);(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mockSynthesize.mockReset();mockConfigure.mockReset().mockResolvedValue(undefined);mockReport.mockClear();__resetVoiceDiagnostics();[mockPlayer.play,mockPlayer.pause,mockPlayer.remove,mockPlayer.addListener,mockPlayer.setPlaybackRate].forEach((f:any)=>f.mockClear());});
beforeEach(async()=>{await clearVoiceFailure();});
afterEach(()=>VoiceSettings.__reset());
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());tree=null;jest.restoreAllMocks();jest.useRealTimers();});
describe('Natural speech lifecycle',()=>{
 test('preparation is loading; speaking requires real playback',async()=>{
  mockSynthesize.mockResolvedValue({uri:'one.wav',cleanup:jest.fn()});await mount();await act(async()=>output.play());expect(output.status).toBe('loading');
  await act(async()=>mockListener({playing:true}));expect(output.status).toBe('speaking');await act(async()=>output.pause());expect(output.status).toBe('paused');expect(mockPlayer.pause).toHaveBeenCalled();
 });
 test('late audio cannot play after stop',async()=>{
  let resolve:any;const cleanup=jest.fn();mockSynthesize.mockReturnValue(new Promise(r=>resolve=r));await mount();await act(async()=>output.play());await act(async()=>output.stop());
  await act(async()=>resolve({uri:'late.wav',cleanup}));expect(mockPlayer.play).not.toHaveBeenCalled();expect(cleanup).toHaveBeenCalled();expect(output.status).toBe('idle');
 });
 test('pause during preparation can resume with fresh audio',async()=>{
  let resolve:any;mockSynthesize.mockReturnValueOnce(new Promise(r=>resolve=r));await mount();await act(async()=>output.play());await act(async()=>output.pause());
  const cleanup=jest.fn();await act(async()=>resolve({uri:'late.wav',cleanup}));expect(cleanup).toHaveBeenCalled();mockSynthesize.mockResolvedValue({uri:'new.wav',cleanup:jest.fn()});await act(async()=>output.play());expect(mockPlayer.play).toHaveBeenCalled();expect(output.status).toBe('loading');
 });
 test('medication reading never falls back to the installed robotic voice',async()=>{
  mockSynthesize.mockRejectedValue(new Error('offline'));await mount();await act(async()=>output.play());
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(output.status).toBe('error');
 });
 test('completion advances only after audio ends',async()=>{
  mockSynthesize.mockResolvedValue({uri:'a.wav',cleanup:jest.fn()});await mount();await act(async()=>output.play());await act(async()=>mockListener({playing:true}));expect(output.index).toBe(0);await act(async()=>mockListener({didJustFinish:true}));expect(output.index).toBe(1);expect(output.status).toBe('loading');
 });
 test('voice change uses new selection',async()=>{
  mockSynthesize.mockResolvedValue({uri:'a.wav',cleanup:jest.fn()});await mount();await act(async()=>output.play());await act(async()=>tree.update(React.createElement(Probe,{voice:'Achird'})));expect(mockSynthesize).toHaveBeenLastCalledWith('A. one','Achird','reading');
 });
 test('resume waits for confirmed playback and supports a second pause',async()=>{
  mockSynthesize.mockResolvedValue({uri:'a.wav',cleanup:jest.fn()});await mount();await act(async()=>output.play());await act(async()=>mockListener({playing:true}));await act(async()=>output.pause());await act(async()=>output.play());expect(output.status).toBe('loading');await act(async()=>output.pause());await act(async()=>output.play());await act(async()=>mockListener({playing:true}));expect(output.status).toBe('speaking');
 });
 test('voice change while paused preserves the pause',async()=>{
  mockSynthesize.mockResolvedValue({uri:'a.wav',cleanup:jest.fn()});await mount();await act(async()=>output.play());await act(async()=>mockListener({playing:true}));await act(async()=>output.pause());mockSynthesize.mockClear();await act(async()=>tree.update(React.createElement(Probe,{voice:'Achird'})));expect(output.status).toBe('paused');expect(mockSynthesize).not.toHaveBeenCalled();await act(async()=>output.play());expect(mockSynthesize).toHaveBeenCalledWith('A. one','Achird','reading');
 });
 test('simple voice preparation does not claim playback',async()=>{
  mockSynthesize.mockResolvedValue({uri:'a.wav',cleanup:jest.fn()});await mount({simple:true});await act(async()=>output.speak('x','hello',0.85,'Achird'));expect(output.loadingId).toBe('x');expect(output.speakingId).toBeNull();await act(async()=>mockListener({playing:true}));expect(output.speakingId).toBe('x');expect(output.loadingId).toBeNull();
 });
 test('assistant reply is still read with the best installed Spanish voice when natural synthesis fails',async()=>{
  mockSynthesize.mockRejectedValue(new Error('offline'));await mount({simple:true});await act(async()=>output.speak('x','hola'));
  expect(Speech.speak).toHaveBeenCalledWith('hola',expect.objectContaining({voice:'es-premium',language:'es-ES'}));
  expect(output.speakingId).toBe('x');expect(output.loadingId).toBeNull();
  const opts=(Speech.speak as jest.Mock).mock.calls[0][1];await act(async()=>opts.onDone());expect(output.speakingId).toBeNull();
 });
 test('a voice test that fails never stays silent: the phone voice reads it, saying first it is not the natural voice',async()=>{
  mockSynthesize.mockRejectedValue(new Error('offline'));await mount({simple:true});await act(async()=>output.speak('x','hola',0.85,'Sulafat','preview'));
  expect(Speech.speak).toHaveBeenCalledWith(`${DEVICE_FALLBACK_INTRO} hola`,expect.objectContaining({voice:'es-premium',language:'es-ES'}));
  expect(output.speakingId).toBe('x');expect(output.loadingId).toBeNull();
  const opts=(Speech.speak as jest.Mock).mock.calls[0][1];await act(async()=>opts.onDone());expect(output.speakingId).toBeNull();
 });
 test('a failed voice test records WHERE it failed (step, time and reason) for «Revisar la app»',async()=>{
  mockSynthesize.mockRejectedValue(new Error('HTTP 503'));await mount({simple:true});await act(async()=>output.speak('x','hola',0.85,'Achird','preview'));
  const failure=await lastVoiceFailure();
  expect(failure?.text).toContain('Achird, prueba de voz');
  expect(failure?.text).toContain('el servidor no ha devuelto la voz: HTTP 503');
  expect(failure?.text).toMatch(/inicio 0,\d s → audio \d+,\d s → servidor \d+,\d s/);
  expect(failure?.text).not.toContain('hola');
 });
 test('a voice test that never arrives switches to the phone voice after 20 s and ignores late audio',async()=>{
  jest.useFakeTimers();let resolve:any;const cleanup=jest.fn();mockSynthesize.mockReturnValue(new Promise(r=>resolve=r));
  await mount({simple:true});await act(async()=>output.speak('x','hola',0.85,'Sulafat','preview'));
  await act(async()=>jest.advanceTimersByTime(19000));expect(Speech.speak).not.toHaveBeenCalled();
  await act(async()=>jest.advanceTimersByTime(1000));
  expect(Speech.speak).toHaveBeenCalledWith(`${DEVICE_FALLBACK_INTRO} hola`,expect.anything());
  await act(async()=>resolve({uri:'late.wav',cleanup}));
  expect(cleanup).toHaveBeenCalledTimes(1);expect(mockPlayer.play).not.toHaveBeenCalled();
  expect((await lastVoiceFailure())?.text).toContain('no ha llegado en 20 s (último paso: servidor)');
 });
 test('a voice test that plays records nothing',async()=>{
  mockSynthesize.mockResolvedValue({uri:'ok.wav',cleanup:jest.fn()});await mount({simple:true});
  await act(async()=>output.speak('x','hola',0.85,'Sulafat','preview'));await act(async()=>mockListener({playing:true}));
  expect(output.speakingId).toBe('x');expect(Speech.speak).not.toHaveBeenCalled();
  expect(await lastVoiceFailure()).toBeNull();expect(mockReport).not.toHaveBeenCalled();
 });
 test('native playback error releases natural audio and reads with the device voice',async()=>{
  const cleanup=jest.fn();mockSynthesize.mockResolvedValue({uri:'bad.wav',cleanup});await mount({simple:true});
  await act(async()=>output.speak('x','hola'));await act(async()=>mockListener({error:'decode failed'}));
  expect(mockPlayer.remove).toHaveBeenCalled();expect(cleanup).toHaveBeenCalledTimes(1);expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(output.speakingId).toBe('x');expect(output.loadingId).toBeNull();
 });
 test('stop during natural synthesis prevents late playback',async()=>{
  let resolve:any;const cleanup=jest.fn();mockSynthesize.mockReturnValue(new Promise(r=>resolve=r));
  await mount({simple:true});await act(async()=>output.speak('x','hola'));await act(async()=>output.stop());
  await act(async()=>resolve({uri:'late.wav',cleanup}));
  expect(Speech.speak).not.toHaveBeenCalled();expect(mockPlayer.play).not.toHaveBeenCalled();expect(cleanup).toHaveBeenCalledTimes(1);
 });
 test('slow synthesis switches to the device voice and ignores late audio',async()=>{
  jest.useFakeTimers();let resolve:any;const cleanup=jest.fn();mockSynthesize.mockReturnValue(new Promise(r=>resolve=r));
  await mount({simple:true});await act(async()=>output.speak('x','hola'));await act(async()=>jest.advanceTimersByTime(20000));
  expect(Speech.speak).toHaveBeenCalledTimes(1);expect(output.loadingId).toBeNull();
  await act(async()=>resolve({uri:'late.wav',cleanup}));
  expect(cleanup).toHaveBeenCalledTimes(1);expect(mockPlayer.play).not.toHaveBeenCalled();
 });
 test('silent natural player startup switches to the device voice',async()=>{
  jest.useFakeTimers();const cleanup=jest.fn();mockSynthesize.mockResolvedValue({uri:'silent.wav',cleanup});await mount({simple:true});
  await act(async()=>output.speak('x','hola'));await act(async()=>jest.advanceTimersByTime(10000));
  expect(Speech.speak).toHaveBeenCalledTimes(1);expect(cleanup).toHaveBeenCalledTimes(1);expect(output.speakingId).toBe('x');
 });
 test('medication reading retries natural TTS after an error',async()=>{
  mockSynthesize.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({uri:'retry.wav',cleanup:jest.fn()});
  await mount();await act(async()=>output.play());expect(output.status).toBe('error');
  await act(async()=>output.play());expect(mockSynthesize).toHaveBeenLastCalledWith('A. one','Sulafat','reading');
  expect(Speech.speak).not.toHaveBeenCalled();
 });

 test('natural assistant voice really plays (speed set with setPlaybackRate, never by assignment)',async()=>{
  mockSynthesize.mockResolvedValue({uri:'ok.wav',cleanup:jest.fn()});await mount({simple:true});
  await act(async()=>output.speak('x','hola',0.85,'Sulafat'));
  expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1);
  expect(mockPlayer.play).toHaveBeenCalled();
  expect(Speech.speak).not.toHaveBeenCalled();
  await act(async()=>mockListener({playing:true}));
  expect(output.speakingId).toBe('x');expect(Speech.speak).not.toHaveBeenCalled();
 });
 test('medication reading plays the natural voice too',async()=>{
  mockSynthesize.mockResolvedValue({uri:'a.wav',cleanup:jest.fn()});await mount();await act(async()=>output.play());
  expect(mockPlayer.setPlaybackRate).toHaveBeenCalled();expect(mockPlayer.play).toHaveBeenCalled();
  await act(async()=>mockListener({playing:true}));expect(output.status).toBe('speaking');
 });
 test('voz del teléfono para toda la app (elegida en el panel): el asistente no pide nada al servidor',async()=>{
  VoiceSettings.apply('device');
  await mount({simple:true});await act(async()=>output.speak('x','hola',0.85,'Sulafat','assistant'));
  expect(mockSynthesize).not.toHaveBeenCalled();
  expect(Speech.speak).toHaveBeenCalledWith('hola',expect.objectContaining({voice:'es-premium'}));
  expect(output.speakingId).toBe('x');
 });
 test('voz del teléfono: las pruebas de voz suenan directamente con ella, sin el aviso de «no ha respondido»',async()=>{
  VoiceSettings.apply('device');
  await mount({simple:true});await act(async()=>output.speak('x','hola',0.85,'Achird','preview'));
  expect(mockSynthesize).not.toHaveBeenCalled();
  expect((Speech.speak as jest.Mock).mock.calls[0][0]).toBe('hola');
 });
 test('voz del teléfono: la lectura de un medicamento se lee apartado a apartado, con progreso',async()=>{
  VoiceSettings.apply('device');
  await mount({continuous:true});await act(async()=>output.play());
  expect(mockSynthesize).not.toHaveBeenCalled();
  expect(output.status).toBe('speaking');
  expect(output.duration).toBeGreaterThan(0);
  const first=(Speech.speak as jest.Mock).mock.calls[0];
  expect(first[0]).toBe('Qué es. Un analgésico.');
  await act(async()=>first[1].onDone());
  expect((Speech.speak as jest.Mock).mock.calls[1][0]).toBe('Para qué sirve. Para el dolor.');
  await act(async()=>output.pause());expect(output.status).toBe('paused');
  await act(async()=>output.play());expect(output.status).toBe('speaking');
  const last=(Speech.speak as jest.Mock).mock.calls.at(-1);
  await act(async()=>last[1].onDone());
  expect(output.status).toBe('finished');expect(output.progress).toBe(1);
 });
 test('voz de hombre (Achird): si la voz natural falla, también se lee con una voz de hombre del teléfono',async()=>{
  jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([
   {identifier:'com.apple.voice.premium.es-ES.Marisol',name:'Marisol',language:'es-ES',quality:'Default' as any},
   {identifier:'com.apple.voice.compact.es-ES.Jorge',name:'Jorge',language:'es-ES',quality:'Default' as any}]);
  mockSynthesize.mockRejectedValue(new Error('HTTP 429'));await mount({simple:true});await act(async()=>output.speak('x','hola',0.85,'Achird','assistant'));
  expect(Speech.speak).toHaveBeenCalledWith('hola',expect.objectContaining({voice:'com.apple.voice.compact.es-ES.Jorge'}));
 });
 test('voz del teléfono para toda la app: cada persona sigue oyendo voz de mujer o de hombre, la que eligió',async()=>{
  VoiceSettings.apply('device');
  jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([
   {identifier:'com.apple.voice.premium.es-ES.Marisol',name:'Marisol',language:'es-ES',quality:'Default' as any},
   {identifier:'com.apple.voice.compact.es-ES.Jorge',name:'Jorge',language:'es-ES',quality:'Default' as any}]);
  await mount({simple:true});
  await act(async()=>output.speak('x','hola',0.85,'Sulafat','assistant'));
  expect((Speech.speak as jest.Mock).mock.calls.at(-1)[1].voice).toBe('com.apple.voice.premium.es-ES.Marisol');
  await act(async()=>output.speak('y','adiós',0.85,'Achird','assistant'));
  expect((Speech.speak as jest.Mock).mock.calls.at(-1)[1].voice).toBe('com.apple.voice.compact.es-ES.Jorge');
 });
 test('lectura de un medicamento: si Google falla, se lee entera con la voz del teléfono (no se queda en un aviso)',async()=>{
  mockSynthesize.mockRejectedValue(new Error('HTTP 503'));await mount({continuous:true});await act(async()=>output.play());
  expect(Speech.speak).toHaveBeenCalled();expect(output.status).toBe('speaking');
  const first=(Speech.speak as jest.Mock).mock.calls[0];expect(first[0]).toContain('Qué es');expect(first[1].voice).toBe('es-premium');
  await act(async()=>output.stop?.());
 });
 test('lectura de un medicamento con el respaldo del teléfono: respeta la voz de hombre que eligió la persona',async()=>{
  jest.spyOn(Speech,'getAvailableVoicesAsync').mockResolvedValue([
   {identifier:'com.apple.voice.premium.es-ES.Marisol',name:'Marisol',language:'es-ES',quality:'Default' as any},
   {identifier:'com.apple.voice.compact.es-ES.Jorge',name:'Jorge',language:'es-ES',quality:'Default' as any}]);
  mockSynthesize.mockRejectedValue(new Error('HTTP 429'));await mount({continuous:true,phone:'Achird'});await act(async()=>output.play());
  expect((Speech.speak as jest.Mock).mock.calls[0][1].voice).toBe('com.apple.voice.compact.es-ES.Jorge');
 });
});
