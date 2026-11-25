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
 const resv=()=>w.sheets.Reservas.rows;
 const antes=resv().length;
 let nm=[];for(let i=0;i<12;i++)nm.push(P('Pessoa Numero'+String.fromCharCode(65+i)+' Silva',i<2?'(42) 99700-00'+(10+i):''));
 let e=R(w.guest.gReservaNova(K,20,nm,true));
 ok(e.ok&&e.info.protocolo,'reserva da equipe com 12 pessoas (acima do limite do público) e só 2 celulares');
 const novas=resv().slice(antes);ok(novas.length===12&&novas.every(r=>r[6]==='Confirmado')&&novas[0][7]==='(42) 99700-0010'&&novas[5][5]==='','12 linhas gravadas; celular vazio aceito; titular = 1º celular informado');
 e=R(w.guest.gReservaNova(K,20,[P('Sem Telefone Um',''),P('Sem Telefone Dois','')],true));ok(e.ok,'duas pessoas sem celular não contam como duplicadas');
 e=R(w.guest.gReservaNova(K,20,[P('Telefone Errado Silva','123')],true));ok(e.code==='invalido'&&e.campo==='tel0','celular informado em formato inválido ainda é recusado');
 e=R(w.guest.gReservaNova(K,20,[P('Pessoa Numero A Silva','(42) 99700-0010')],true));ok(e.ok||e.code==='tel_duplicado','celular repetido de reserva ativa: tratado (forçado passa)');
 e=R(w.guest.gReservaNova(K,20,[P('So',''),P('Outro Nome Silva','')],true));ok(e.code==='invalido'&&e.campo==='nome0','nome continua exigindo nome e sobrenome');
 const big=[];for(let i=0;i<301;i++)big.push(P('Pessoa Grande'+i+' Silva',''));ok(R(w.guest.gReservaNova(K,20,big,true)).code==='invalido','teto de segurança de 300');
 const prot=novas[0][1];
 e=R(w.guest.gReservaPessoa(K,prot,'','Adicionada Sem Fone',  '',true));ok(e.ok!==false&&resv().filter(r=>r[1]===prot).length===13,'incluir pessoa em reserva existente sem celular e acima do limite');
 e=R(w.guest.gReservaPessoas(K,prot,[{nome:'Lote Um Silva',tel:''},{nome:'Lote Dois Silva',tel:'(42) 99700-0077'},{nome:'Lote Tres Silva',tel:''}],true));
 ok(e.ok!==false&&resv().filter(r=>r[1]===prot).length===16,'gestão: vários nomes de uma vez numa reserva (3 linhas)');
 const lt=resv().filter(r=>r[1]===prot).slice(-3);ok(lt[0][3]===14&&lt[2][3]===16&&lt[1][5]==='(42) 99700-0077'&&lt[0][5]===''&&lt[0][6]==='Confirmado','sequência continua (14..16), celular opcional por linha');
 e=R(w.guest.gReservaPessoas(K,prot,[{nome:'Novo Nome Silva',tel:''},{nome:'Lote Um Silva',tel:''}],true));ok(e.code==='invalido'&&/Linha 2/.test(e.msg)&&resv().filter(r=>r[1]===prot).length===16,'nome repetido na reserva: recusa o pedido inteiro, nada gravado');
 e=R(w.guest.gReservaPessoas(K,prot,[{nome:'Sozinho',tel:''}],true));ok(e.code==='invalido'&&/Linha 1/.test(e.msg),'cada linha exige nome e sobrenome');
 e=R(w.guest.gReservaPessoas(K,prot,[],true));ok(e.code==='invalido','lista vazia recusada');
 // painel
 let pg=await pagina(w.guest,'/tmp/out/convidados/Painel.html',h=>h.replace("try{SES=sessionStorage.getItem('sh_ses')}catch(e){}","SES="+JSON.stringify(K)+";"));
 await pg.waitForSelector('.dc.ev');await pg.evaluate(()=>novaRes());await pg.waitForSelector('#nq');
 ok(await pg.$$eval('#nl input[id^=n]',a=>a.length)===2,'painel: padrão 2 linhas de pessoa');
 await pg.fill('#nq','6');await pg.waitForTimeout(100);ok(await pg.$$eval('#nl input[id^=n]',a=>a.length)===6&&await pg.$$eval('#nl input[id^=t]',a=>a.length)===6,'painel: número de pessoas = 6 abre 6 pares nome/celular');
 await pg.fill('#n0','Fulano De Tal');await pg.fill('#nq','4');await pg.waitForTimeout(100);ok(await pg.inputValue('#n0')==='Fulano De Tal'&&await pg.$$eval('#nl input[id^=n]',a=>a.length)===4,'painel: mudar a quantidade preserva o digitado');
 ok(/opcional/i.test(await pg.$eval('#t0',e=>e.placeholder)),'painel: celular marcado como opcional');
 await pg.fill('#n1','Beltrana De Tal');await pg.fill('#n2','Ciclano De Tal');await pg.fill('#n3','Maria De Tal');
 const t0=resv().length;await pg.click('#mOk');await pg.waitForTimeout(800);console.log('ERR',await pg.evaluate(()=>(document.getElementById('mErr')||{}).textContent));ok(resv().length===t0+4,'painel: reserva de 4 pessoas sem celular criada ('+(resv().length-t0)+')');
 await br.close();console.log(out.join('\n'));
})();
