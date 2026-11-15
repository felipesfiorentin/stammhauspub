const {chromium}=require('playwright');const vm=require('vm'),fs=require('fs');
const G=require('./convidados.json');
const mkSheet=(rows)=>({rows,getLastRow(){return this.rows.length},getMaxRows(){return 5000},insertRowsAfter(){},
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
 const U=w=>w.sheets.Usuarios.rows;const add=(w,u,p,perfil,ativo)=>w.sheets.Usuarios.rows.push([u,u,perfil===undefined?'GESTAO':perfil,ativo||'SIM',p,'','','','']);
 let w=W();
 ok(w.sheets.Usuarios.rows.length===1,'aba Usuarios nasce só com cabeçalho (nenhum usuário inventado)');
 ok(R(w.guest.painel('x'.repeat(40))).code==='sessao'&&R(w.guest.painel('')).code==='sessao','sem login não há dados');
 add(w,'ana','Inicial@1','GESTAO');
 let e=R(w.guest.entrar('ana','errada'));ok(e.ok===false&&e.code==='credenciais','senha errada = credenciais');
 e=R(w.guest.entrar('naoexiste','x'));ok(e.ok===false&&e.code==='credenciais','usuário inexistente = mesma resposta');
 e=R(w.guest.entrar('ANA','Inicial@1'));ok(e.ok&&e.trocar===true&&e.sessao.length>=30,'usuário case-insensitive; primeiro acesso exige troca');
 const s1=e.sessao;
 ok(R(w.guest.painel(s1)).code==='trocar'&&R(w.guest.gMoverConvidado(s1,'G001',19,false)).code==='trocar','antes de trocar a senha nada abre');
 ok(R(w.guest.trocarSenha(s1,'errada','Nova@Senha1')).code==='senha_atual','troca com senha atual errada recusa');
 ok(R(w.guest.trocarSenha(s1,'Inicial@1','123')).code==='senha_fraca','senha fraca recusada');
 ok(R(w.guest.trocarSenha(s1,'Inicial@1','Inicial@1')).code==='senha_fraca','nova igual à inicial recusada');
 ok(R(w.guest.trocarSenha(s1,'Inicial@1','Nova@Senha1')).ok===true,'troca de senha ok');
 ok(!JSON.stringify(U(w)).includes('Nova@Senha1')&&U(w)[1][4]==='','nova senha não fica em texto na planilha; senha inicial é apagada');
 ok(R(w.guest.painel(s1)).ok===true,'após trocar, painel abre com a mesma sessão');
 ok(R(w.guest.entrar('ana','Inicial@1')).ok===false,'senha inicial antiga não funciona mais');
 e=R(w.guest.entrar('ana','Nova@Senha1'));ok(e.ok&&e.trocar===false,'login com a senha nova entra direto');
 // reset: admin coloca nova senha inicial
 U(w)[1][4]='Reset@2026';e=R(w.guest.entrar('ana','Reset@2026'));ok(e.ok&&e.trocar===true,'reset: nova senha inicial na planilha força nova troca');
 ok(R(w.guest.entrar('ana','Nova@Senha1')).ok===false,'após reset a senha antiga deixa de valer');
 // revogar
 w=W();add(w,'bia','Inicial@1','GESTAO');let sb=R(w.guest.entrar('bia','Inicial@1')).sessao;w.guest.trocarSenha(sb,'Inicial@1','Bia@Senha99');
 U(w)[1][3]='NÃO';ok(R(w.guest.painel(sb)).code==='sessao'&&R(w.guest.entrar('bia','Bia@Senha99')).ok===false,'ativo=NÃO derruba sessão e impede login');
 // perfis
 w=W();add(w,'leo','Inicial@1','CONSULTA');add(w,'sem','Inicial@1','');
 const tr=(u)=>{const x=R(w.guest.entrar(u,'Inicial@1')).sessao;w.guest.trocarSenha(x,'Inicial@1','Nova@Senha1');return x};
 const sl=tr('leo'),ss=tr('sem');
 ok(R(w.guest.painel(sl)).perfil==='CONSULTA'&&R(w.guest.painel(ss)).perfil==='CONSULTA','CONSULTA e perfil em branco leem');
 ok(R(w.guest.gMoverConvidado(sl,'G001',19,false)).code==='sem_permissao'&&R(w.guest.gReservaCancelar(ss,'X')).code==='sem_permissao','CONSULTA não grava');
 // bloqueio
 w=W();add(w,'cai','Inicial@1','GESTAO');for(let i=0;i<5;i++)w.guest.entrar('cai','x');
 e=R(w.guest.entrar('cai','Inicial@1'));ok(e.ok===false&&e.code==='bloqueado','5 erros bloqueiam o usuário (mesmo com a senha certa)');
 add(w,'dan','Inicial@1','GESTAO');ok(R(w.guest.entrar('dan','Inicial@1')).ok===true,'bloqueio de um usuário não afeta outro');
 // sair
 w=W();add(w,'eva','Inicial@1','GESTAO');let se=R(w.guest.entrar('eva','Inicial@1')).sessao;w.guest.trocarSenha(se,'Inicial@1','Eva@Senha99');w.guest.sair(se);
 ok(R(w.guest.painel(se)).code==='sessao','sair encerra a sessão');
 // página: login -> troca -> painel
 w=W();add(w,'gui','Inicial@1','GESTAO');
 let pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h);
 await pg.waitForSelector('#lgU');ok(await pg.isVisible('#lgS'),'página abre na tela de login');
 await pg.fill('#lgU','gui');await pg.fill('#lgS','errada');await pg.click('#lgB');await pg.waitForFunction(()=>document.getElementById('lgErr').textContent.length>0);ok((await pg.textContent('#lgErr')).includes('incorretos'),'login errado mostra mensagem');
 await pg.fill('#lgS','Inicial@1');await pg.click('#lgB');await pg.waitForSelector('#tgA');ok((await pg.textContent('.lg h1')).includes('Crie sua senha'),'primeiro acesso abre tela de criar senha');
 await pg.fill('#tgA','Inicial@1');await pg.fill('#tgN','Nova@Senha1');await pg.fill('#tgR','Outra@Senha1');await pg.click('#tgB');ok((await pg.textContent('#tgErr')).includes('não são iguais'),'confirmação diferente é recusada na tela');
 await pg.fill('#tgR','Nova@Senha1');await pg.click('#tgB');await pg.waitForSelector('.grid .nc',{timeout:8000});ok((await pg.$$('.grid .nc')).length===4&&(await pg.textContent('#app')).includes('Últimas movimentações'),'após criar senha o painel único mostra métricas e gestão');
 await pg.click('#bsair');await pg.waitForSelector('#lgU');ok(true,'Sair volta ao login');await pg.close();
 w=W();add(w,'hel','Inicial@1','CONSULTA');const sh2=(()=>{const x=R(w.guest.entrar('hel','Inicial@1')).sessao;w.guest.trocarSenha(x,'Inicial@1','Nova@Senha1');return x})();
 pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(sh2)+";"));
 await pg.waitForSelector('.grid .nc');ok((await pg.$$('button[data-a=mc]')).length===0&&(await pg.textContent('#app')).includes('Perfil de consulta'),'CONSULTA vê tudo sem botões de edição');await pg.close();
 await br.close();console.log(out.join('\n'));
})();