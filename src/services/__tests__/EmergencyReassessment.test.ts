import { reassess, recoveryReply } from '../../../supabase/functions/_shared/reassessment';
const conversation = (...content: string[]) => content.map(text=>({role:'user',content:text}));
describe('Emergency reassessment',()=>{
 test.each(['ya estoy bien','se me ha pasado','estoy mejor','ya puedo respirar','ya no me falta el aire','I feel better'])('recognizes recovery: %s',text=>expect(reassess(conversation('me encontraba mal',text))).toBe('improved'));
 test.each(['ya estoy bien pero no puedo respirar','estoy mejor pero me falta el aire','estoy mejor pero quiero matarme','se me ha pasado pero me he desmayado'])('ongoing red flag wins: %s',text=>expect(reassess(conversation(text))).toBe('current'));
 test.each(['sobredosis','he tomado el doble','me he desmayado','dolor de pecho'])('does not clear serious history: %s',text=>expect(reassess(conversation(text,'ya estoy bien'))).toBe('past_serious'));
 test('negated current chest pain is reassessed',()=>expect(reassess(conversation('ya no tengo dolor de pecho'))).toBe('improved'));
 test.each(['no estoy mejor','no puedo hablar bien','no se me ha pasado'])('negated recovery is not a recovery: %s',text=>expect(reassess(conversation(text))).toBe('none'));
 test.each(['fue solo un mareo','puedo hablar bien'])('acknowledges clarification: %s',text=>expect(reassess(conversation(text))).toBe('improved'));
 test('ordinary medication question has no recovery state',()=>expect(reassess(conversation('para que sirve paracetamol'))).toBe('none'));
 test('serious recovery asks for reassessment without claiming clinical resolution',()=>expect(recoveryReply('past_serious','ES')).toContain('valoración médica urgente'));
});
