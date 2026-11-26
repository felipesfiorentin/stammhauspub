const {chromium}=require('playwright');const vm=require('vm'),fs=require('fs');
const G=require('./convidados.json');
const mkSheet=(rows)=>({rows,getLastRow(){return this.rows.length},getMaxRows(){return 5000},getMaxColumns(){return 16},insertColumnsAfter(){},getLastColumn(){return 12},insertRowsAfter(){},
 getRange(r,c,nr=1,nc=1){const s=this;return{getValues(){return s.rows.slice(r-1,r-1+nr).map(x=>Array.from({length:nc},(_,i)=>(x||[])[c-1+i]??''))},
  setValues(v){v.forEach((row,i)=>{s.rows[r-1+i]=s.rows[r-1+i]||[];row.forEach((x,j)=>s.rows[r-1+i][c-1+j]=x)})},
  setNumberFormat(){return this},clearContent(){for(let i=0;i<nr;i++)for(let j=0;j<nc;j++){if(s.rows[r-1+i])s.rows[r-1+i][c-1+j]=""}return this},setValue(v){s.rows[r-1]=s.rows[r-1]||[];s.rows[r-1][c-1]=v},getValue(){return (s.rows[r-1]||[])[c-1]??''}}},appendRow(a){this.rows.push(a)}});
function mundo(cfgExtra=[]){
 const sheets={Convidados:mkSheet([['id','nome','dia','estilo','grupo','acomp','x','x','x','tel'],['G001','Ana Convidada Silva',18,'','',1,'','','','(42) 99111-0001'],['G002','Bruno Convidado Souza',19,'','',0,'','','','(42) 99111-0002'],['G003','Carla Convidada Lima',20,'','',1,'','','','(42) 99111-0003'],['G004','Davi Convidado Reis',21,'','',0,'','','','']]),
  Confirmacoes:mkSheet([['data','id','conv','dia','titNome','titTel','acNome','acTel','pessoas','status'],[new Date('2026-11-10T10:00:00-03:00'),'G001','Ana Convidada Silva',18,'Ana Convidada Silva','(42) 99111-0001','Pedro Acompanhante Silva','(42) 99111-0009',2,'Confirmado'],[new Date('2026-11-10T11:00:00-03:00'),'G002','Bruno Convidado Souza',19,'Bruno Convidado Souza','(42) 99111-0002','','',1,'Confirmado'],[new Date('2026-11-10T12:00:00-03:00'),'G003','Carla Convidada Lima',20,'Carla Convidada Lima','','','',0,'Recusou'],[new Date('2026-11-09T12:00:00-03:00'),'G002','Bruno Convidado Souza',19,'Bruno X','','','',1,'Substituído']]),
  Programacao:mkSheet([['Dia','Data','Atração','Estilo','Instagram'],[18,new Date('2026-11-18T00:00:00-03:00'),'Lonesome Capitain · Country & Folk','Formal','@a'],[19,new Date('2026-11-19T00:00:00-03:00'),'Os Bauretz · Soul, Disco & MPB','MPB','@b'],[20,new Date('2026-11-20T00:00:00-03:00'),'Hardways · Classic Rock','Rock','@c'],[21,new Date('2026-11-21T00:00:00-03:00'),'Rodrigo Seidel e banda · Pop Rock','Pop Rock','@d']]),
  Config:mkSheet([['Parâmetro','Valor'],['capacidade_por_noite',74],['mesas',19],['whatsapp_contato',''],['horario',''],...cfgExtra])};
 const cache={};let uu=0;const triggers=[];
 const mkctx=(files)=>{const ctx={Date:global.Date,console,
  SpreadsheetApp:{flush(){},getActiveSpreadsheet:()=>ss,openById:()=>ss},
  CacheService:{getScriptCache:()=>({get:k=>(!global.__CACHE&&/^(dados|prog)_v2$/.test(k))?null:(cache[k]??null),put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
  LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})},
  ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/macros/s/TESTE/exec'}),getProjectTriggers:()=>triggers,newTrigger:(f)=>({timeBased:()=>({everyMinutes:()=>({create:()=>triggers.push({getHandlerFunction:()=>f})})})})},
  HtmlService:{},PropertiesService:{getScriptProperties:()=>({getProperty:k=>(global.__PROP||{})[k]||null,setProperty:(k,v)=>{(global.__PROP=global.__PROP||{})[k]=v}})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,v)=>Array.from(require('crypto').createHash('sha256').update(String(v),'utf8').digest()).map(x=>x>127?x-256:x),getUuid:()=>'u'+(++uu).toString(16).padStart(8,'0')+'-aaaa-bbbb-cccc-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12),
   formatDate(d,tz,f){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
    if(f==='u')return String(new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()||7);if(f==='yyyy-MM-dd')return p.year+'-'+p.month+'-'+p.day;if(f==='dd/MM')return p.day+'/'+p.month;return p.day+'/'+p.month+' 00:00'}}};
  vm.createContext(ctx);vm.runInContext(files.map(f=>fs.readFileSync(f,'utf8')).join('\n'),ctx);return ctx};
 const ss={getName:()=>'T',getId:()=>'ID',getUrl:()=>'x',getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=mkSheet([]),getSpreadsheetTimeZone:()=>'America/Sao_Paulo'};
 return{sheets,guest:mkctx(['/tmp/out/convidados/Code.gs']),pub:mkctx(['/tmp/out/publico/Code.gs'].map(f=>f))}}
const R=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const out=[];const ok=(c,m)=>{out.push((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
 let pubSrc=fs.readFileSync('/tmp/out/publico/Code.gs','utf8').replace("'__SHEET_ID__'","'ID_TESTE'");
 function W(cfg){const w=mundo(cfg);const ss=w.guest.SpreadsheetApp.getActiveSpreadsheet();
  const pctx=vm.createContext({Date:global.Date,console,SpreadsheetApp:{flush(){},openById:()=>ss,getActiveSpreadsheet:()=>ss},CacheService:w.guest.CacheService,LockService:w.guest.LockService,ScriptApp:w.guest.ScriptApp,HtmlService:{},Utilities:w.guest.Utilities});
  vm.runInContext(pubSrc,pctx);w.pub=pctx;w.guest.prepararReservas();return w}
 const usr=(w,perfil)=>{const u='u'+Math.random().toString(36).slice(2,6);w.sheets.Usuarios.rows.push([u,'Felipe',perfil||'GESTAO','SIM','Inicial@123','','','','']);const e=R(w.guest.entrar(u,'Inicial@123'));w.guest.trocarSenha(e.sessao,'Inicial@123','Senha@Nova1');return e.sessao};
 const w=W(),K=usr(w),rows=()=>w.sheets.Reservas.rows;
 ok(typeof w.guest.buscarNome==='undefined'&&typeof w.guest.gAddConvidado==='undefined'&&typeof w.guest.confirmar==='undefined','funções de convidados não existem mais no projeto de gestão');
 // ---- legado
 let e=R(w.guest.painel(K));ok(e.convidados===undefined,'estado do painel sem "convidados"');
 ok(e.legado&&e.legado.abas&&e.legado.convites===4&&e.legado.pendentes>=0,'painel traz o resumo do legado');
 w.guest.legadoMigrarSeguro_();
 const L=rows().filter(r=>/^legado/.test(String(r[13]||'')));
 ok(L.length===5,'migrou 5 linhas (2+1 confirmadas, 1 recusa, 1 sem resposta) → '+L.length);
 ok(L.filter(r=>r[6]==='Confirmado').length===3&&L.filter(r=>r[6]==='Cancelado').length===2,'3 confirmadas e 2 canceladas (legado)');
 ok(L.some(r=>r[1]==='G001'&&r[3]===1&&r[4]==='Ana Convidada Silva')&&L.some(r=>r[1]==='G001'&&r[3]===2&&r[4]==='Pedro Acompanhante Silva'),'titular e acompanhante viram 2 linhas com o protocolo do convite');
 ok(!L.some(r=>r[4]==='Bruno X'),'confirmação "Substituído" ignorada');
 w.guest.legadoMigrarSeguro_();ok(rows().filter(r=>/^legado/.test(String(r[13]||''))).length===5,'migração idempotente (não duplica)');
 const cf=R(w.guest.gLegadoEstado_());ok(cf.conferencia&&cf.conferencia.confere&&cf.conferencia.pessoasEsperadas===3,'conferência bate (3 pessoas confirmadas)');
 ok(!R(w.pub.dados()).noites.some(n=>n.dia===18&&n.lotado),'dados do público seguem normais');
 const ac=R(w.pub.consultar?w.pub.consultar({nome:'Ana Convidada Silva',tel:'(42) 99111-0001'}):{ok:true});ok(!(ac&&ac.reservas&&ac.reservas.length),'legado não aparece na consulta do público');
 // ---- bonificada
 let r=R(w.guest.gReservaNova(K,19,[{nome:'Joao da Banda',tel:'',bonif:true},{nome:'Maria Pagante Souza',tel:''}],true));ok(r.ok!==false,'cria reserva com 1 bonificada');
 e=R(w.guest.painel(K));let g=e.reservas.find(x=>x.pessoas.some(p=>p.nome==='Joao da Banda'));
 ok(g&&g.pessoas.find(p=>p.nome==='Joao da Banda').bonif===true&&g.pessoas.find(p=>p.nome==='Maria Pagante Souza').bonif===false,'bonificada por pessoa no estado');
 let n=e.noites.find(x=>x.dia===19);const b0=n.bonificadas,p0=n.pagantes;ok(b0===1&&n.publico-n.bonificadas===n.pagantes&&n.receita===n.pagantes*n.valor,'noite: bonificadas, pagantes e receita só dos pagantes');
 ok(n.total>=n.publico,'bonificada ocupa vaga no total');
 r=R(w.guest.gReservaBonificar(K,g.prot,[],true));e=R(w.guest.painel(K));n=e.noites.find(x=>x.dia===19);ok(n.bonificadas===2,'bonificar todos');
 r=R(w.guest.gReservaBonificar(K,g.prot,[g.pessoas[1].linha],false));e=R(w.guest.painel(K));n=e.noites.find(x=>x.dia===19);ok(n.bonificadas===1,'remover bonificação de uma pessoa');
 r=R(w.guest.gReservaPessoas(K,g.prot,[{nome:'Zeca Extra Lima',tel:'',bonif:true}],true));e=R(w.guest.painel(K));n=e.noites.find(x=>x.dia===19);ok(n.bonificadas===2,'incluir pessoa já bonificada');
 const Kc=usr(w,'CONSULTA');r=R(w.guest.gReservaBonificar(Kc,g.prot,[],true));ok(r.ok===false&&r.code==='sem_permissao','perfil de consulta não bonifica');
 w.pub.cacheLimpa_&&w.pub.cacheLimpa_();
 // ---- apagar abas
 w.guest.DriveApp={getFileById:()=>({makeCopy:(n)=>({getId:()=>'COPIA'})})};w.guest.eval&&0;
 vm.runInContext("DriveApp={getFileById:function(){return{makeCopy:function(){return{getId:function(){return 'COPIA'}}}}}};ss_().deleteSheet=function(s){delete this.__x};",w.guest);
 const ss=w.guest.SpreadsheetApp.getActiveSpreadsheet();ss.deleteSheet=s=>{for(const k in w.sheets)if(w.sheets[k]===s)delete w.sheets[k]};
 r=R(w.guest.gLegadoApagar(K));ok(r.ok!==false&&!w.sheets.Convidados&&!w.sheets.Confirmacoes,'apaga Convidados e Confirmacoes depois de conferir');
 ok(rows().filter(x=>/^legado/.test(String(x[13]||''))).length===5,'dados de legado continuam em Reservas');
 e=R(w.guest.painel(K));ok(e.ok!==false&&(!e.legado||!e.legado.abas),'painel funciona sem as abas antigas');
 // ---- UI do painel
 const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const pg=await br.newPage({viewport:{width:1100,height:900}});
 await pg.exposeFunction('__call',(fn,args)=>R(w.guest[fn](...args)));
 await pg.addInitScript(()=>{const mk=(s,f)=>new Proxy({},{get:(_,fn)=>(...a)=>{window.__call(fn,a).then(s,f)}});window.google={script:{run:{withSuccessHandler(s){return{withFailureHandler(f){return mk(s,f)}}}}}}});
 let h=fs.readFileSync('/tmp/out/convidados/Painel.html','utf8').replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K)+";");fs.writeFileSync('/tmp/pg31.html',h);
 const errs=[];pg.on('pageerror',x=>errs.push(String(x)));await pg.goto('file:///tmp/pg31.html');await pg.waitForTimeout(1500);
 await pg.waitForSelector('.dc.ev');
 const txt=await pg.textContent('body');ok(!/Convites WhatsApp|convidados confirmados|Incluir convidado/i.test(txt),'calendário sem textos de convidados');ok(/Entradas bonificadas/.test(txt),'KPI de entradas bonificadas');
 await pg.click('.dc.ev[data-d="19"]');await pg.waitForSelector('.res');
 ok(await pg.$('[data-a="rbp"]')!==null&&await pg.$('[data-a="rb"]')!==null,'botões de bonificar por pessoa e por reserva');
 ok(/bonificada/.test(await pg.textContent('#app')),'etiqueta bonificada na lista');
 await pg.click('[data-a="rbp"][data-m="1"]');await pg.waitForTimeout(400);
 const nb=await pg.evaluate(()=>noite(19).bonificadas);ok(nb===3,'clique em Bonificar atualiza a noite ('+nb+')');
 const html=await pg.evaluate(()=>htmlLista(noite(SEL),'alfa')+htmlLista(noite(SEL),'grupo'));ok(/ENTRADA BONIFICADA/.test(html),'PDF da lista marca entrada bonificada');
 await pg.click('#addr');await pg.waitForSelector('#nb');await pg.check('#nb');await pg.fill('#n0','Fulano Banda Um');await pg.fill('#n1','Fulano Banda Dois');await pg.click('#mOk');await pg.waitForTimeout(500);
 ok(await pg.evaluate(()=>S.reservas.some(r=>r.pessoas.some(p=>p.nome==='Fulano Banda Um'&&p.bonif))),'nova reserva com "entrada bonificada para todos"');
 await pg.click('[data-back]');await pg.waitForTimeout(200);ok(errs.length===0,'sem erros de JS na página '+errs.join('|'));
 await br.close();console.log(out.join('\n'));process.exit(0)
})();
