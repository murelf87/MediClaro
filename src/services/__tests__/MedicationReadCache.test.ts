const mockDisk=new Map<string,unknown>();
jest.mock('../../api/storage',()=>({secureLocalStore:{getJSON:jest.fn(async(k:string,f:unknown)=>mockDisk.has(k)?JSON.parse(JSON.stringify(mockDisk.get(k))):f),setJSON:jest.fn(async(k:string,v:unknown)=>{mockDisk.set(k,JSON.parse(JSON.stringify(v)));})}}));
import { MedicationReadCache as cache } from '../MedicationReadCache';
const ok=(data:unknown[])=>Promise.resolve({data,error:null});
const down=()=>Promise.resolve({data:null,error:{message:'Network request failed'}});
beforeEach(()=>mockDisk.clear());
describe('Medication owner-scoped durable snapshots',()=>{
 test.each(['saved','history'] as const)('%s persists and recovers on network failure',async kind=>{
  const data=[{id:'1',favorito:true}];await cache.read('alice',kind,ok(data));expect(await cache.read('alice',kind,down())).toEqual(data);expect(cache.isOffline('alice',kind)).toBe(true);
 });
 test('another account never sees the previous account data',async()=>{
  await cache.read('alice','saved',ok([{id:'private'}]));await expect(cache.read('bob','saved',down())).rejects.toMatchObject({kind:'offline'});
 });
 test('failed first read remains an honest error',async()=>{await expect(cache.read('alice','history',down())).rejects.toMatchObject({kind:'offline'});});
 test('network recovery refreshes the snapshot',async()=>{
  await cache.read('alice','saved',ok([{id:'old'}]));await cache.read('alice','saved',down());await cache.read('alice','saved',ok([{id:'new'}]));expect(cache.isOffline('alice','saved')).toBe(false);expect(await cache.read('alice','saved',down())).toEqual([{id:'new'}]);
 });
 test('authentication error is never masked by a cache',async()=>{
  await cache.read('alice','saved',ok([{id:'old'}]));await expect(cache.read('alice','saved',Promise.resolve({data:null,error:{code:'PGRST301',message:'JWT expired'}}))).rejects.toMatchObject({kind:'unauthorized'});
 });
 test('permission errors are not reported as successful offline reads',async()=>{
  await cache.read('alice','saved',ok([{id:'old'}]));await expect(cache.read('alice','saved',Promise.resolve({data:null,error:{code:'42501',message:'permission denied'}}))).rejects.toBeDefined();
 });
 test('thrown transport error preserves the previous data',async()=>{
  await cache.read('alice','history',ok([{id:9}]));expect(await cache.read('alice','history',Promise.reject(new Error('Failed to fetch')))).toEqual([{id:9}]);
 });
});
