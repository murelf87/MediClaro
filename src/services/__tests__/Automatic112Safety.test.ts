import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
function callsOfficial(node:ts.Node):boolean {
 let found=false;
 function visit(n:ts.Node){if(ts.isCallExpression(n)&&/^(callOfficial|callOfficialEmergency|dialOfficial|callEmergency)$/.test(n.expression.getText()))found=true;ts.forEachChild(n,visit);}
 visit(node);return found;
}
describe('No autonomous official emergency calls',()=>{
 test('no emergency effect or timer invokes an official call',()=>{
  const directory=path.join(process.cwd(),'src/screens/emergency');const violations:string[]=[];
  for(const name of fs.readdirSync(directory).filter(f=>f.endsWith('.tsx'))){
   const source=ts.createSourceFile(name,fs.readFileSync(path.join(directory,name),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   function visit(n:ts.Node){
    if(ts.isCallExpression(n)&&/^(useEffect|setTimeout|setInterval)$/.test(n.expression.getText())){
     const callback=n.arguments[0];if(callback&&callsOfficial(callback))violations.push(name+':'+source.getLineAndCharacterOfPosition(n.pos).line);
    }
    ts.forEachChild(n,visit);
   }
   visit(source);
  }
  expect(violations).toEqual([]);
 });
});
