import { secureLocalStore } from '../api/storage';
import { dbError } from '../api';
type Kind = 'saved' | 'history';
interface Snapshot<T> { data: T[]; savedAt: string }
const offline = new Map<string, boolean>();
const key = (user: string, kind: Kind) => `mediclaro.medication.read.v1.${user}.${kind}`;
export const MedicationReadCache = {
 async read<T>(user: string, kind: Kind, query: PromiseLike<{data: unknown; error: any}>): Promise<T[]> {
  const storageKey=key(user,kind);
  const result=await Promise.resolve(query).catch(error=>({data:null,error}));
  if(result.error){
   const error=dbError(result.error);
   // Never display another session's data or suppress an authentication failure.
   if(!['offline','timeout','provider_down','rate_limited'].includes(error.kind) && !(result.error.status >= 500))throw error;
   const cached=await secureLocalStore.getJSON<Snapshot<T>|null>(storageKey,null);
   if(!cached)throw error;
   offline.set(storageKey,true);
   return cached.data;
  }
  const data=(result.data??[]) as T[];
  offline.set(storageKey,false);
  await secureLocalStore.setJSON(storageKey,{data,savedAt:new Date().toISOString()}).catch(()=>undefined);
  return data;
 },
 async update<T>(user:string,kind:Kind,apply:(data:T[])=>T[]):Promise<void>{
  const storageKey=key(user,kind);
  const cached=await secureLocalStore.getJSON<Snapshot<T>|null>(storageKey,null);
  if(cached)await secureLocalStore.setJSON(storageKey,{...cached,data:apply(cached.data)}).catch(()=>undefined);
 },
 isOffline(user:string,kind:Kind){return offline.get(key(user,kind))===true;},
};
