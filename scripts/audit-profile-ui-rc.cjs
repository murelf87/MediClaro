const path=require('path'),os=require('os'),fs=require('fs'),assert=require('assert/strict');
const qaTools=path.join(os.tmpdir(),'mediclaro-visual-tools/node_modules');
const {chromium}=require(path.join(qaTools,'playwright')),jsQR=require(path.join(qaTools,'jsqr')),{PNG}=require(path.join(qaTools,'pngjs'));
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const role of ['patient','caregiver']){
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/welcome?qa=signedout',{waitUntil:'networkidle'});
  await page.getByTestId('profile-'+role).click();
  if(role==='caregiver'){
   await page.getByTestId('caregiver-own-premium').waitFor();
   await page.getByText('Mi perfil: Cuidador',{exact:true}).waitFor();
   assert(!page.url().includes('verify'),'No phone verification before selecting caregiver');
   await page.getByTestId('caregiver-own-premium').click();await page.waitForTimeout(1200);
   assert(page.url().includes('premium'),'Caregiver can reach own Premium');
   console.log('FREE_CAREGIVER_AND_OWN_PREMIUM_UI=PASS');
  }else{
   await page.getByTestId('home-caregiver').waitFor();await page.getByTestId('home-identify').click();
   await page.getByTestId('locked-identify').waitFor();assert(!page.url().includes('login'));
   await page.goto('http://127.0.0.1:8765/assistant?qa=anon',{waitUntil:'networkidle'});await page.getByTestId('locked-assistant').waitFor();
   await page.goto('http://127.0.0.1:8765/caregiver?qa=anon',{waitUntil:'networkidle'});
   await page.getByRole('textbox',{name:'Tu nombre para esta vinculación'}).fill('QA usuario');
   await page.getByRole('button',{name:'Mostrar mi QR para vincular',exact:true}).click();
   const qr=page.getByLabel('QR privado de vinculación válido durante 24 horas',{exact:true});await qr.waitFor();
   const png=PNG.sync.read(await qr.screenshot()),decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
   assert.equal(decoded?.data,'MEDICLARO_CARE_V1:12345678-1234-4321-9876-123456789abc');
   await page.screenshot({path:'qa-ui-rc/profile-patient-qr.png'});
   console.log('FREE_PATIENT_IA_PHOTO_LOCKED_AND_RENDERED_QR_DECODES=PASS');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));await context.close();
 }
 console.log('PROFILE_FLOW_UI=PASS (isolated fixtures; camera still needs physical iPhone test)');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();});
