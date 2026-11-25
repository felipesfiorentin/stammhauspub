const {chromium}=require('playwright');const vm=require('vm'),fs=require('fs');
const G=require('./convidados.json');
const mkSheet=(rows,cols=12)=>({rows,maxc:cols,getLastRow(){return this.rows.length},getMaxRows(){return 5000},getMaxColumns(){return this.maxc},insertColumnsAfter(c,n){this.maxc+=n},getLastColumn(){return this.maxc},deleteRow(n){this.rows.splice(n-1,1)},clearContents(){this.rows.length=0;return this},setColumnWidths(){},insertRowsAfter(){},
 getRange(r,c,nr=1,nc=1){const s=this;const o={getValues(){return s.rows.slice(r-1,r-1+nr).map(x=>Array.from({length:nc},(_,i)=>(x||[])[c-1+i]??''))},getDisplayValues(){return o.getValues().map(x=>x.map(String))},getFormulas(){return [Array.from({length:nc},()=>'')]},
  copyTo(){},setFontWeight(){return o},getCell(rr,cc){return {setValue(v){s.rows[r-1+rr-1]=s.rows[r-1+rr-1]||[];s.rows[r-1+rr-1][c-1+cc-1]=v}}},
  setValues(v){v.forEach((row,i)=>{s.rows[r-1+i]=s.rows[r-1+i]||[];row.forEach((x,j)=>s.rows[r-1+i][c-1+j]=x)});return o},
  setNumberFormat(){return o},setValue(v){s.rows[r-1]=s.rows[r-1]||[];s.rows[r-1][c-1]=v;return o},getValue(){return (s.rows[r-1]||[])[c-1]??''}};return o},appendRow(a){this.rows.push(a)}});
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
 w.guest.Utilities.newBlob=(h,t,n)=>({getAs:()=>({getBytes:()=>Array.from(Buffer.from('%PDF-FAKE '+h.length))}),_h:h});w.guest.Utilities.base64Encode=b=>Buffer.from(b).toString('base64'); const IN=JSON.parse(fs.readFileSync('/tmp/h/in2.json','utf8'));
 const w2=w;const sheetsC=w2.sheets.Convidados;
 sheetsC.rows.length=0;sheetsC.rows.push(['id','nome','dia','estilo','grupo','acompanhante (0/1)','busca_extra','status','pessoas confirmadas']);
 IN.banco.forEach(b=>sheetsC.rows.push([b.id,b.nome,b.dia,b.estilo,b.grupo,b.acomp,'','Pendente',0]));
 const lista=mkSheet([['#','Data','Nome','Grupo','Estilo','Convite','Telefone'],...IN.rows]);
 const ssGuest=w.guest.SpreadsheetApp.getActiveSpreadsheet();
 w.guest.SpreadsheetApp.openById=id=>id===w.guest.LISTA_ID?{getSheetByName:()=>lista,getSheets:()=>[lista]}:ssGuest;
 const lot=()=>R(w.guest.painel(K)).noites.reduce((a,n)=>(a[n.dia]=n.lista,a),{});
 const antes=lot();
 let e=R(w.guest.gSincronizarLista(K));
 ok(e.ok&&e.info.sync.telefones===137&&e.info.sync.incluidos===15&&e.info.sync.acZerados===7&&e.info.sync.acIncluidos===5&&e.info.sync.removidos===5,'sincronização: '+JSON.stringify(e.info&&e.info.sync));
 const dep=lot();ok(JSON.stringify(dep)===JSON.stringify({18:61,19:55,20:65,21:72}),'lotação garantida após sincronizar: '+JSON.stringify(dep)+' (antes '+JSON.stringify(antes)+')');
 const C=w.sheets.Convidados.rows;const lin=nome=>C.find(r=>r[1]===nome);
 ok(lin('Adilson Strack')[9]==='(47) 99192-9484'&&lin('Adilson Strack')[10]==='Físico','telefone e tipo gravados (J, K)');
 ok(lin('Dayana Moskwyn')[9]==='(47) 99970-8899'&&lin('Rodrigo De Goes Pereira Carvalho')[9]==='(47) 98882-2673','telefones corrigidos pela equipe entram');
 ok(lin('Geraldo Krauss')&&lin('Geraldo Krauss')[2]===18&&lin('Geraldo Krauss')[9]==='(41) 99276-2535','pessoa nova incluída na noite certa, com telefone');
 ok(lin('Bruna Alexia')[5]===0&&lin('Marielen Pereira')[5]===0,'"+1" zerado onde o acompanhante tem nome em linha própria');
 ok(lin('Eduarda Weinfurter')[5]===1&&lin('Pablo Zucco')[5]===1&&lin('Bernardo Ziemann Wendt')[5]===1&&lin('Guimael Barbosa')[5]===1&&lin('Beto Olsen')[5]===1&&lin('Vander Durski')[5]===1,'"+1" revertido no banco onde a lista tirou o nome do acompanhante');
 ok(!['Fauri Cavalheiro','Patricia Pereira','Polly Spanholi','Maria Julia Ziemann Wendt','Mari Barbosa'].some(n=>lin(n))&&C.length===207,'linhas dos acompanhantes antigos removidas (206 convidados): '+C.length);
 ok(lin('Maicon Candeo')[6]==='Maycon Candeo'&&lin('Beto Olsen')[6]==='Roberto Olsen'&&lin('Bruna Alexia')[6]==='Bruna Alexia Antunes'&&lin('Zenilda Lemos')&&lin('Bruna Alexia')&&lin('Zenilda Lemos')[0]!==lin('Bruna Alexia')[0],'nome da lista entra na busca_extra; Zenilda e Bruna seguem como pessoas distintas');
 ok(lin('Roberta Bauer')[2]===20&&lin('Israel Santos')[2]===21,'pessoas que agora têm estilo foram incluídas na noite certa');
 const H=w.sheets.Harmonizacao.rows;ok(H.length>20&&H.some(r=>r[0]==='Só no banco (não está na lista)'&&String(r[1]).includes('Luciano'))&&H.some(r=>r[0]==='Acompanhante com nome removido do banco'),'aba Harmonizacao com as pendências');
 e=R(w.guest.gSincronizarLista(K));ok(e.ok&&e.info.sync.telefones===0&&e.info.sync.incluidos===0&&e.info.sync.acZerados===0&&e.info.sync.acIncluidos===0&&e.info.sync.removidos===0,'segunda sincronização não muda nada (idempotente)');
 const nl=R(w.guest.painel(K)).convidados;const ad=nl.find(c=>c.nome==='Adilson Strack');ok(ad.tel==='(47) 99192-9484'&&ad.tipo==='Físico'&&!ad.env,'estado traz tel, tipo e envio');
 e=R(w.guest.gConviteMarcar(K,ad.id,true));ok(e.ok&&e.convidados.find(c=>c.id===ad.id).env!=='','convite marcado como enviado');
 e=R(w.guest.gConviteMarcar(K,ad.id,false));ok(e.convidados.find(c=>c.id===ad.id).env==='','marcação desfeita');
 e=R(w.guest.gEditarConvidado(K,ad.id,{nome:'Adilson Strack',acomp:0,tel:'(47) 98888-7777'}));ok(e.ok&&e.convidados.find(c=>c.id===ad.id).tel==='(47) 98888-7777','editar telefone');
 e=R(w.guest.gEditarConvidado(K,ad.id,{nome:'Adilson Strack',acomp:0,tel:'123'}));ok(e.ok===false&&e.campo==='tel','telefone inválido recusado');
 w.guest.gEditarConvidado(K,ad.id,{nome:'Adilson Strack',acomp:0,tel:'(47) 99192-9484'});
 // ---- UI
 let pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K)+";"));
 await pg.waitForSelector('.dc.ev');await pg.click('#bconv');await pg.waitForSelector('a.cvz');
 const kp=await pg.$$eval('.kpi b',b=>b.map(x=>x.textContent));
 ok(kp[0]==='206'&&Number(kp[1])>=137&&kp[2]==='0'&&kp[3]===kp[1]&&Number(kp[3])+Number(kp[4])===206,'KPIs de convites: '+kp.join('/'));
 const hs=await pg.$$eval('a.cvz',a=>a.map(x=>x.href));ok(hs.length===Number(kp[3])&&hs.every(h=>/^https:\/\/wa\.me\/55\d{11}\?text=/.test(h)),'um botão por convidado com telefone (filtro "faltam enviar")');
 const tx=decodeURIComponent(hs[0].split('text=')[1]);
 ok(tx.startsWith('Olá, Adilson!')&&tx.includes('Quarta-feira, 18/11')&&tx.includes('Lonesome Capitain')&&tx.includes('o show começa às 21h')&&tx.includes('https://stammhauspub.github.io/convidados/')&&tx.includes('O QUE É BOM RESISTE AO TEMPO.'),'mensagem calorosa personalizada: '+tx.slice(0,60).replace(/\n/g,' '));
 const mAc=await pg.$$eval('a.cvz',a=>a.map(x=>decodeURIComponent(x.href.split('text=')[1])).filter(t=>t.includes('Seu convite inclui um acompanhante')).length);ok(mAc>0,'mensagem cita acompanhante quando há direito ('+mAc+')');
 await pg.selectOption('#cvd','21');await pg.waitForTimeout(150);const n21=await pg.$$eval('a.cvz',a=>a.length);ok(n21>0&&n21<hs.length,'filtro por noite');
 await pg.selectOption('#cvd','todos');await pg.selectOption('#cvf','semtel');await pg.waitForTimeout(150);const semt=await pg.$$eval('tbody tr,table.tb tr',r=>r.length);ok(semt>1,'filtro sem telefone');
 await pg.selectOption('#cvf','falta');await pg.waitForTimeout(150);
 await pg.click('[data-cz]');await pg.waitForTimeout(250);const kp2=await pg.$$eval('.kpi b',b=>b.map(x=>x.textContent));ok(kp2[2]==='1'&&Number(kp2[3])===Number(kp[3])-1,'marcar enviado atualiza os números: '+kp2.join('/'));
 await pg.click('[data-back]');await pg.waitForSelector('.cal-g');ok(true,'voltar ao calendário');
 await pg.close();await br.close();console.log(out.join('\n'));
})();
