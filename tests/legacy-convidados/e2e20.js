const {chromium}=require('playwright');const vm=require('vm'),fs=require('fs');
const G=require('./convidados.json');
const mkSheet=(rows)=>({rows,getLastRow(){return this.rows.length},getMaxRows(){return 5000},getMaxColumns(){return 16},insertColumnsAfter(){},getLastColumn(){return 12},insertRowsAfter(){},
 getRange(r,c,nr=1,nc=1){const s=this;return{getValues(){return s.rows.slice(r-1,r-1+nr).map(x=>Array.from({length:nc},(_,i)=>(x||[])[c-1+i]??''))},
  setValues(v){v.forEach((row,i)=>{s.rows[r-1+i]=s.rows[r-1+i]||[];row.forEach((x,j)=>s.rows[r-1+i][c-1+j]=x)})},
  setNumberFormat(){return this},clearContent(){for(let i=0;i<nr;i++)for(let j=0;j<nc;j++){if(s.rows[r-1+i])s.rows[r-1+i][c-1+j]=""}return this},setValue(v){s.rows[r-1]=s.rows[r-1]||[];s.rows[r-1][c-1]=v},getValue(){return (s.rows[r-1]||[])[c-1]??''}}},appendRow(a){this.rows.push(a)}});
function mundo(cfgExtra=[]){
 const sheets={Convidados:mkSheet([['id','nome','dia','estilo','grupo','acomp','busca'],...G.map(g=>[g.id,g.nome,g.dia,g.estilo,g.grupo,g.acomp,g.busca])]),
  Confirmacoes:mkSheet([['h']]),
  Programacao:mkSheet([['Dia','Data','Atração','Estilo','Instagram'],[18,new Date('2026-11-18T00:00:00-03:00'),'Lonesome Capitain · Country & Folk','Formal','@a'],[19,new Date('2026-11-19T00:00:00-03:00'),'Os Bauretz · Soul, Disco & MPB','MPB','@b'],[20,new Date('2026-11-20T00:00:00-03:00'),'Hardways · Classic Rock','Rock','@c'],[21,new Date('2026-11-21T00:00:00-03:00'),'Rodrigo Seidel e banda · Pop Rock','Pop Rock','@d']]),
  Config:mkSheet([['Parâmetro','Valor'],['capacidade_por_noite',74],['mesas',19],['whatsapp_contato',''],['horario',''],...cfgExtra])};
 const cache={};let uu=0;const triggers=[];
 const mkctx=(files)=>{const ctx={Date:global.Date,console,
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
  const ctx={...w.pub};const pctx=vm.createContext({Date:global.Date,console,SpreadsheetApp:{flush(){},openById:()=>ss,getActiveSpreadsheet:()=>ss},CacheService:w.guest.CacheService,LockService:w.guest.LockService,ScriptApp:w.guest.ScriptApp,HtmlService:{},Utilities:w.guest.Utilities});
  vm.runInContext(pubSrc,pctx);w.pub=pctx;w.guest.prepararReservas();return w}
 const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 async function pagina(ctx,arq,sub){const pg=await br.newPage({viewport:{width:390,height:844}});
  await pg.exposeFunction('__call',(fn,args)=>R(ctx[fn](...args)));
  await pg.addInitScript(()=>{const mk=(s,f)=>new Proxy({},{get:(_,fn)=>(...a)=>{window.__call(fn,a).then(s,f)}});window.google={script:{run:{withSuccessHandler(s){return{withFailureHandler(f){return mk(s,f)}}}}}}});
  let h=fs.readFileSync(arq,'utf8');if(sub)h=sub(h);fs.writeFileSync('/tmp/pg.html',h);await pg.goto('file:///tmp/pg.html');return pg}
 const vis=async(pg,id)=>!(await pg.$eval('#'+id,e=>e.classList.contains('hide')));
 const P=(n,t)=>({nome:n,tel:t});
 const noite=(w,d)=>R(w.pub.dados()).noites.find(x=>x.dia===d);
 const cnt=(w,d)=>R(w.guest.lotacaoTodas_()).find(x=>x.dia===d);
 const sh=(w,n)=>w.sheets[n].rows;
 const usr=(w,perfil,usuario,nome)=>{const u=usuario||'felipe';w.sheets.Usuarios.rows.push([u,nome||'Felipe',perfil||'GESTAO','SIM','Inicial@123','','','','']);const e=R(w.guest.entrar(u,'Inicial@123'));w.guest.trocarSenha(e.sessao,'Inicial@123','Senha@Nova1');return e.sessao};
 const U=w=>w.sheets.Usuarios.rows;const add=(w,u,p,perfil,ativo)=>w.sheets.Usuarios.rows.push([u,u,perfil===undefined?'GESTAO':perfil,ativo||'SIM',p,'','','','']);
 const K=usr(W2=W());let w=W2;
 let e=R(w.guest.gDiaSalvar(K,'2026-11-19','Os Bauretz · Soul, Disco & MPB','Soul',true,{cache:'',integrantes:'',consumacao:'',estadia:'',transporte:'',teto:'30'}));
 const l19=()=>R(w.guest.lotacaoTodas_()).find(x=>x.dia===19);
 ok(e.ok!==false&&l19().teto===30&&l19().excecao===true&&l19().padrao===81,'exceção: teto da noite 19 = 30 (padrão 81 preservado)');
 ok(R(w.guest.lotacaoTodas_()).filter(x=>x.dia!==19).every(x=>x.teto===81&&!x.excecao),'outras noites seguem o padrão');
 ok(l19().restantes===Math.max(0,30-l19().total)&&l19().lotado===(l19().total>=30),'vagas e lotado usam o teto da noite');
 const pr=sh(w,'Programacao');ok(String(pr[0][11]).includes('lotação')&&pr.find(r=>r[0]===19)[11]===30,'coluna L com cabeçalho e valor');
 e=R(w.guest.gDiaSalvar(K,'2026-11-19','Os Bauretz · Soul, Disco & MPB','Soul',true,{cache:'',integrantes:'',consumacao:'',estadia:'',transporte:'',teto:'abc'}));ok(e.code==='invalido'&&e.campo==='teto','teto inválido recusado');
 e=R(w.guest.gDiaSalvar(K,'2026-11-19','Os Bauretz · Soul, Disco & MPB','Soul',true,{cache:'',integrantes:'',consumacao:'',estadia:'',transporte:'',teto:'0'}));ok(e.code==='invalido','teto 0 recusado');
 // trava de lotado no teto da noite (mover convidado do dia 20 para 19 com teto mínimo)
 e=R(w.guest.gDiaSalvar(K,'2026-11-19','Os Bauretz · Soul, Disco & MPB','Soul',true,{cache:'',integrantes:'',consumacao:'',estadia:'',transporte:'',teto:String(l19().total)}));
 ok(l19().lotado===true&&l19().restantes===0,'teto = total atual deixa a noite LOTADA');
 ok(R(w.pub.dados()).noites.find(x=>x.dia===19).lotado===true,'página pública mostra a noite lotada');
 const mv=R(w.guest.painel(K)).convidados.find(c=>c.dia===20&&c.status==='Pendente');
 const r=R(w.guest.gMoverConvidado(K,mv.id,19,false));ok(r.ok===false&&r.code==='lotado'&&r.teto===l19().teto,'mover para noite no limite: aviso usa o teto da noite');
 e=R(w.guest.gDiaSalvar(K,'2026-11-19','Os Bauretz · Soul, Disco & MPB','Soul',true,{cache:'',integrantes:'',consumacao:'',estadia:'',transporte:'',teto:''}));
 ok(l19().teto===81&&!l19().excecao&&pr.find(r=>r[0]===19)[11]==='','vazio volta ao padrão');
 const KC=usr(w,'CONSULTA','leitor','Leitor');e=R(w.guest.gDiaSalvar(KC,'2026-11-19','x','y',true,{cache:'',integrantes:'',consumacao:'',estadia:'',transporte:'',teto:'5'}));
 ok(l19().teto===81,'perfil de consulta não altera a lotação');
 // painel: campo na janela de edição e cartões usam o teto da noite
 let pg2=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K)+";"));
 await pg2.waitForSelector('.dc.ev');
 const tem=await pg2.evaluate(()=>typeof modalDia==='function'&&typeof S!=='undefined');ok(tem,'painel carregou');
 await pg2.evaluate(()=>modalDia(S.noites[1].iso,S.noites[1]));await pg2.waitForSelector('#c6');
 await pg2.fill('#c6','40');await pg2.click('#mOk');await pg2.waitForTimeout(600);
 console.log('ERR',await pg2.$eval('#mErr',e=>e.textContent).catch(()=>'sem modal'));ok(l19().teto===40||R(w.guest.lotacaoTodas_()).some(x=>x.teto===40),'campo "Lotação desta noite" no painel grava a exceção');
 await br.close();console.log(out.join('\n'));
})();
