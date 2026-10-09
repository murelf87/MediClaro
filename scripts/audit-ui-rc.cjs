const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.tmpdir(),'mediclaro-visual-tools/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const out=path.join(process.cwd(),'qa-ui-rc');fs.mkdirSync(out,{recursive:true});const results=[];
 for(const width of [320,375,393,430]){
  const context=await browser.newContext({viewport:{width,height:852},isMobile:true,hasTouch:true,locale:'es-ES'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/layout-qa','/medicines','/history','/profile','/accessibility','/premium','/caregiver','/owner-dashboard','/choose-profile','/welcome']){
   errors.length=0;
   await page.goto('http://127.0.0.1:8765'+route+(route==='/welcome'?'?qa=signedout':'?qa=premium'),{waitUntil:'networkidle'});
   await page.waitForTimeout(1000);
   if(route==='/layout-qa'){
    await page.getByTestId('qa-large').click();await page.waitForTimeout(250);
    await page.getByTestId('qa-primary').click();
    await page.getByText('Acciones: 1',{exact:true}).waitFor();
   }
   const overflow=await page.evaluate(()=>{
    const bad=[];for(const e of document.querySelectorAll('[role="button"]')){
     const b=e.getBoundingClientRect();if(b.width<1||b.height<1||b.bottom<0||b.top>innerHeight)continue;
     if(b.x < -1 || b.right>innerWidth+1)bad.push({label:e.getAttribute('aria-label'),type:'button',x:b.x,right:b.right});
     for(const t of e.querySelectorAll('[dir="auto"]')){const q=t.getBoundingClientRect();
      if(q.x<b.x-1||q.right>b.right+1||q.y<b.y-1||q.bottom>b.bottom+1)bad.push({label:e.getAttribute('aria-label'),type:'text',text:t.textContent?.slice(0,70)});
     }
    }return bad;
   });
   if(route==='/layout-qa'){
    const heights=await page.evaluate(()=>Object.fromEntries(['qa-primary','qa-loading'].map(id=>[id,document.querySelector('[data-testid="'+id+'"]').getBoundingClientRect().height])));
    if(Math.abs(heights['qa-primary']-heights['qa-loading'])>1)overflow.push({type:'loading-height',heights});
    const heading=await page.getByText('Mis medicamentos y contacto con la persona cuidadora',{exact:true}).boundingBox();
    const cancel=await page.getByRole('button',{name:'Cancelar',exact:true}).boundingBox();
    if(heading && cancel && heading.y < cancel.y+cancel.height-1)overflow.push({type:'header-overlap',heading,cancel});
   }
   await page.screenshot({path:path.join(out,width+'-'+route.slice(1)+'.png')});
   const visible=await page.locator('body').innerText();
   const blank=visible.trim().length<20;
   results.push({width,route,overflow,errors:[...errors],blank});
   console.log(JSON.stringify(results.at(-1)));
  }
  await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 process.exitCode=results.some(r=>r.blank||r.errors.length||r.overflow.length)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
