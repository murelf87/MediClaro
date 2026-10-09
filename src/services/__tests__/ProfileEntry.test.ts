import {ProfileEntryService} from '../ProfileEntryService';
import {careInviteQr,parseCareInvite} from '../careInvite';
const mockEnsure=jest.fn(),mockRole=jest.fn();
jest.mock('../AuthService',()=>({AuthService:{ensureAccount:(...a:any[])=>mockEnsure(...a)}}));
jest.mock('../CaregiverService',()=>({CaregiverService:{role:(...a:any[])=>mockRole(...a)}}));
beforeEach(()=>{mockEnsure.mockReset().mockResolvedValue({userId:'test',phone:null});mockRole.mockReset().mockResolvedValue({});});
it('caregiver entry creates/reuses an account without OTP or subscription',async()=>{
 expect(await ProfileEntryService.choose('caregiver')).toBe('/caregiver');expect(mockEnsure).toHaveBeenCalledTimes(1);expect(mockRole).toHaveBeenCalledWith('caregiver');
});
it('patient role remains independent of billing',async()=>{
 expect(await ProfileEntryService.choose('patient')).toBe('/(tabs)');expect(mockRole).toHaveBeenCalledWith('patient');
});
it('failed account creation never assigns a care role',async()=>{
 mockEnsure.mockRejectedValue(new Error('offline'));await expect(ProfileEntryService.choose('caregiver')).rejects.toThrow();expect(mockRole).not.toHaveBeenCalled();
});
it('server role failure never pretends entry succeeded',async()=>{
 mockRole.mockRejectedValue(new Error('offline'));await expect(ProfileEntryService.choose('patient')).rejects.toThrow();
});
it('rejects unsupported roles before any account mutation',async()=>{
 await expect(ProfileEntryService.choose('owner' as any)).rejects.toThrow();expect(mockEnsure).not.toHaveBeenCalled();
});
const uuid='12345678-1234-4321-9876-123456789abc';
it('QR round-trips only the private invitation ID',()=>{expect(parseCareInvite(careInviteQr(uuid))).toBe(uuid);});
it('accepts a shared MediClaro invitation without launching a URL',()=>{expect(parseCareInvite('mediclaro://caregiver?invite='+uuid)).toBe(uuid);});
it.each(['https://evil.invalid/'+uuid,'MEDICLARO_CARE_V2:'+uuid,'mediclaro://caregiver?invite='+uuid+'&admin=true','not-a-code','javascript:alert(1)',''])('rejects invalid or unrelated QR %s',input=>{expect(parseCareInvite(input)).toBeNull();});
it('cannot generate a QR from an invalid code',()=>{expect(()=>careInviteQr('invalid')).toThrow();});
