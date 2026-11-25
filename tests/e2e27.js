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
  CacheService:{getScriptCache:()=>({get:k=>(!global.__CACHE&&/^(dados|prog)_v2$/.test(k))?null:(cache[k]??null),put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
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
 const E0={cache:'',integrantes:'',consumacao:'',estadia:'',transporte:''};
 let r=R(w.guest.gDiaSalvar(K,'2026-12-09','Banda Preco','Rock',true,Object.assign({aberto:true},E0)));
 let d=R(w.pub.dados()).noites.find(x=>x.iso==='2026-12-09');ok(d&&d.valor===40,'omitido = padrão 40 (público)');
 r=R(w.guest.gDiaSalvar(K,'2026-12-09','Banda Preco','Rock',true,Object.assign({aberto:true,valor:'55,50'},E0)));ok(r.ok!==false,'salva valor 55,50');
 d=R(w.pub.dados()).noites.find(x=>x.iso==='2026-12-09');ok(d&&d.valor===55.5,'público vê 55,50 nesta noite');
 let e=R(w.guest.painel(K));let n=e.noites.find(x=>x.iso==='2026-12-09');ok(n&&n.valor===55.5&&n.valorCustom===55.5,'painel traz valor efetivo e custom');
 ok(e.noites.filter(x=>x.iso!=='2026-12-09'&&x.valor!==40).length===0,'demais noites seguem em 40');
 const rs=R(w.pub.reservar({dia:20261209,pessoas:[{nome:'Joao Pereira',tel:'(42) 99100-0001'}],cli:'c1'}));ok(rs.ok&&rs.resumo.valor===55.5,'resumo da reserva usa o valor da noite');
 r=R(w.guest.gDiaSalvar(K,'2026-12-09','Banda Preco','Rock',true,Object.assign({aberto:true,valor:'abc'},E0)));ok(r.ok===false&&r.campo==='valor','valor inválido rejeitado');
 r=R(w.guest.gDiaMover(K,'2026-12-09','2026-12-10'));ok(r.ok!==false,'mover dia');
 e=R(w.guest.painel(K));ok(e.noites.find(x=>x.iso==='2026-12-10').valor===55.5&&e.noites.find(x=>x.iso==='2026-12-09').valor===40,'valor acompanha a atração ao mudar de data');
 r=R(w.guest.gDiaSalvar(K,'2026-12-10','Banda Preco','Rock',true,Object.assign({aberto:true,valor:''},E0)));e=R(w.guest.painel(K));ok(e.noites.find(x=>x.iso==='2026-12-10').valor===40,'vazio volta ao padrão 40');
 r=R(w.guest.gDiaSalvar(K,'2026-12-10','Banda Preco','Rock',true,Object.assign({aberto:true,valor:'0'},E0)));ok(r.ok!==false,'aceita valor 0');
 e=R(w.guest.painel(K));n=e.noites.find(x=>x.iso==='2026-12-10');ok(n.valor===0&&n.valorCustom===0&&n.receita===0,'painel: valor 0 (grátis), distinto de vazio');
 w.pub.cacheLimpa_();d=R(w.pub.dados()).noites.find(x=>x.iso==='2026-12-10');ok(d&&d.valor===0,'público recebe valor 0');
 let rs0=R(w.pub.reservar({dia:20261210,pessoas:[{nome:'Maria Souza',tel:'(42) 99100-0002'}],cli:'c2'}));ok(rs0.ok&&rs0.resumo.valor===0,'resumo da reserva grátis = 0');
 r=R(w.guest.gDiaSalvar(K,'2026-12-10','Banda Preco','Rock',true,Object.assign({aberto:true,valor:''},E0)));e=R(w.guest.painel(K));ok(e.noites.find(x=>x.iso==='2026-12-10').valor===40,'vazio volta a 40 depois de 0');
 console.log(out.join('\n'));process.exit(0)
})();
