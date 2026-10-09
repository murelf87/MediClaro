import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';
const source=fs.readFileSync(path.join(process.cwd(),'supabase/functions/cleanup-anonymous/index.ts'),'utf8');
async function check(options:{premium?:boolean;linked?:boolean;profileError?:boolean;linkError?:boolean}={}){
 const deleted:string[]=[];let handler:any;
 const admin={auth:{admin:{listUsers:async()=>({data:{users:[{id:'fixture-user',is_anonymous:true,created_at:'2020-01-01'}]},error:null}),deleteUser:async(id:string)=>{deleted.push(id);return{error:null};}}},from:(table:string)=>{
  const query:any={select:()=>query,eq:()=>query,or:()=>query,is:()=>query,
   maybeSingle:async()=>({data:{plan:options.premium?'premium':'free',sub_state:'NONE'},error:options.profileError?new Error('profile failed'):null}),
   limit:async()=>({data:options.linked?[{id:'test-link'}]:[],error:options.linkError?new Error('care failed'):null})};return query;
 }};
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports:{},require:()=>({admin,json:(body:any,status=200)=>({body,status})}),Date,Deno:{env:{get:()=> 'test-secret'},serve:(h:any)=>{handler=h;}}});
 const invoke=()=>handler({method:'POST',headers:{get:()=> 'test-secret'}});
 return{deleted,invoke};
}
it('never deletes linked free caregivers or patients',async()=>{const t=await check({linked:true});await t.invoke();expect(t.deleted).toEqual([]);});
it('never deletes Premium accounts',async()=>{const t=await check({premium:true});await t.invoke();expect(t.deleted).toEqual([]);});
it('can delete an abandoned unlinked unpaid fixture',async()=>{const t=await check();await t.invoke();expect(t.deleted).toEqual(['fixture-user']);});
it.each(['profileError','linkError'] as const)('lookup failure %s prevents deletion',async key=>{const t=await check({[key]:true});await expect(t.invoke()).rejects.toThrow();expect(t.deleted).toEqual([]);});
