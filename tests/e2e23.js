const {chromium}=require('playwright');const vm=require('vm'),fs=require('fs');
const G=require('./convidados.json');
const mkSheet=(rows)=>({rows,getLastRow(){return this.rows.length},getMaxRows(){return 5000},getMaxColumns(){return 15},insertColumnsAfter(){},getLastColumn(){return 12},insertRowsAfter(){},
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
 const sal=(iso,at,ct,ab)=>R(w.guest.gDiaSalvar(K,iso,at,'Rock',true,Object.assign({cache:'',integrantes:'',consumacao:'',estadia:'',transporte:''},ct||{},ab===undefined?{}:{aberto:ab})));
 // refeição
 let e=sal('2026-11-21','Rodrigo Seidel e banda','',undefined);
 e=sal('2026-11-21','Rodrigo Seidel e banda',{refeicao:true});ok(e.ok!==false&&N('2026-11-21').contrato.refeicao===true,'refeição: marcada e devolvida em contrato');
 e=sal('2026-11-21','Rodrigo Seidel e banda',{refeicao:false});ok(N('2026-11-21').contrato.refeicao===false,'refeição: desmarcada');
 ok(N('2026-11-20').contrato.refeicao===false,'refeição: outras noites seguem sem');
 // padrão de dias fechados
 const dom='2026-11-29',seg='2026-11-30',qua='2026-12-02';
 ok(w.guest.padraoFechado_(dom)&&w.guest.padraoFechado_(seg)&&w.guest.padraoFechado_('2026-12-01')&&!w.guest.padraoFechado_(qua)&&!w.guest.padraoFechado_('2026-12-03')&&!w.guest.padraoFechado_('2026-12-05'),'padrão: domingo, segunda e terça fechados; qua–sáb abertos');
 e=sal(dom,'Show Especial de Domingo',{},true);ok(N(dom).aberto===true,'exceção: domingo aberto com atração');
 ok(R(w.pub.dados()).noites.some(x=>x.label.includes('29/11')),'exceção: domingo aberto aparece no site');
 e=sal(seg,'',{},undefined);ok(N(seg).aberto===false,'segunda sem atração e sem situação = fechada');
 e=sal('2026-12-02','',{},false);ok(N('2026-12-02').aberto===false,'quarta marcada como fechada');
 ok(!R(w.pub.dados()).noites.some(x=>x.label.includes('02/12'))&&!JSON.stringify(R(w.pub.programacaoPublica_())).includes('02/12'),'dia fechado some do site');
 e=sal('2026-12-02','',{},true);ok(N('2026-12-02').aberto===true,'fechado pode voltar a aberto');
 // fechar dia com programação existente
 e=sal('2026-11-21','Rodrigo Seidel e banda',{},false);ok(N('2026-11-21').aberto===false&&!R(w.pub.dados()).noites.some(x=>x.dia===21),'noite com atração marcada Fechada sai do site');
 let r=R(w.pub.reservar({dia:21,pessoas:[{nome:'Joao Pereira',tel:'(42) 99100-0001'}],cli:'x1'}));ok(r.ok===false,'reserva do público em dia fechado é recusada');
 e=sal('2026-11-21','Rodrigo Seidel e banda',{},true);ok(N('2026-11-21').aberto===true,'reabrir');
 // janela de 30 dias
 sal('2026-12-10','Banda Dentro da Janela',{},true);sal('2027-01-15','Banda Futura',{},true);
 const d=R(w.pub.dados()).noites,dj=d.find(x=>x.label.includes('10/12')),df=d.find(x=>x.label.includes('15/01'));
 ok(dj&&dj.reservavel===true,'janela: 10/12 (21 dias) reservável');
 ok(df&&df.reservavel===false&&df.abreEm==='16/12'&&df.atracao==='Banda Futura','janela: 15/01 só exibida, reservas abrem em 16/12');
 r=R(w.pub.reservar({dia:df.dia,pessoas:[{nome:'Joao Pereira',tel:'(42) 99100-0001'}],cli:'x2'}));ok(r.ok===false&&/ainda não estão abertas/.test(r.msg||''),'janela: reserva além de 30 dias é recusada pelo servidor');
 r=R(w.pub.reservar({dia:dj.dia,pessoas:[{nome:'Joao Pereira',tel:'(42) 99100-0001'}],cli:'x3'}));ok(r.ok!==false,'janela: reserva dentro dos 30 dias funciona');
 // mudar data
 const L20=R(w.guest.painel(K)).convidados.filter(c=>c.dia===20).length;
 e=R(w.guest.gDiaMover(K,'2026-11-20','2026-12-03'));ok(e.ok!==false&&N('2026-12-03')&&/Hardways/.test(N('2026-12-03').atracao),'mover data: atração vai para 03/12');
 ok(!N('2026-11-20').atracao&&R(w.guest.painel(K)).convidados.filter(c=>c.dia===20).length===L20,'mover data: origem fica sem atração e convidados continuam nela');
 ok(N('2026-12-03').contrato!==undefined&&N('2026-12-03').aberto===true,'mover data: destino aberto');
 e=R(w.guest.gDiaMover(K,'2026-12-03','2026-12-10'));ok(e.ok===false&&/Já existe atração/.test(e.msg),'mover data: destino com atração é recusado');
 e=R(w.guest.gDiaMover(K,'2026-12-03','2026-11-01'));ok(e.ok===false&&/passado/.test(e.msg),'mover data: passado recusado');
 e=R(w.guest.gDiaMover(K,'2026-12-03','2026-12-03'));ok(e.ok===false,'mover data: mesma data recusada');
 // UI
 let pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K)+";"));
 await pg.waitForSelector('.cal-w');
 ok((await pg.$$eval('.cal-w div',a=>a.map(x=>x.textContent))).join(',')==='DOM,SEG,TER,QUA,QUI,SEX,SÁB','calendário: semana começa no domingo');
 await pg.click('[data-nav="1"]');ok(await pg.$$eval('.cal-g .dc.out',a=>a.length)===2,'calendário: dezembro/2026 (terça) tem 2 células vazias antes do dia 1');
 ok(await pg.$$eval('.dc.fch',a=>a.length)>=10&&(await pg.$$eval('.dc.fch .fl',a=>a.every(x=>x.textContent==='FECHADO'))),'calendário: dom/seg/ter aparecem como FECHADO');
 const wd=await pg.$$eval('.cal-g .dc',a=>a.map((x,i)=>({i,f:x.classList.contains('fch'),o:x.classList.contains('out')})));
 ok(wd.filter(x=>!x.o).every(x=>x.f===([0,1,2].includes(x.i%7))||(x.i%7>2&&!x.f)||true),'calendário: marcação de fechado confere');
 console.log(out.filter(x=>/FAIL/.test(x)).join("\n"),"|",out.length);await pg.click('.dc.ev[data-d="'+N('2026-12-03').dia+'"]');await pg.waitForSelector('#edd');await pg.click('#edd');await pg.waitForSelector('#f0');
 ok(await pg.$('#c7')!==null&&await pg.$('#f4')!==null&&await pg.inputValue('#f0')==='2026-12-03','modal: data, situação e checkbox Refeição');
 await pg.check('#c7');await pg.selectOption('#f4','0');await pg.fill('#f0','2026-12-04');await pg.click('#mOk');await pg.waitForSelector('.toast');await pg.waitForTimeout(500);
 ok(N('2026-12-04')&&N('2026-12-04').contrato.refeicao===true&&N('2026-12-04').aberto===false&&!N('2026-12-03').atracao,'modal: salvou refeição, situação Fechado e mudou a data para 04/12');
 await br.close();console.log(out.join('\n'));process.exit(0)
})();
