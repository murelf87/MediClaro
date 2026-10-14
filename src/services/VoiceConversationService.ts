import { File } from 'expo-file-system';
import { invokeFunction } from '../api';
import { DemoMode } from './DemoMode';
import { ASSISTANT_NAME } from '../config/assistant';

interface TranscriptionResponse { text:string; model?:string }

function mimeFromUri(uri:string):string {
  const lower=uri.toLowerCase();
  if(lower.endsWith('.wav'))return 'audio/wav';
  if(lower.endsWith('.webm'))return 'audio/webm';
  if(lower.endsWith('.3gp')||lower.endsWith('.3gpp'))return 'audio/3gpp';
  if(lower.endsWith('.aac'))return 'audio/aac';
  if(lower.endsWith('.mp4'))return 'audio/mp4';
  return 'audio/m4a';
}

export const VoiceConversationService={
  async transcribe(uri:string):Promise<string>{
    // El Modo demostración no tiene servidor: se dice claramente en lugar de un error técnico.
    if(DemoMode.isActive())throw new Error(`En el modo demostración no se puede transcribir la voz. Escribe tu pregunta o entra con tu cuenta de MediClaro para hablar con ${ASSISTANT_NAME}.`);
    const file=new File(uri);
    if(!file.exists)throw new Error('No se ha encontrado la grabación.');
    if(file.size>4_500_000)throw new Error('El mensaje de voz es demasiado largo.');
    const audioBase64=await file.base64();
    const response=await invokeFunction<TranscriptionResponse>('voice-transcribe',{
      audioBase64,
      mimeType:mimeFromUri(uri),
    },{timeoutMs:45_000});
    const text=response?.text?.replace(/\s+/g,' ').trim();
    if(!text)throw new Error('No he podido entender el audio.');
    return text.slice(0,1000);
  },
};
