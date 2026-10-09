const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIX_DIGIT=/^[0-9]{6}$/;

export function parseCarePairCode(input:string):string|null{
 const raw=input.trim();
 const candidate=raw.startsWith('MEDICLARO_CARE_CODE_V1:')
  ?raw.slice('MEDICLARO_CARE_CODE_V1:'.length)
  :raw.startsWith('mediclaro://caregiver?code=')
   ?raw.slice('mediclaro://caregiver?code='.length)
   :raw;
 return SIX_DIGIT.test(candidate)?candidate:null;
}

export function carePairQr(code:string):string{
 const parsed=parseCarePairCode(code);
 if(!parsed)throw new Error('Código de 6 números no válido.');
 return 'MEDICLARO_CARE_CODE_V1:'+parsed;
}

// Compatibilidad temporal con invitaciones antiguas ya creadas.
export function parseCareInvite(input:string):string|null{
 const raw=input.trim();
 const candidate=raw.startsWith('MEDICLARO_CARE_V1:')?raw.slice('MEDICLARO_CARE_V1:'.length):raw.startsWith('mediclaro://caregiver?invite=')?raw.slice('mediclaro://caregiver?invite='.length):raw;
 return UUID.test(candidate)?candidate.toLowerCase():null;
}
export function careInviteQr(code:string):string{
 const parsed=parseCareInvite(code);if(!parsed)throw new Error('Código de vinculación no válido.');
 return 'MEDICLARO_CARE_V1:'+parsed;
}
