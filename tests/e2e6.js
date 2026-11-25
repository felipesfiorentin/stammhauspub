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
 w.guest.Utilities.newBlob=(h,t,n)=>({getAs:()=>({getBytes:()=>Array.from(Buffer.from('%PDF-FAKE '+h.length))}),_h:h});w.guest.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
 let e=R(w.guest.gDiaSalvar(K,'2026-12-05','Banda Nova · Rock','Rock',true));
 ok(e.ok&&e.noites.length===5,'gDiaSalvar abre um dia fora da inauguração');
 const nv=e.noites.find(x=>x.iso==='2026-12-05');ok(nv&&nv.dia===20261205&&nv.label==='Sábado, 05/12'&&nv.atracao==='Banda Nova · Rock'&&nv.restantes===81,'dia novo: chave AAAAMMDD, rótulo, atração e 81 vagas');
 ok(e.noites.map(x=>x.iso).join()==='2026-11-18,2026-11-19,2026-11-20,2026-11-21,2026-12-05','dias em ordem cronológica');
 ok(R(w.guest.gDiaSalvar(K,'2026-02-30','x','y',true)).code==='invalido'&&R(w.guest.gDiaSalvar(K,'abc','x','y',true)).code==='invalido','data inválida recusada');
 e=R(w.guest.gDiaSalvar(K,'2026-12-05','Outra Banda','Pop',true));ok(e.ok&&e.noites.length===5&&e.noites.find(x=>x.iso==='2026-12-05').atracao==='Outra Banda','editar o mesmo dia não duplica');
 e=R(w.guest.gAddConvidado(K,{nome:'Fulano Novo',dia:20261205,acomp:1},false));ok(e.ok&&e.convidados.some(c=>c.nome==='Fulano Novo'&&c.dia===20261205),'incluir convidado no dia novo');
 ok(noite(w,20261205)&&noite(w,20261205).vagas===10,"público vê o dia novo");
 let r=R(w.pub.reservar({dia:20261205,pessoas:[P('Cliente Dois','(42) 99600-0002')],cli:'z'}));ok(r.ok,'reserva do público no dia novo');
 e=R(w.guest.painel(K));ok(e.noites.find(x=>x.dia===20261205).publico===1&&e.noites.find(x=>x.dia===18).publico===0,'contagem por dia isolada');
 e=R(w.guest.gDiaSalvar(K,'2026-12-05','Outra Banda','Pop',false));ok(!R(w.pub.dados()).noites.some(x=>x.dia===20261205)&&R(w.pub.reservar({dia:20261205,pessoas:[P('Cliente Tres','(42) 99600-0003')],cli:'y'})).ok===false,'reservas do público fechadas: some da página e recusa');
 w.guest.gDiaSalvar(K,'2026-12-05','Outra Banda','Pop',true);
 const ro=usr(w,'CONSULTA','lei','Leitor');ok(R(w.guest.gDiaSalvar(ro,'2026-12-06','x','y',true)).code==='sem_permissao','CONSULTA não abre dia');
 r=R(w.guest.gListaPdf(ro,'<html>'+'x'.repeat(80)+'</html>','lista 18/11'));ok(r.ok&&r.nome==='lista_18_11.pdf'&&Buffer.from(r.b64,'base64').toString().startsWith('%PDF'),'PDF de portaria: CONSULTA pode exportar');
 ok(R(w.guest.gListaPdf('x'.repeat(40),'<html>'+'x'.repeat(80)+'</html>','a')).code==='sessao','PDF exige sessão');
 ok(R(w.guest.gListaPdf(K,'curto','a')).code==='invalido','PDF recusa conteúdo inválido');
 // ---- interface
 const br2=br;let pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K)+";"));
 await pg.waitForSelector('.dc.ev');
 ok((await pg.textContent('.cal-h h2')).includes('Novembro de 2026')&&(await pg.$$('.dc.ev')).length===4,'calendário abre no mês atual com 4 dias programados');
 ok(await pg.$eval('[data-nav="-1"]',b=>b.disabled),'não volta antes do mês atual');
 await pg.click('[data-nav="1"]');ok((await pg.textContent('.cal-h h2')).includes('Dezembro de 2026')&&(await pg.$$('.dc.ev')).length===1,'próximo mês mostra o dia 05/12');
 await pg.click('[data-nav="1"]');ok((await pg.$$('.dc.gx')).length===31,'mês sem programação: 31 dias com "+ abrir dia"');
 await pg.click('.dc.gx >> nth=9');await pg.fill('#f1','Show de Janeiro');await pg.click('#mOk');await pg.waitForSelector('.toast');ok((await pg.$$('.dc.ev')).length===1&&(await pg.textContent('.dc.ev')).includes('Show de Janeiro'),'abrir dia pelo calendário');
 await pg.click('[data-nav="0"]');await pg.click('.dc.ev[data-d="18"]');await pg.waitForSelector('#pdf');
 ok((await pg.textContent('.dh h2')).includes('Quarta-feira, 18/11')&&(await pg.$$('[data-back]')).length===1,'clicar no dia abre o detalhe');
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:8000}),pg.click('#pdf')]);ok(dl.suggestedFilename()==='lista-portaria-alfabetica-2026-11-18.pdf','botão exporta PDF alfabético com nome do dia');
 const html=await pg.evaluate(()=>htmlLista(noite(SEL)));ok(html.includes('Lista de portaria')&&html.includes('<th>Nome</th>')&&(html.match(/<tr>/g)||[]).length>50,'HTML da lista tem cabeçalho e linhas');
 await pg.click('[data-back]');await pg.waitForSelector('.cal-g');ok(true,'voltar ao calendário');
 await pg.setViewportSize({width:1280,height:900});await pg.waitForTimeout(200);await pg.screenshot({path:'/tmp/cal_d.png'});await pg.click('.dc.ev[data-d="19"]');await pg.waitForTimeout(200);await pg.screenshot({path:'/tmp/dia_d.png'});await pg.setViewportSize({width:390,height:844});await pg.click('[data-back]');await pg.waitForTimeout(200);await pg.screenshot({path:'/tmp/cal_m.png'});
 await pg.close();
 await br.close();console.log(out.join('\n'));
})();
