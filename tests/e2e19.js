const {chromium}=require('playwright');const vm=require('vm'),fs=require('fs');
const G=require('./convidados.json');
const mkSheet=(rows)=>({rows,getLastRow(){return this.rows.length},getMaxRows(){return 5000},getMaxColumns(){return 12},insertColumnsAfter(){},getLastColumn(){return 12},insertRowsAfter(){},
 getRange(r,c,nr=1,nc=1){const s=this;return{getValues(){return s.rows.slice(r-1,r-1+nr).map(x=>Array.from({length:nc},(_,i)=>(x||[])[c-1+i]??''))},
  setValues(v){v.forEach((row,i)=>{s.rows[r-1+i]=s.rows[r-1+i]||[];row.forEach((x,j)=>s.rows[r-1+i][c-1+j]=x)})},
  setValue(v){s.rows[r-1]=s.rows[r-1]||[];s.rows[r-1][c-1]=v},getValue(){return (s.rows[r-1]||[])[c-1]??''}}},appendRow(a){this.rows.push(a)}});
function mundo(cfgExtra=[]){
 const sheets={Convidados:mkSheet([['id','nome','dia','estilo','grupo','acomp','busca'],...G.map(g=>[g.id,g.nome,g.dia,g.estilo,g.grupo,g.acomp,g.busca])]),
  Confirmacoes:mkSheet([['h']]),
  Programacao:mkSheet([['Dia','Data','Atração','Estilo','Instagram'],[18,new Date('2026-11-18T00:00:00-03:00'),'Lonesome Capitain · Country & Folk','Formal','@a'],[19,new Date('2026-11-19T00:00:00-03:00'),'Os Bauretz · Soul, Disco & MPB','MPB','@b'],[20,new Date('2026-11-20T00:00:00-03:00'),'Hardways · Classic Rock','Rock','@c'],[21,new Date('2026-11-21T00:00:00-03:00'),'Rodrigo Seidel e banda · Pop Rock','Pop Rock','@d']]),
  Config:mkSheet([['Parâmetro','Valor'],['capacidade_por_noite',74],['mesas',19],['whatsapp_contato',''],['horario',''],...cfgExtra])};
 const cache={};let uu=0;const triggers=[];
 const mkctx=(files)=>{const ctx={console,
  SpreadsheetApp:{flush(){},getActiveSpreadsheet:()=>ss,openById:()=>ss},
  CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/macros/s/TESTE/exec'}),getProjectTriggers:()=>triggers,newTrigger:(f)=>({timeBased:()=>({everyMinutes:()=>({create:()=>triggers.push({getHandlerFunction:()=>f})})})})},
  HtmlService:{},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,v)=>Array.from(require('crypto').createHash('sha256').update(String(v),'utf8').digest()).map(x=>x>127?x-256:x),getUuid:()=>'u'+(++uu).toString(16).padStart(8,'0')+'-aaaa-bbbb-cccc-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12),
   formatDate(d,tz,f){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
    if(f==='u')return String(new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()||7);if(f==='yyyy-MM-dd')return p.year+'-'+p.month+'-'+p.day;if(f==='dd/MM')return p.day+'/'+p.month;return p.day+'/'+p.month+' 00:00'}}};
  vm.createContext(ctx);vm.runInContext(files.map(f=>fs.readFileSync(f,'utf8')).join('\n'),ctx);return ctx};
 const ss={getName:()=>'T',getId:()=>'ID',getUrl:()=>'x',getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=mkSheet([]),getSpreadsheetTimeZone:()=>'America/Sao_Paulo'};
 return{sheets,guest:mkctx(['/tmp/out/convidados/Code.gs']),pub:mkctx(['/tmp/out/publico/Code.gs'].map(f=>f))}}
const R=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const out=[];const ok=(c,m)=>{out.push((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
 // público com SHEET_ID de teste
 let pubSrc=fs.readFileSync('/tmp/out/publico/Code.gs','utf8').replace("'__SHEET_ID__'","'ID_TESTE'");fs.writeFileSync('/tmp/pub_teste.gs',pubSrc);
 const novo=(cfg)=>{const w=mundo(cfg);const ss=w.guest.SpreadsheetApp.getActiveSpreadsheet();
  const c=vm.createContext({});return w};
 // monta mundo com público lendo o mesmo ss
 function W(cfg){const w=mundo(cfg);
  const ss=w.guest.SpreadsheetApp.getActiveSpreadsheet();
  const ctx={...w.pub};const pctx=vm.createContext({console,SpreadsheetApp:{flush(){},openById:()=>ss,getActiveSpreadsheet:()=>ss},CacheService:w.guest.CacheService,LockService:w.guest.LockService,ScriptApp:w.guest.ScriptApp,HtmlService:{},Utilities:w.guest.Utilities});
  vm.runInContext(pubSrc,pctx);w.pub=pctx;w.guest.prepararReservas();return w}
 const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 async function pagina(ctx,arq,sub){const pg=await br.newPage({viewport:{width:390,height:844}});
  await pg.exposeFunction('__call',(fn,args)=>R(ctx[fn](...args)));
  await pg.addInitScript(()=>{const mk=(s,f)=>new Proxy({},{get:(_,fn)=>(...a)=>{window.__call(fn,a).then(s,f)}});window.google={script:{run:{withSuccessHandler(s){return{withFailureHandler(f){return mk(s,f)}}}}}}});
  let h=fs.readFileSync(arq,'utf8');if(sub)h=sub(h);fs.writeFileSync('/tmp/pg.html',h);await pg.goto('file:///tmp/pg.html');return pg}
 const noite=(w,d)=>R(w.pub.dados()).noites.find(x=>x.dia===d);
 let w=W();
 // servidor: doPost só roda funções da lista
 const post=(ctx,o)=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(o)}})._t);
 const CS="ContentService={MimeType:{JSON:'json'},createTextOutput(t){return{_t:t,setMimeType(){return this}}}}";const vmm=require('vm');vmm.runInContext(CS,w.pub);vmm.runInContext(CS,w.guest);
 let d=post(w.pub,{fn:'dados',args:[]});ok(d.ok&&d.noites.length>=3,'doPost(dados) devolve as noites ('+(d.noites||[]).length+')');
 d=post(w.pub,{fn:'cfg_',args:[]});ok(d.erro&&d.erro.codigo==='S99','doPost recusa função fora da lista (cfg_)');
 d=post(w.pub,{fn:'processarFilaWhats',args:[]});ok(d.erro&&d.erro.codigo==='S99','doPost recusa funções internas (fila do WhatsApp)');
 d=post(w.guest,{fn:'gEditarConvidado',args:['x']});ok(d.erro&&d.erro.codigo==='S99','convidados: doPost recusa funções do painel');
 // página estática: fetch no lugar de google.script.run
 const st=h=>h.replace("var EXEC='';","var EXEC='https://exec.test/x';");
 const pgA=await br.newPage({viewport:{width:390,height:844}});
 const usos=[];await pgA.route('https://exec.test/**',async r=>{const q=r.request();const b=JSON.parse(q.postData());usos.push(b.fn+':'+q.headers()['content-type']);
  r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(R(w.pub[b.fn](...b.args)))})});
 let h=st(fs.readFileSync('/tmp/out/publico/Index.html','utf8'));fs.writeFileSync('/tmp/pg2.html',h);
 await pgA.goto('file:///tmp/pg2.html');await pgA.waitForSelector('#noites .noite');
 ok((await pgA.$$('#noites .noite')).length>=3&&/^dados:text\/plain/.test(usos[0])&&await pgA.evaluate(()=>typeof window.google==='undefined'),'página estática lista as noites via fetch POST text/plain, sem google.script.run');
 await pgA.click('#noites .noite');await pgA.waitForSelector('#s-form:not(.hide)');
 await pgA.fill('#pn0','Joao Pereira');await pgA.type('#pt0','42991000009');await pgA.click('#btn-res');await pgA.waitForSelector('#s-ok:not(.hide)',{timeout:5000}).catch(()=>{});
 ok(usos.some(u=>/^reservar:text\/plain/.test(u))&&(await pgA.$eval('#s-ok',e=>!e.classList.contains('hide')))&&w.sheets.Reservas.rows.length===2,'reserva feita pela página estática grava na planilha');
 await pgA.close();
 // convidados: página estática
 const pg2=await br.newPage({viewport:{width:390,height:844}});
 await pg2.route('https://exec.test/**',async r=>{const b=JSON.parse(r.request().postData());usos.push('g:'+b.fn);r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(R(w.guest[b.fn](...b.args)))})});
 h=st(fs.readFileSync('/tmp/out/convidados/Index.html','utf8'));fs.writeFileSync('/tmp/pg3.html',h);await pg2.goto('file:///tmp/pg3.html');
 await pg2.waitForSelector('#q',{timeout:5000});await pg2.fill('#q','Eliane Silva');await pg2.click('#btn-buscar');await pg2.waitForTimeout(800);
 ok(usos.includes('g:config')&&usos.includes('g:buscar'),'confirmação de presença estática: config e buscar via fetch');
 console.log('DBG',usos.join(' '));await br.close();console.log(out.join('\n'));
})();
