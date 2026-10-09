import React from 'react';
import {act,create} from 'react-test-renderer';
import {EntitlementProvider,useEntitlement} from '../EntitlementProvider';
let mockSession:any={status:'signedOut',session:null};
let mockTestAccess=false;
const mockGetSubscription=jest.fn();
const mockTestAccessListeners=new Set<()=>void>();
jest.mock('react-native',()=>({AppState:{addEventListener:()=>({remove:()=>{}})}}));
jest.mock('../../services/TestAccess',()=>({TestAccess:{
 isActive:()=>mockTestAccess,
 subscribe:(listener:()=>void)=>{mockTestAccessListeners.add(listener);return()=>mockTestAccessListeners.delete(listener);}
}}));
jest.mock('../SessionProvider',()=>({useSession:()=>mockSession}));
jest.mock('../../config/app',()=>({CARD_PAYMENTS_ENABLED:false,DEMO_ACCESS_ENABLED:true,PREMIUM_REQUIRED:true,PURCHASES_ENABLED:true}));
jest.mock('../../services/SubscriptionService',()=>({SubscriptionService:{getPlans:async()=>({storeVerification:false}),getSubscription:(...args:any[])=>mockGetSubscription(...args)}}));
jest.mock('../../services/PurchaseService',()=>({PurchaseService:{reconcile:async()=>false,onEntitlementChange:()=>()=>{}}}));
let value:ReturnType<typeof useEntitlement>,tree:ReturnType<typeof create>;
function Probe(){value=useEntitlement();return null;}
async function mount(){await act(async()=>{tree=create(React.createElement(EntitlementProvider,null,React.createElement(Probe)));});}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mockSession={status:'signedOut',session:null};mockTestAccess=false;mockGetSubscription.mockReset();});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('guest sees locked features even when store verification is disabled',async()=>{
 await mount();expect(value.status).toBe('ready');expect(value.unlocked).toBe(false);expect(value.required).toBe(true);expect(value.canSell).toBe(false);
});
it('an unpaid account never unlocks IA or identification',async()=>{
 mockSession={status:'signedIn',session:{userId:'test'}};mockGetSubscription.mockResolvedValue({isPremium:false});
 await mount();expect(value.unlocked).toBe(false);
});
it('a subscription lookup error fails closed',async()=>{
 mockSession={status:'signedIn',session:{userId:'test'}};mockGetSubscription.mockRejectedValue(new Error('offline'));
 await mount();expect(value.status).toBe('error');expect(value.unlocked).toBe(false);
});
it('confirmed Premium unlocks before linking a phone',async()=>{
 mockSession={status:'signedIn',session:{userId:'test',phone:null}};mockGetSubscription.mockResolvedValue({isPremium:true});
 await mount();expect(value.unlocked).toBe(true);expect(value.isPremium).toBe(true);
});
it('internal QA Premium unlocks immediately after server grant',async()=>{
 mockSession={status:'signedIn',session:{userId:'qa-test',phone:null}};mockGetSubscription.mockResolvedValue({isPremium:false});mockTestAccess=true;
 await mount();expect(value.unlocked).toBe(true);expect(value.isPremium).toBe(true);
});
