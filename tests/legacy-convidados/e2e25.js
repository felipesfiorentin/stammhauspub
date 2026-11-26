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
 const prog=()=>R(w.guest.painel(K)).noites, N=(iso)=>prog().find(n=>n.iso===iso);
 const ct=(o)=>Object.assign({cache:'',integrantes:'',consumacao:'',estadia:'',transporte:''},o||{});
 const sal=(iso,at,o)=>R(w.guest.gDiaSalvar(K,iso,at,'Rock',true,ct(o)));
 const shr=()=>w.guest.aba_('Programacao').rows;
 // padrões
 const SP=w.guest.showPadrao_;
 ok(SP('2026-12-02')==='20:30'&&SP('2026-12-03')==='20:30'&&SP('2026-12-04')==='21:30'&&SP('2026-12-05')==='21:30'&&SP('2026-12-06')==='','padrão: qua/qui 20:30, sex/sáb 21:30, demais sem padrão');
 sal('2026-12-02','Banda Quarta',{aberto:true});sal('2026-12-04','Banda Sexta',{aberto:true});
 ok(N('2026-12-02').show==='20:30'&&N('2026-12-04').show==='21:30'&&!N('2026-12-04').showCustom,'noites novas herdam o horário padrão');
 w.pub.cacheLimpa_();ok(R(w.pub.dados()).noites.find(x=>x.label.includes('04/12')).show==='21:30','site recebe o horário do show');
 // ajuste
 let e=sal('2026-12-04','Banda Sexta',{aberto:true,show:'22:00'});ok(e.ok!==false&&N('2026-12-04').show==='22:00'&&N('2026-12-04').showCustom==='22:00'&&N('2026-12-04').showPadrao==='21:30','horário ajustado para 22:00');
 const row=shr().find(r=>r[1]==='2026-12-04'||String(r[1]).startsWith('2026-12-04'));ok(row&&row[14]==='22:00','gravado na coluna O da planilha');
 w.pub.cacheLimpa_();ok(R(w.pub.dados()).noites.find(x=>x.label.includes('04/12')).show==='22:00','site mostra o ajuste');
 e=sal('2026-12-04','Banda Sexta',{aberto:true,show:'21:30'});ok(N('2026-12-04').showCustom===''&&N('2026-12-04').show==='21:30','igual ao padrão volta a "padrão" (vazio)');
 e=sal('2026-12-04','Banda Sexta',{aberto:true,show:'20h45'});ok(N('2026-12-04').show==='20:45','aceita 20h45');
 e=sal('2026-12-04','Banda Sexta',{aberto:true,show:'25:00'});ok(e.ok===false&&/Horário do show/.test(e.msg),'horário inválido recusado');
 e=sal('2026-12-04','Banda Sexta',{aberto:true,show:''});ok(N('2026-12-04').show==='21:30','apagar volta ao padrão');
 sal('2026-12-04','Banda Sexta',{aberto:true,show:'22:15'});
 e=R(w.guest.gDiaMover(K,'2026-12-04','2026-12-11'));ok(e.ok!==false&&N('2026-12-11').show==='22:15'&&N('2026-12-04').show==='21:30','mudar data leva o horário ajustado junto');
 // limite 10
 const cfg=w.guest.cfg_();ok(cfg.maxPessoas===10,'limite padrão 10 ('+cfg.maxPessoas+')');
 const mk=n=>Array.from({length:n},(_,i)=>({nome:'Pessoa Numero'+String.fromCharCode(65+i)+' Silva',tel:'(42) 99100-00'+('0'+i).slice(-2)}));
 let r=R(w.pub.reservar({dia:20261202,pessoas:mk(10),cli:'a1'}));ok(r.ok!==false,'reserva de 10 pessoas aceita '+JSON.stringify(r).slice(0,120));
 r=R(w.pub.reservar({dia:20261202,pessoas:mk(11),cli:'a2'}));ok(r.ok===false&&/1 a 10/.test(r.msg||''),'11 pessoas recusadas');
 // página
 let pg=await pagina(w.pub,'/tmp/out/publico/Index.html');await pg.waitForSelector('#noites .noite');
 ok(/20h30|21h30|22h15|Ao vivo/.test(await pg.textContent('#noites')),'ingresso mostra horário do show');
 await pg.click('#noites .noite:first-child');await pg.waitForSelector('#qtd input');
 ok((await pg.getAttribute('#qtd input','max'))==='10','quantidade aceita até 10');
 ok(/mais de 10 pessoas/.test(await pg.textContent('#qtd-h'))&&await pg.$eval('#qtd-h a',a=>decodeURIComponent(a.href).includes('wa.me/')&&decodeURIComponent(a.href).includes('10 pessoas')),'aviso: acima de 10, WhatsApp');
 // painel
 pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K)+";"));
 await pg.waitForSelector('.dc.ev');await pg.click('[data-nav="1"]');await pg.click('.dc.ev[data-d="'+N('2026-12-02').dia+'"]');await pg.waitForSelector('#edd');
 console.log(out.filter(x=>/FAIL/.test(x)).join("\n"),"|",out.length); ok(/show às 20h30/.test(await pg.textContent('body')),'dia mostra "show às 20h30"');
 await pg.click('#edd');await pg.waitForSelector('#f5');ok(await pg.inputValue('#f5')==='20:30','modal: horário do show com padrão');
 await pg.fill('#f5','23:00');await pg.click('#mOk');await pg.waitForTimeout(600);ok(N('2026-12-02').show==='23:00','modal salva horário ajustado');
 await br.close();console.log(out.join('\n'));process.exit(0)
})();
