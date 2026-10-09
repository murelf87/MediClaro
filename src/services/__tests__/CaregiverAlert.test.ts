import {currentCaregiverSignal,notificationDescription} from '../CaregiverAlert';
import {incidentActive,locationFresh} from '../CaregiverService';
import type {AssistantMessage} from '../../types';
const user=(text:string,id='u1'):AssistantMessage=>({id,role:'user',text,createdAt:'2026-10-02T10:00:00Z',status:'sent'});
const reply=(emergency=false):AssistantMessage=>({id:'a1',role:'assistant',text:'Respuesta',createdAt:'2026-10-02T10:00:01Z',...(emergency?{emergency:{resources:[]}}:{})});
describe('Caregiver incident triggers',()=>{
 test.each(['me encuentro mal','Me siento mal.','Ahora no me encuentro bien','me estoy mareando'])('Current reported discomfort: %s',text=>{
  expect(currentCaregiverSignal([user(text),reply()])?.summary).toContain(text);
 });
 test.each(['ya estoy bien','si me encuentro mal, ¿qué hago?','ayer me encontraba mal','mi madre se siente mal','no me encuentro mal','¿qué significa sentirse mal?'])('No false trigger: %s',text=>{
  expect(currentCaregiverSignal([user(text),reply()])).toBeNull();
 });
 test('Old emergency is not sticky',()=>{
  expect(currentCaregiverSignal([user('me falta el aire'),reply(true),user('ya estoy bien','u2'),reply()])).toBeNull();
 });
 test('AI emergency shares only the patient statement',()=>{
  const result=currentCaregiverSignal([user('me falta el aire'),reply(true)]);
  expect(result?.summary).toBe('El paciente comunica: me falta el aire');
  expect(result?.emergency).toBe(true);
 });
 test('Retries use the same patient turn key',()=>{
  expect(currentCaregiverSignal([user('me siento mal')])?.clientKey).toBe(currentCaregiverSignal([user('me siento mal'),reply(true)])?.clientKey);
 });
});
describe('Caregiver status truth',()=>{
 const now=Date.parse('2026-10-02T10:00:00Z');
 test('Expired incidents never expose active chat',()=>expect(incidentActive({state:'active',expires_at:'2026-10-02T09:59:59Z'},now)).toBe(false));
 test.each([null,'bad','2026-10-02T09:58:00Z','2026-10-02T10:01:00Z'])('Missing, stale, future GPS: %s',value=>expect(locationFresh(value,now)).toBe(false));
 test('Recent GPS is labeled recent',()=>expect(locationFresh('2026-10-02T09:59:30Z',now)).toBe(true));
 test('Provider receipt is not human reading',()=>expect(notificationDescription('provider_delivered')).toContain('no confirma que alguien lo haya leído'));
});
