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
 const vis=async(pg,id)=>!(await pg.$eval('#'+id,e=>e.classList.contains('hide')));
 const P=(n,t)=>({nome:n,tel:t});
 const noite=(w,d)=>R(w.pub.dados()).noites.find(x=>x.dia===d);
 const cnt=(w,d)=>R(w.guest.lotacaoTodas_()).find(x=>x.dia===d);
 const sh=(w,n)=>w.sheets[n].rows;
 const usr=(w,perfil,usuario,nome)=>{const u=usuario||'felipe';w.sheets.Usuarios.rows.push([u,nome||'Felipe',perfil||'GESTAO','SIM','Inicial@123','','','','']);const e=R(w.guest.entrar(u,'Inicial@123'));w.guest.trocarSenha(e.sessao,'Inicial@123','Senha@Nova1');return e.sessao};
 let w=W();
 const K=usr(w,'GESTAO'),KL=usr(w,'CONSULTA','leitor','Leitor');
 let e=R(w.guest.painel(K));ok(e.ok&&e.noites.length===4&&e.convidados.length===G.length&&e.noites[0].total===63,'gestão abre com dados e lotação 63 na noite 18');
 ok(R(w.guest.painel('x'.repeat(40))).code==='sessao'&&R(w.guest.painel(KL)).perfil==='CONSULTA'&&R(w.guest.gMoverConvidado(KL,'G001',19,false)).code==='sem_permissao','sessão inválida = sessao; consulta lê (perfil CONSULTA) mas não grava');
 // mover convidado
 const g1=G.find(g=>g.dia===18);let before18=cnt(w,18).total,before19=cnt(w,19).total,c1=1+g1.acomp;
 e=R(w.guest.gMoverConvidado(K,g1.id,19,false));ok(e.ok&&cnt(w,18).total===before18-c1&&cnt(w,19).total===before19+c1&&sh(w,'Convidados').find(r=>r[0]===g1.id)[2]===19,'mover convidado: lotação sai de 18 e entra em 19');
 ok(R(w.guest.gMoverConvidado(K,g1.id,19,false)).code==='mesmo_dia'&&R(w.guest.gMoverConvidado(K,g1.id,99,false)).code==='dia_invalido','mover: mesmo dia / dia inválido');
 ok(sh(w,'Auditoria').some(r=>String(r[2]).includes('Moveu')),'ação registrada na Auditoria');
 // confirmado muda de dia junto com a confirmação
 w.guest.confirmar({id:'G002',titNome:G.find(g=>g.id==='G002').nome,titTel:'(42) 98111-0001',vaiAcomp:false});
 const g2=G.find(g=>g.id==='G002');e=R(w.guest.gMoverConvidado(K,'G002',20,false));
 ok(e.convidados.find(c=>c.id==='G002').dia===20&&sh(w,'Confirmacoes').filter(r=>r[1]==='G002').every(r=>r[3]===20),'confirmação acompanha o convidado para a nova noite');
 // teto: bloqueia e permite forçar
 w=W();const K2=usr(w);
 const falta=81-cnt(w,18).total;for(let i=0;i<falta;i++)w.pub.reservar({dia:18,pessoas:[P('Cliente '+'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i%26]+' Teste','(42) 9'+String(7000000+i).padStart(8,'0').replace(/(\d{4})(\d{4})/,'$1-$2'))],cli:'q'+i});
 const gm=G.find(g=>g.dia===19);ok(cnt(w,18).lotado,'preparo: noite 18 lotada ('+cnt(w,18).total+')');
 e=R(w.guest.gMoverConvidado(K2,gm.id,18,false));ok(e.code==='lotado'&&sh(w,'Convidados').find(r=>r[0]===gm.id)[2]===19,'mover para noite lotada: bloqueia sem alterar');
 e=R(w.guest.gMoverConvidado(K2,gm.id,18,true));ok(e.ok&&cnt(w,18).total>81&&String(sh(w,'Auditoria').slice(-1)[0][3]).includes('forçado'),'forçar passa do teto e registra "forçado"');
 // incluir convidado
 w=W();const K3=usr(w);
 let tot=cnt(w,20).total;e=R(w.guest.gAddConvidado(K3,{nome:'Extra Convidado Silva',dia:20,acomp:1},false));
 ok(e.ok&&cnt(w,20).total===tot+2&&e.convidados.some(c=>c.nome==='Extra Convidado Silva'&&c.id===('G'+('000'+(G.length+1)).slice(-3))),'incluir convidado com acompanhante: novo id, +2 na lotação');
 ok(R(w.guest.gAddConvidado(K3,{nome:'Extra Convidado Silva',dia:20,acomp:0},false)).code==='duplicado'&&R(w.guest.gAddConvidado(K3,{nome:'X',dia:20},false)).code==='invalido','incluir: duplicado e nome inválido barrados');
 // status
 const gs=G.find(g=>g.dia===21&&g.acomp===1);tot=cnt(w,21).total;
 e=R(w.guest.gStatusConvidado(K3,gs.id,'nao_vai',{},false));ok(e.ok&&cnt(w,21).total===tot-2&&e.convidados.find(c=>c.id===gs.id).status==='Não vai','marcar "não vai" libera titular+acompanhante');
 e=R(w.guest.gStatusConvidado(K3,gs.id,'confirmar',{titNome:gs.nome,titTel:'(42) 98222-0001',acNome:'Acomp Teste Souza',acTel:''},false));ok(e.ok&&e.convidados.find(c=>c.id===gs.id).pessoas===2&&cnt(w,21).total===tot,'confirmar com acompanhante: 2 pessoas, lotação volta');
 e=R(w.guest.gStatusConvidado(K3,gs.id,'pendente',{},false));ok(e.ok&&e.convidados.find(c=>c.id===gs.id).status==='Pendente'&&sh(w,'Confirmacoes').filter(r=>r[1]===gs.id&&r[9]!=='Substituído').length===0,'voltar a pendente: nenhuma linha ativa');
 const gn=G.find(g=>g.dia===21&&g.acomp===0);ok(R(w.guest.gStatusConvidado(K3,gn.id,'confirmar',{titNome:gn.nome,titTel:'',acNome:'Fulano Qualquer Silva'},false)).code==='invalido','acompanhante em convite sem direito: barrado');
 // editar
 e=R(w.guest.gEditarConvidado(K3,gn.id,{nome:'Nome Corrigido Silva',acomp:0}));ok(e.ok&&e.convidados.find(c=>c.id===gn.id).nome==='Nome Corrigido Silva','editar nome do convidado');
 // reservas
 let rr=R(w.pub.reservar({dia:18,pessoas:[P('Joao Pereira','(42) 99100-0001'),P('Maria Pereira','(42) 99100-0002')],cli:'a'}));const prot=rr.protocolo||R(w.guest.painel(K3)).reservas[0].prot;
 tot=cnt(w,19).total;e=R(w.guest.gReservaMover(K3,prot,19,false));ok(e.ok&&cnt(w,19).total===tot+2&&e.reservas.find(x=>x.prot===prot).dia===19,'mover reserva inteira de noite');
 e=R(w.guest.gReservaPessoa(K3,prot,'','Terceiro Convidado Lima','(42) 99100-0003',false));ok(e.ok&&e.reservas.find(x=>x.prot===prot).pessoas.length===3,'incluir pessoa na reserva');
 e=R(w.guest.gReservaPessoa(K3,prot,'','Quarto Convidado Lima','(42) 99100-0003',false));ok(e.code==='invalido','celular repetido na reserva barrado');
 const ln=e.ok?0:R(w.guest.painel(K3)).reservas.find(x=>x.prot===prot).pessoas[2].linha;
 e=R(w.guest.gReservaPessoa(K3,prot,ln,'Terceiro Editado Lima','(42) 99100-0009',false));ok(e.ok&&e.reservas.find(x=>x.prot===prot).pessoas[2].nome==='Terceiro Editado Lima','editar pessoa da reserva');
 e=R(w.guest.gReservaRemoverPessoa(K3,prot,ln));ok(e.ok&&e.reservas.find(x=>x.prot===prot).pessoas.length===2,'remover pessoa da reserva');
 e=R(w.guest.gReservaNova(K3,20,[P('Equipe Um Silva','(42) 99300-0001'),P('Equipe Dois Silva','(42) 99300-0002')],false));ok(e.ok&&e.info.protocolo&&e.reservas.some(x=>x.prot===e.info.protocolo&&x.dia===20),'nova reserva criada pela equipe');
 ok(R(w.guest.gReservaNova(K3,20,[P('Equipe Tres Silva','(42) 99300-0001')],false)).code==='tel_duplicado','nova reserva: celular já em reserva ativa barrado');
 tot=cnt(w,19).total;e=R(w.guest.gReservaCancelar(K3,prot));ok(e.ok&&cnt(w,19).total===tot-2&&!e.reservas.some(x=>x.prot===prot),'cancelar reserva libera vagas');
 ok(R(w.guest.gReservaCancelar(K3,prot)).code==='nao_encontrado','cancelar de novo: não encontrada');
 // página
 w=W();const K4=usr(w);w.pub.reservar({dia:18,pessoas:[P('Cliente Um','(42) 99600-0001')],cli:'k'});
 let pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K4)+";"));
 await pg.waitForSelector('.dc.ev',{timeout:8000});ok((await pg.$$('.dc.ev')).length===4&&(await pg.textContent('#app')).includes('64'),'página: calendário com 4 dias programados e lotação');await pg.click('.dc.ev[data-d="18"]');await pg.waitForSelector('#busca');
 await pg.fill('#busca',g1.nome.split(' ')[0]);await pg.waitForTimeout(150);ok((await pg.$$('.tb tr')).length>1,'página: busca de convidado');
 await pg.fill('#busca','');await pg.click('button[data-a=mc] >> nth=0');await pg.selectOption('#f1',{index:0});await pg.click('#mOk');await pg.waitForSelector('.toast');ok(sh(w,'Auditoria').length>=2,'página: mover convidado grava e atualiza');
 await pg.click('[data-tab=res]');ok((await pg.textContent('#app')).includes('Cliente Um'),'página: aba de reservas lista o público');
 await pg.screenshot({path:'shot_gestao.png',fullPage:true});await pg.close();
 {const c=w.guest;c.HtmlService={XFrameOptionsMode:{ALLOWALL:1},createTemplateFromFile:(n)=>({evaluate(){return{setTitle(){return this},addMetaTag(){return this},setXFrameOptionsMode(){return this},_t:n}}}),createHtmlOutputFromFile:(n)=>({setTitle(){return this},addMetaTag(){return this},setXFrameOptionsMode(){return this},_t:n})};
  ok(c.doGet({parameter:{p:'painel'}})._t==='Painel','doGet: ?p=painel abre o painel')}
 ok(!/Strack|AKfycb/.test(fs.readFileSync('/tmp/out/convidados/Painel.html','utf8')),'Painel.html sem dados embutidos');
 await br.close();console.log(out.join('\n'));
})();
