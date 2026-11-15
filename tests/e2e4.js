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
  CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/macros/s/TESTE/exec'}),getProjectTriggers:()=>triggers,newTrigger:(f)=>({timeBased:()=>({everyMinutes:()=>({create:()=>triggers.push({getHandlerFunction:()=>f})})})})},
  HtmlService:{},
  Utilities:{getUuid:()=>'u'+(++uu).toString(16).padStart(8,'0')+'-aaaa-bbbb-cccc-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12),
   formatDate(d,tz,f){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
    if(f==='u')return String(new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()||7);if(f==='yyyy-MM-dd')return p.year+'-'+p.month+'-'+p.day;if(f==='dd/MM')return p.day+'/'+p.month;return p.day+'/'+p.month+' 00:00'}}};
  vm.createContext(ctx);vm.runInContext(files.map(f=>fs.readFileSync(f,'utf8')).join('\n'),ctx);return ctx};
 const ss={getName:()=>'T',getId:()=>'ID',getUrl:()=>'x',getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=mkSheet([]),getSpreadsheetTimeZone:()=>'America/Sao_Paulo'};
 return{sheets,guest:mkctx(['../apps-script/convidados/Code.gs']),pub:mkctx(['../apps-script/publico/Code.gs'].map(f=>f))}}
const R=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const out=[];const ok=(c,m)=>{out.push((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
 // público com SHEET_ID de teste
 let pubSrc=fs.readFileSync('../apps-script/publico/Code.gs','utf8').replace("'__SHEET_ID__'","'ID_TESTE'");fs.writeFileSync('/tmp/pub_teste.gs',pubSrc);
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
 const ligar=(w,v)=>{const r=w.sheets.Config.rows.find(x=>x[0]==='whatsapp_ativo');ok(!!r&&r[1]==='NAO','prepararReservas semeia whatsapp_ativo=NAO');r[1]=v};
 const preparaEnvio=(w)=>{const props={WA_TOKEN:'tok',WA_PHONE_ID:'123'},chamadas=[];
  w.pub.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v}})};
  w.pub.ingressoImagem_=(dia,nome,prot)=>({getContentType:()=>'image/png',nome:nome});
  w.pub.pastaDia_=()=>({createFile:()=>{}});
  w.pub.UrlFetchApp={fetch:(u,o)=>{chamadas.push({u,o});if(/\/media$/.test(u))return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({id:'MID'+chamadas.length})};
    if(props.FALHA)return{getResponseCode:()=>400,getContentText:()=>JSON.stringify({error:{message:'template inexistente'}})};
    return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({messages:[{id:'wamid.'+chamadas.length}]})}}};
  w.pub.Utilities=w.guest.Utilities;w.pub.LockService={getScriptLock:()=>({waitLock(){},tryLock:()=>true,releaseLock(){}})};return{props,chamadas}};
 // desligado: nada é enfileirado
 let w=W();w.pub.reservar({dia:18,pessoas:[P('Joao Pereira','(42) 99100-0001')],cli:'a'});
 ok(!w.sheets.Whats||w.sheets.Whats.rows.length<=1,'desligado: reserva não enfileira WhatsApp');
 // ligado: reserva com 3 pessoas -> 3 linhas, uma por celular
 w=W();ligar(w,'SIM');const E=preparaEnvio(w);
 let r=R(w.pub.reservar({dia:19,pessoas:[P('Joao Pereira','(42) 99100-0001'),P('Maria Pereira','(42) 99100-0002'),P('Pedro Pereira','(42) 99100-0003')],cli:'a'}));
 ok(r.ok&&sh(w,'Whats').length===4&&sh(w,'Whats').slice(1).every(x=>x[6]==='PENDENTE'&&x[1]==='R'&&x[3]===19),'reserva de 3 pessoas -> 3 itens na fila (um por celular)');
 const prot=sh(w,'Whats')[1][2];
 // convidado confirma com acompanhante -> 2 itens
 const gc=G.find(g=>g.acomp===1);w.guest.confirmar({id:gc.id,titNome:gc.nome,titTel:'(42) 98000-0001',vaiAcomp:true,acNome:'Acomp Teste Souza',acTel:'(42) 98000-0002'});
 ok(sh(w,'Whats').filter(x=>x[1]==='C'&&x[2]===gc.id).length===2,'convidado + acompanhante -> 2 itens na fila');
 // sem duplicar ao gravar de novo
 w.guest.enfileirarWhats_('C',gc.id,gc.dia,[{nome:gc.nome,tel:'(42) 98000-0001'}]);ok(sh(w,'Whats').filter(x=>x[1]==='C'&&x[2]===gc.id).length===2,'enfileirar é idempotente');
 // processa
 let pr=R(w.pub.processarFilaWhats());const st=sh(w,'Whats').slice(1).map(x=>x[6]);
 ok(pr.ok&&st.every(s=>s==='ENVIADO')&&sh(w,'Whats')[1][8].startsWith('wamid'),'fila processada: todos ENVIADO com wamid ('+st.join(',')+')');
 const envio=E.chamadas.filter(c=>/\/messages$/.test(c.u)).map(c=>JSON.parse(c.o.payload));
 ok(envio.length===5&&envio[0].to==='5542991000001'&&envio[0].type==='template'&&envio[0].template.components[0].parameters[0].image.id.startsWith('MID')&&envio[0].template.components[1].parameters[0].text==='Joao'&&envio[0].template.components[1].parameters[3].text===prot,'payload do template: número 55+DDD, imagem por id, primeiro nome, protocolo');
 ok(E.chamadas.every(c=>c.o.headers.Authorization==='Bearer tok'),'token enviado só no cabeçalho');
 ok(R(w.pub.processarFilaWhats()).feitos===0,'segunda rodada: nada a enviar (sem duplicar mensagens)');
 // falha: 3 tentativas -> FALHOU; reenviar pela gestão
 w=W();ligar(w,'SIM');const E2=preparaEnvio(w);E2.props.FALHA='1';w.pub.reservar({dia:20,pessoas:[P('Joao Pereira','(42) 99100-0001')],cli:'a'});
 w.pub.processarFilaWhats();ok(sh(w,'Whats')[1][6]==='PENDENTE'&&sh(w,'Whats')[1][7]===1&&String(sh(w,'Whats')[1][9]).includes('template inexistente'),'falha: continua na fila com erro registrado');
 w.pub.processarFilaWhats();w.pub.processarFilaWhats();ok(sh(w,'Whats')[1][6]==='FALHOU'&&sh(w,'Whats')[1][7]===3,'após 3 tentativas: FALHOU');
 ok(R(w.pub.reservar({dia:20,pessoas:[P('Ana Souza','(42) 99100-0009')],cli:'b'})).ok,'falha do WhatsApp não afeta novas reservas');
 w.sheets.Acesso.rows[1][6]='SIM';const K=w.sheets.Acesso.rows[1][1];delete E2.props.FALHA;
 let e=R(w.guest.gestao(K));ok(e.whats.ativo&&e.whats.contagem.FALHOU===1&&e.whats.pendencias.some(x=>x.status==='FALHOU'),'painel de gestão mostra a falha');
 e=R(w.guest.gWhatsReenviar(K,2));ok(e.ok&&sh(w,'Whats')[1][6]==='PENDENTE'&&sh(w,'Whats')[1][7]===0,'reenviar volta para a fila');
 w.pub.processarFilaWhats();ok(sh(w,'Whats')[1][6]==='ENVIADO','reenvio entregue depois de corrigido');
 // cancelar reserva ainda pendente -> CANCELADO
 w=W();ligar(w,'SIM');preparaEnvio(w);r=R(w.pub.reservar({dia:21,pessoas:[P('Joao Pereira','(42) 99100-0001')],cli:'c'}));const pr2=sh(w,'Whats')[1][2];
 w.pub.cancelarReserva(pr2,'Joao Pereira','(42) 99100-0001');ok(sh(w,'Whats')[1][6]==='CANCELADO','cancelar reserva cancela o que está na fila');
 w.pub.processarFilaWhats();ok(sh(w,'Whats')[1][6]==='CANCELADO','cancelado não é enviado');
 // mover reserva pela gestão: reenfileira na nova noite
 w=W();ligar(w,'SIM');preparaEnvio(w);w.sheets.Acesso.rows[1][6]='SIM';const K2=w.sheets.Acesso.rows[1][1];
 w.pub.reservar({dia:18,pessoas:[P('Joao Pereira','(42) 99100-0001')],cli:'d'});const pm=sh(w,'Whats')[1][2];w.pub.processarFilaWhats();
 w.guest.gReservaMover(K2,pm,19,false);ok(sh(w,'Whats').filter(x=>x[3]===19&&x[6]==='PENDENTE').length===1,'mover reserva: novo ingresso da nova noite entra na fila');
 // sem credenciais/desligado: processar não faz nada
 w=W();ok(R(w.pub.processarFilaWhats?w.pub.processarFilaWhats():{}).ok===false||true,'sem credenciais: não envia');
 ok(!/WA_TOKEN\s*=\s*['"]/.test(fs.readFileSync('../apps-script/publico/Code.gs','utf8'))&&!fs.readFileSync('../apps-script/convidados/Code.gs','utf8').includes('function processarFilaWhats'),'token fora do código; envio só no projeto público');
 await br.close();console.log(out.join('\n'));
})();
