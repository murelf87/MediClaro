import React from 'react';
import { act, create } from 'react-test-renderer';
const mockSynthesize=jest.fn();
const mockConfigure=jest.fn(async()=>undefined);
let mockListener: (s:any)=>void;
const mockPlayer={play:jest.fn(),pause:jest.fn(),remove:jest.fn(),addListener:jest.fn((_:string,fn:any)=>{mockListener=fn;return {remove:jest.fn()};})};
jest.mock('../../services',()=>({SpeechService:{synthesize:(...a:any[])=>mockSynthesize(...a)}}));
jest.mock('../../utils/audio',()=>({configureAudioForSpeech:()=>mockConfigure()}));
jest.mock('../../utils/dialogs',()=>({showAlert:jest.fn(async()=>undefined)}));
jest.mock('expo-audio',()=>({createAudioPlayer:()=>mockPlayer}),{virtual:true});
import * as Speech from 'expo-speech';
import { useGeminiSectionSpeech, useGeminiSimpleSpeech } from '../useSpeech';
let output:any;let tree:any;
const sections=[{id:'a',title:'A',text:'one'},{id:'b',title:'B',text:'two'}];
function Probe({voice='Sulafat',simple=false}:any){output=simple?useGeminiSimpleSpeech():useGeminiSectionSpeech(sections,0.85,voice);return null;}
async function mount(props:any={}){await act(async()=>{tree=create(React.createElement(Probe,props));});}
beforeEach(()=>{jest.spyOn(Speech, 'speak').mockImplementation(()=>undefined as any);jest.spyOn(Speech, 'getAvailableVoicesAsync').mockResolvedValue([{identifier:'es-premium',name:'Spanish',language:'es-ES',quality:'Enhanced' as any}]);(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mockSynthesize.mockReset();mockConfigure.mockReset().mockResolvedValue(undefined);[mockPlayer.play,mockPlayer.pause,mockPlayer.remove,mockPlayer.addListener].forEach(f=>f.mockClear());});
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
 test('simple synthesis failure never falls back to the robotic device voice',async()=>{
  mockSynthesize.mockRejectedValue(new Error('offline'));await mount({simple:true});await act(async()=>output.speak('x','hola'));
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(output.speakingId).toBeNull();expect(output.loadingId).toBeNull();
 });
 test('native playback error releases natural audio without robotic fallback',async()=>{
  const cleanup=jest.fn();mockSynthesize.mockResolvedValue({uri:'bad.wav',cleanup});await mount({simple:true});
  await act(async()=>output.speak('x','hola'));await act(async()=>mockListener({error:'decode failed'}));
  expect(mockPlayer.remove).toHaveBeenCalled();expect(cleanup).toHaveBeenCalledTimes(1);expect(Speech.speak).not.toHaveBeenCalled();
  expect(output.speakingId).toBeNull();expect(output.loadingId).toBeNull();
 });
 test('stop during natural synthesis prevents late playback',async()=>{
  let resolve:any;const cleanup=jest.fn();mockSynthesize.mockReturnValue(new Promise(r=>resolve=r));
  await mount({simple:true});await act(async()=>output.speak('x','hola'));await act(async()=>output.stop());
  await act(async()=>resolve({uri:'late.wav',cleanup}));
  expect(Speech.speak).not.toHaveBeenCalled();expect(mockPlayer.play).not.toHaveBeenCalled();expect(cleanup).toHaveBeenCalledTimes(1);
 });
 test('slow synthesis times out without switching to the device voice',async()=>{
  jest.useFakeTimers();let resolve:any;const cleanup=jest.fn();mockSynthesize.mockReturnValue(new Promise(r=>resolve=r));
  await mount({simple:true});await act(async()=>output.speak('x','hola'));await act(async()=>jest.advanceTimersByTime(35000));
  expect(Speech.speak).not.toHaveBeenCalled();expect(output.loadingId).toBeNull();
  await act(async()=>resolve({uri:'late.wav',cleanup}));
  expect(cleanup).toHaveBeenCalledTimes(1);expect(mockPlayer.play).not.toHaveBeenCalled();
 });
 test('silent natural player startup stops instead of falling back to a robotic voice',async()=>{
  jest.useFakeTimers();const cleanup=jest.fn();mockSynthesize.mockResolvedValue({uri:'silent.wav',cleanup});await mount({simple:true});
  await act(async()=>output.speak('x','hola'));await act(async()=>jest.advanceTimersByTime(10000));
  expect(Speech.speak).not.toHaveBeenCalled();expect(cleanup).toHaveBeenCalledTimes(1);expect(output.speakingId).toBeNull();
 });
 test('medication reading retries natural TTS after an error',async()=>{
  mockSynthesize.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({uri:'retry.wav',cleanup:jest.fn()});
  await mount();await act(async()=>output.play());expect(output.status).toBe('error');
  await act(async()=>output.play());expect(mockSynthesize).toHaveBeenLastCalledWith('A. one','Sulafat','reading');
  expect(Speech.speak).not.toHaveBeenCalled();
 });

});