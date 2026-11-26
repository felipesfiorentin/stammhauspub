const {chromium}=require('playwright');const vm=require('vm'),fs=require('fs');
const G=require('./convidados.json');
const SRC=fs.readFileSync('/tmp/out/convidados/Code.gs','utf8');
function mkSheet(rows){return{rows,getLastRow(){return this.rows.length},getMaxRows(){return Math.max(this.rows.length,1000)},insertRowsAfter(){},
 getRange(r,c,nr=1,nc=1){const s=this;return{getValues(){return s.rows.slice(r-1,r-1+nr).map(x=>Array.from({length:nc},(_,i)=>x[c-1+i]??''))},
  setValues(v){v.forEach((row,i)=>{s.rows[r-1+i]=s.rows[r-1+i]||[];row.forEach((x,j)=>s.rows[r-1+i][c-1+j]=x)})},
  setValue(v){s.rows[r-1]=s.rows[r-1]||[];s.rows[r-1][c-1]=v},getValue(){return (s.rows[r-1]||[])[c-1]??''}}},
 appendRow(a){this.rows.push(a)}}}
function build(cap,opt={}){
 const sheets={Convidados:mkSheet([['id','nome','dia','estilo','grupo','acomp','busca'],...G.map(g=>[g.id,g.nome,g.dia,g.estilo,g.grupo,g.acomp,g.busca])]),
  Confirmacoes:mkSheet([['h']]),
  Programacao:mkSheet([['Dia','Data','Atração','Estilo','Instagram'],[18,new Date('2026-11-18T00:00:00-03:00'),'Lonesome Capitain · Country & Folk','Formal','@lonesome.capitain'],[19,new Date('2026-11-19T00:00:00-03:00'),'Os Bauretz · Soul, Disco & MPB','MPB','@osbauretz'],[20,new Date('2026-11-20T00:00:00-03:00'),'Hardways · Classic Rock','Rock','@hardways_classicrock'],[21,new Date('2026-11-21T00:00:00-03:00'),'Rodrigo Seidel e banda · Pop Rock','Pop Rock','@rodrigoseidell']]),
  Config:mkSheet([['Parâmetro','Valor'],['capacidade_por_noite',cap],['teto_por_noite',cap===74?81:cap],...(opt.cfgExtra||[]),['mesas',19],['whatsapp_contato',''],['horario','']])};
 const cache={};
 const ctx={console,SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]})},
  CacheService:{getScriptCache:()=>({get:k=>(!global.__CACHE&&/^(dados|prog)_v2$/.test(k))?null:(cache[k]??null),put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  Utilities:{formatDate(d,tz,f){const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz||'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
   if(f==='u')return String(new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()||7);if(f==='yyyy-MM-dd')return p.year+'-'+p.month+'-'+p.day;return f==='dd/MM'?p.day+'/'+p.month:''}},
  HtmlService:{},SpreadsheetApp2:1};
 ctx.SpreadsheetApp.flush=()=>{};ctx.Utilities.getUuid=()=>'abcdef12-3456-7890-abcd-ef1234567890';sheets.__ins=n=>sheets[n]=mkSheet([]);
 ctx.SpreadsheetApp.getActiveSpreadsheet=()=>({getName:()=>'Planilha teste',getId:()=>'ID123',getUrl:()=>'https://x',getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=mkSheet([])});
 vm.createContext(ctx);if(opt.semNormalize)vm.runInContext('delete String.prototype.normalize',ctx);vm.runInContext(opt.semBusca?['Comum','Code','Metricas'].map(f=>fs.readFileSync('/home/claude/work/'+f+'.src.gs','utf8')).join('\n'):SRC,ctx);return{ctx,sheets,SRC}}
(async()=>{
 const out=[];const ok=(c,m)=>{out.push((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
 const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 async function novaPagina(cap,opt){const env=build(cap,opt);const pg=await br.newPage({viewport:{width:390,height:844}});
  await pg.exposeFunction('__call',(fn,args)=>JSON.parse(JSON.stringify(env.ctx[fn](...args))));
  await pg.addInitScript(()=>{const mk=(s,f)=>new Proxy({},{get:(_,fn)=>(...a)=>{window.__call(fn,a).then(s,f)}});
   window.google={script:{run:{withSuccessHandler(s){return{withFailureHandler(f){return mk(s,f)}}}}}}});
  await pg.goto('file:///tmp/out/convidados/Index.html');return{pg,env}}
 const vis=async(pg,id)=>!(await pg.$eval('#'+id,e=>e.classList.contains('hide')));
 // 1) fluxo feliz sem acompanhante, nome com erro de digitação
 let {pg,env}=await novaPagina(74);
 await pg.fill('#q','adilson strak');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');
 ok((await pg.textContent('#r-titulo')).includes('Encontramos o seu convite'),'busca com erro de digitação achou o convite');
 await pg.screenshot({path:'shot_achei.png'});await pg.click('#r-voltar');await pg.screenshot({path:'shot_busca.png'});await pg.fill('#q','adilson strak');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');
 await pg.click('#r-lista .btn');await pg.waitForSelector('#s-form:not(.hide)');
 ok(!(await vis(pg,'bloco-acomp')),'convite sem +1 não mostra bloco de acompanhante');
 await pg.fill('#tNome','Adilson Strack');await pg.fill('#tTel','4299');
 await pg.click('#btn-conf');ok((await pg.textContent('#e-tTel')).includes('(42) 99999-9999'),'telefone incompleto barrado');
 await pg.fill('#tTel','');await pg.type('#tTel','42888887777');
 ok((await pg.inputValue('#tTel'))==='(42) 88888-7777','máscara formata o telefone');
 ok((await pg.textContent('#h-tTel')).includes('número 9'),'dica explica que celular começa com 9');
 await pg.fill('#tTel','');await pg.type('#tTel','42999887766');await pg.screenshot({path:'shot_form.png'});
 await pg.click('#btn-conf');await pg.waitForSelector('#s-ok:not(.hide)');
 ok(env.sheets.Confirmacoes.rows.length===2&&env.sheets.Confirmacoes.rows[1][5]==='(42) 99887-766'.replace('99887-766','99988-7766')||env.sheets.Confirmacoes.rows[1][5]==='(42) 99988-7766','confirmação gravada na planilha: '+JSON.stringify(env.sheets.Confirmacoes.rows[1]));
 await pg.screenshot({path:'shot_ok.png'});
 ok((await pg.textContent('#ok-sum')).includes('Protocolo')&&(await pg.textContent('#ok-sum')).includes('C2'),'tela final mostra protocolo C2 (linha da planilha)');
 ok(env.sheets.Confirmacoes.rows[1][1]==='G001','gravou na linha 2');
 ok((await pg.textContent('#s-ok')).includes('Quer confirmar mais alguém?'),'tela final pergunta se quer confirmar mais alguém');
 await pg.screenshot({path:'shot_ok.png',fullPage:true});
 await pg.click('#ok-outra');ok(await vis(pg,'s-busca')&&(await pg.inputValue('#q'))==='','botão "Confirmar outra pessoa" volta à busca limpa');
 await pg.fill('#q','Ilma Strack');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista .btn');await pg.waitForSelector('#s-form:not(.hide)');
 ok((await pg.inputValue('#tTel'))==='','formulário da 2ª pessoa começa sem dados da 1ª');
 await pg.fill('#tNome','Ilma Strack');await pg.fill('#tTel','(42) 98888-1111');await pg.click('#btn-conf');await pg.waitForSelector('#s-ok:not(.hide)');
 ok(env.sheets.Confirmacoes.rows.length===3&&env.sheets.Confirmacoes.rows[2][1]==='G002'&&(await pg.textContent('#ok-sum')).includes('C3'),'2ª pessoa gravada na linha 3 (protocolo C3)');
 env.sheets.Confirmacoes.rows.length=2;
 // 2) volta: já confirmado -> verificação por telefone -> editar -> cancelar
 await pg.reload();await pg.fill('#q','Adilson Strack');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista .btn');
 await pg.waitForSelector('#s-verif:not(.hide)');ok(true,'reacesso cai na verificação por telefone');
 await pg.fill('#vTel','(42) 90000-0000');await pg.click('#btn-verif');await pg.waitForFunction(()=>document.getElementById('e-vTel').textContent.length>0);
 ok((await pg.textContent('#e-vTel')).includes('não confere'),'telefone errado não abre os dados');
 await pg.fill('#vTel','(42) 99988-7766');await pg.click('#btn-verif');await pg.waitForSelector('#s-form:not(.hide)');
 ok((await pg.inputValue('#tNome'))==='Adilson Strack','edição abre com dados preenchidos');
 await pg.click('#btn-cancel');ok((await pg.textContent('#btn-cancel')).includes('Toque de novo'),'cancelar pede segundo toque');
 await pg.click('#btn-cancel');await pg.waitForSelector('#s-aviso:not(.hide)');
 ok(env.sheets.Confirmacoes.rows[1][9]==='Cancelado','cancelamento grava status Cancelado');
 await pg.close();
 // 3) com acompanhante
 ({pg,env}=await novaPagina(74));
 await pg.fill('#q','Pedro Cordeiro');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');
 await pg.click('#r-lista .btn, #r-lista .cand');await pg.waitForSelector('#s-form:not(.hide)');
 ok(await vis(pg,'bloco-acomp'),'convite com +1 mostra acompanhante');
 await pg.fill('#tNome','Pedro Cordeiro');await pg.fill('#tTel','(42) 99111-2222');await pg.fill('#aNome','Ana Cordeiro');await pg.fill('#aTel','(42) 99111-2222');
 await pg.click('#btn-conf');ok((await pg.textContent('#e-aTel')).includes('número próprio'),'telefone igual do acompanhante barrado');
 await pg.fill('#aTel','(42) 99333-4444');await pg.screenshot({path:'shot_acomp.png',fullPage:true});await pg.click('#btn-conf');await pg.waitForSelector('#s-ok:not(.hide)');
 ok(env.sheets.Confirmacoes.rows[1][8]===2,'2 pessoas contabilizadas');
 // outro convidado tentando usar o mesmo telefone
 await pg.reload();await pg.fill('#q','Cleverson Cordeiro');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista button');await pg.waitForSelector('#s-form:not(.hide)');
 await pg.fill('#tNome','Cleverson Cordeiro');await pg.fill('#tTel','(42) 99111-2222');await pg.setChecked('#ac-nao',true).catch(()=>{});await pg.click('#ac-nao');await pg.click('#btn-conf');
 await pg.waitForFunction(()=>document.getElementById('e-geral').textContent.length>0);ok((await pg.textContent('#e-geral')).includes('já está em outra confirmação'),'telefone duplicado entre convidados barrado');
 // não encontrado / curto
 await pg.reload();await pg.fill('#q','Carlos Eduardo Silva');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');
 ok((await pg.textContent('#r-titulo')).includes('Ainda não encontramos'),'nome inexistente: mensagem amigável');await pg.screenshot({path:'shot_nenhum.png'});
 await pg.reload();await pg.fill('#q','Maria');await pg.click('#btn-buscar');ok((await pg.textContent('#busca-msg')).includes('nome e sobrenome'),'nome curto pede sobrenome');
 await pg.close();
 // 4) lotação: convidado da lista é garantido (mesmo com teto 1); com "só titular" pendente, aumentar o total é barrado
 ({pg,env}=await novaPagina(1));
 await pg.fill('#q','Pedro Cordeiro');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista button');await pg.waitForSelector('#s-form:not(.hide)');
 await pg.fill('#tNome','Pedro Cordeiro');await pg.fill('#tTel','(42) 99111-2222');await pg.fill('#aNome','Ana Cordeiro');await pg.fill('#aTel','(42) 99333-4444');await pg.click('#btn-conf');
 await pg.waitForSelector('#s-ok:not(.hide)');ok(env.sheets.Confirmacoes.rows[1][8]===2,'convidado da lista é garantido mesmo com a noite acima do teto (delta 0)');
 ({pg,env}=await novaPagina(1,{cfgExtra:[['pendente_conta_acompanhante','NAO']]}));
 await pg.fill('#q','Pedro Cordeiro');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista button');await pg.waitForSelector('#s-form:not(.hide)');
 await pg.fill('#tNome','Pedro Cordeiro');await pg.fill('#tTel','(42) 99111-2222');await pg.fill('#aNome','Ana Cordeiro');await pg.fill('#aTel','(42) 99333-4444');await pg.click('#btn-conf');
 await pg.waitForSelector('#s-aviso:not(.hide)');ok((await pg.textContent('#a-titulo')).includes('lotação'),'acompanhante que ultrapassa o teto é barrado (lotado)');

 // ---- regras de unicidade e limites ----
 {const {pg,env}=await novaPagina(74);
  const abre=async(nome)=>{await pg.reload();await pg.fill('#q',nome);await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista button');await pg.waitForSelector('#s-form:not(.hide)')};
  const envia=async(tn,tt,an,at)=>{await pg.fill('#tNome',tn);await pg.fill('#tTel',tt);if(an){await pg.fill('#aNome',an);await pg.fill('#aTel',at)}else if(await pg.$('#ac-nao:visible'))await pg.click('#ac-nao');
    await pg.click('#btn-conf');await pg.waitForFunction(()=>['e-geral','e-aNome','e-tNome','e-aTel'].some(i=>document.getElementById(i).textContent.length>0)||!document.getElementById('s-ok').classList.contains('hide'),null,{timeout:6000}).catch(()=>{})};
  const geral=async()=>(await pg.textContent('#e-geral'))+(await pg.textContent('#e-aNome'))+(await pg.textContent('#e-tNome'));
  ok((await pg.$('#consent'))===null,'checkbox de consentimento removido');
  ok(await pg.$eval('.consent',e=>getComputedStyle(e).fontStyle==='italic'&&e.textContent.includes('consente')),'texto de consentimento embutido, em itálico');
  await abre('Pedro Cordeiro');await envia('Pedro Cordeiro','(42) 99111-2222','Cleverson Cordeiro','(42) 99333-4444');
  ok((await geral()).includes('convite próprio'),'acompanhante que é outro convidado é barrado');
  await abre('Pedro Cordeiro');await envia('Pedro Cordeiro','(42) 99111-2222','Pedro Cordeiro','(42) 99333-4444');
  ok((await geral()).includes('diferente do convidado'),'acompanhante igual ao titular é barrado');
  await abre('Pedro Cordeiro');await envia('Pedro Cordeiro','(42) 99111-2222','Ana Cordeiro','(42) 99333-4444');await pg.waitForSelector('#s-ok:not(.hide)');
  await abre('Cleverson Cordeiro');await envia('Cleverson Cordeiro','(42) 98111-2222','ana cordeiro','(42) 98333-4444');
  ok((await geral()).includes('já consta em outra confirmação'),'mesmo acompanhante em duas confirmações é barrado');
  await abre('Ilma Strack');await envia('Pedro Cordeiro','(42) 97111-2222');
  ok((await geral()).includes('não pode ser trocado'),'usar o nome de quem já confirmou (Pedro Cordeiro) no convite de outra pessoa é barrado | '+(await geral()));
  await abre('Ilma Strack');await envia('Adilson Strack','(42) 97111-2222');
  ok((await geral()).includes('não pode ser trocado'),'titular digitando o nome de outra pessoa é barrado (nome travado)');
  await abre('Ilma Strack');await envia('Maria Silva','(42) 97111-3333');
  ok((await geral()).includes('não pode ser trocado'),'trocar o nome do convite por pessoa não convidada é barrado');
  await abre('Ilma Strack');await envia('Strack','(42) 97111-3333');
  ok((await geral()).length>0,'remover palavras do nome do convite é barrado');
  // API: nome travado e "superconjuntos"
  const idDe=(n)=>JSON.parse(JSON.stringify(env.sheets.Convidados.rows.find(r=>r[1]===n)))[0];
  let rr=JSON.parse(JSON.stringify(env.ctx.confirmar({id:idDe('Tadeu Trevisani'),titNome:'Tadeu Trevisani Filho',titTel:'(42) 94111-2222',vaiAcomp:false})));
  ok(rr.ok===false&&rr.code==='titular_outro_convidado','Tadeu Trevisani Filho não consegue usar o convite de Tadeu Trevisani');
  rr=JSON.parse(JSON.stringify(env.ctx.confirmar({id:idDe('Rodrigo Pereira Carvalho'),titNome:'Rodrigo De Goes Pereira Carvalho',titTel:'(42) 94111-3333',vaiAcomp:false})));
  ok(rr.ok===false&&rr.code==='titular_outro_convidado','Rodrigo De Goes Pereira Carvalho não consegue usar o convite de Rodrigo Pereira Carvalho');
  rr=JSON.parse(JSON.stringify(env.ctx.confirmar({id:idDe('Marilucia Carvalho'),titNome:'Marilucia Carvalho Silva',titTel:'(42) 94111-4444',vaiAcomp:false})));
  ok(rr.ok===true,'complementar o nome com sobrenome extra é permitido');
  rr=JSON.parse(JSON.stringify(env.ctx.confirmar({id:idDe('Robson Carvalho'),titNome:'Robson Pereira',titTel:'(42) 94111-5555',vaiAcomp:false})));
  ok(rr.ok===false&&rr.code==='invalido'&&rr.campo==='titNome','servidor trava o nome mesmo sem passar pela página');
  // API: limites no servidor (independem da página)
  const R=(x)=>JSON.parse(JSON.stringify(x));
  const base={titNome:'Adilson Strack',titTel:'(42) 96111-2222'};
  let r=R(env.ctx.confirmar({...base,id:'G001',vaiAcomp:true,acNome:'Fulana Silva',acTel:'(42) 96333-4444'}));ok(r.ok===false&&r.code==='invalido'&&r.campo==='acNome','servidor recusa acompanhante em convite sem direito');
  r=R(env.ctx.confirmar({...base,id:'G001',vaiAcomp:false,acNome:'Fulana Silva',acTel:'(42) 96333-4444',acompanhantes:[1,2,3]}));ok(r.ok===true&&env.sheets.Confirmacoes.rows.slice(-1)[0][8]===1,'dados extras do payload são ignorados (1 pessoa gravada)');
  r=R(env.ctx.confirmar({...base,id:'G001',vaiAcomp:false}));ok(r.code==='ja_confirmado','mesmo convite não pode ser confirmado duas vezes');
  r=R(env.ctx.confirmar({titNome:'Pedro Cordeiro',titTel:'(42) 95111-2222',id:'G007',vaiAcomp:true,acNome:'Bia Souza',acTel:'(42) 95333-4444'}));ok(r.ok===false,'servidor recusa 2ª confirmação do mesmo convite com outro acompanhante (código '+r.code+')');
  await pg.close()}
 // ---- cenários de falha / tipologia ----
 const ZAPN='5547992505290';
 async function cenario(nome,mut,cod,extra,opt){
  const {pg,env}=await novaPagina(74,opt);mut(env);
  await pg.fill('#q','Adilson Strack');await pg.click('#btn-buscar');
  await pg.waitForFunction(()=>document.getElementById('busca-msg').textContent.includes('Código'),null,{timeout:8000}).catch(()=>{});
  const txt=await pg.textContent('#busca-msg');const href=await pg.$eval('#busca-msg a.zap',a=>a.href).catch(()=>'');
  ok((await pg.textContent('#btn-buscar')).trim()==='Encontrar meu convite','botão volta ao texto normal após erro');ok(txt.includes('Código '+cod),nome+' -> '+cod+' | '+txt.slice(0,110).replace(/\s+/g,' '));
  ok(href.includes(ZAPN)&&href.includes(encodeURIComponent('Código '+cod)),nome+': link WhatsApp com código pré-preenchido');
  if(extra)await extra(pg,env);await pg.close()}
 await cenario('aba Programacao ausente',e=>{delete e.sheets.Programacao},'S01',async(pg,env)=>{
   ok(env.sheets.Erros&&env.sheets.Erros.rows.length===2&&env.sheets.Erros.rows[1][3]==='S01','erro registrado na aba Erros: '+JSON.stringify(env.sheets.Erros.rows[1]).slice(0,120));
   await pg.screenshot({path:'shot_erro.png',fullPage:true})});
 await cenario('Convidados vazia',e=>{e.sheets.Convidados.rows.length=1},'S02');
 await cenario('Busca.gs não colado',e=>{},'S04',null,{semBusca:1});
 await cenario('runtime V8 desativado (sem normalize)',e=>{},'S05',null,{semNormalize:1});
 // gravação que não persiste -> S09 (nunca mostra "confirmado" sem gravar)
 {const {pg,env}=await novaPagina(74);const cf=env.sheets.Confirmacoes;const orig=cf.getRange.bind(cf);cf.getRange=(r,c,nr,nc)=>{const o=orig(r,c,nr,nc);return{...o,setValues(){} }};
  await pg.fill('#q','Adilson Strack');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista .btn');await pg.waitForSelector('#s-form:not(.hide)');
  await pg.fill('#tNome','Adilson Strack');await pg.fill('#tTel','(42) 99988-7766');await pg.click('#btn-conf');
  await pg.waitForFunction(()=>document.getElementById('e-geral').textContent.includes('Código'),null,{timeout:8000});
  ok((await pg.textContent('#e-geral')).includes('Código S09')&&!(await vis(pg,'s-ok')),'gravação não confirmada -> S09 e NÃO mostra "confirmado"');await pg.close()}
 // timeout (servidor não responde)
 {const {pg}=await novaPagina(74);await pg.evaluate(()=>{window.__TMO=800;window.google.script.run.withSuccessHandler=()=>({withFailureHandler:()=>new Proxy({},{get:()=>()=>{}})})});
  await pg.fill('#q','Adilson Strack');await pg.click('#btn-buscar');await pg.waitForFunction(()=>document.getElementById('busca-msg').textContent.includes('Código'),null,{timeout:5000});
  ok((await pg.textContent('#busca-msg')).includes('Código C03'),'servidor sem resposta -> C03 (tempo esgotado)');await pg.close()}
 // falha de comunicação do Google (failure handler)
 {const {pg}=await novaPagina(74);await pg.evaluate(()=>{window.google.script.run.withSuccessHandler=(s)=>({withFailureHandler:(f)=>new Proxy({},{get:()=>()=>{setTimeout(()=>f(new Error('Authorization is required to perform that action.')),10)}})})});
  await pg.fill('#q','Adilson Strack');await pg.click('#btn-buscar');await pg.waitForFunction(()=>document.getElementById('busca-msg').textContent.includes('Código'),null,{timeout:5000});
  const tx=await pg.textContent('#busca-msg');ok(tx.includes('Código C01')&&tx.includes('Authorization is required'),'falha de comunicação -> C01 com detalhe técnico');await pg.close()}
 // WhatsApp presente em todas as telas (rodapé)
 {const {pg}=await novaPagina(74);const h=await pg.$eval('#zap-rodape',a=>a.href);ok(h.includes(ZAPN),'rodapé fixo com WhatsApp '+ZAPN);
  await pg.fill('#q','Carlos Eduardo Silva');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');
  ok((await pg.$eval('#r-lead a.zap',a=>a.href)).includes(ZAPN),'tela "não encontrado" tem botão de WhatsApp');await pg.close()}
 // diagnóstico
 {const env=build(74);let alerta='';env.ctx.SpreadsheetApp.getUi=()=>({createMenu:()=>({addItem(){return this},addToUi(){}}),alert:(t,m)=>{alerta=m},ButtonSet:{OK:1}});
  env.ctx.HtmlService={createHtmlOutputFromFile:()=>({})};const cc={};env.ctx.CacheService={getScriptCache:()=>({get:k=>cc[k]??null,put:(k,v)=>{cc[k]=v}})};env.ctx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})};
  env.ctx.diagnostico();ok(!alerta.includes('✘')&&alerta.includes('Convidados lidos: 206')&&alerta.includes('4 dias'),'diagnóstico OK no cenário saudável');
  const env2=build(74,{semBusca:1});let al2='';env2.ctx.SpreadsheetApp.getUi=()=>({alert:(t,m)=>{al2=m},ButtonSet:{OK:1}});env2.ctx.HtmlService={createHtmlOutputFromFile:()=>({})};env2.ctx.CacheService=env.ctx.CacheService;env2.ctx.LockService=env.ctx.LockService;delete env2.sheets.Config;env2.ctx.diagnostico();alerta=al2;ok(alerta.includes('✘ Aba "Config"')&&alerta.includes('✘ Código completo'),'diagnóstico aponta aba Config e Busca.gs ausentes');console.log(alerta)}
 // NÃO VAI: recusa, bloqueios e mudança de ideia
 {const {pg,env}=await novaPagina(74);
  await pg.fill('#q','Ilma Strack');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista .btn');await pg.waitForSelector('#s-form:not(.hide)');
  ok((await vis(pg,'bloco-vai'))&&(await pg.textContent('#bloco-vai')).includes('Você poderá comparecer nesta noite?'),'form pergunta explicitamente se poderá comparecer');
  ok((await pg.textContent('#btn-conf'))==='Confirmar presença','padrão: botão "Confirmar presença"');
  await pg.click('#vai-nao');
  ok(!(await vis(pg,'bloco-nome'))&&(await pg.textContent('#btn-conf'))==='Informar que não poderei ir'&&(await vis(pg,'consent-nao'))&&!(await vis(pg,'consent-sim')),'ao escolher "Não poderei ir": nome oculto, botão e consentimento mudam');
  await pg.screenshot({path:'shot_naovai.png',fullPage:true});
  await pg.click('#btn-conf');ok((await pg.textContent('#e-tTel')).includes('(42) 99999-9999'),'recusa exige celular válido');
  await pg.type('#tTel','42999887766');await pg.click('#btn-conf');await pg.waitForSelector('#s-ok:not(.hide)');
  const lr=env.sheets.Confirmacoes.rows[env.sheets.Confirmacoes.rows.length-1];
  ok(lr[1]==='G002'&&lr[9]==='Não vai'&&lr[8]===0&&lr[5]==='(42) 99988-7766','recusa gravada como "Não vai", 0 pessoas: '+JSON.stringify(lr));
  ok((await pg.textContent('#ok-titulo'))==='Obrigado por avisar!'&&(await pg.textContent('#ok-sum')).includes('Não poderei ir'),'tela final da recusa é inequívoca');
  await pg.screenshot({path:'shot_naovai_ok.png',fullPage:true});
  // não consome vaga
  {const cc=env.ctx.contagem_(18,env.ctx.cfg_(),env.ctx.convLeve_(),env.ctx.confs_(),env.ctx.reservas_());ok(cc.naoVaiConvites===1&&cc.confirmadosPessoas===0,'recusa não ocupa vaga e libera o convite (naoVai=1)')}
  // outro dispositivo: volta -> pede celular
  await pg.click('#ok-outra');await pg.fill('#q','Ilma Strack');await pg.click('#btn-buscar');await pg.waitForSelector('#s-result:not(.hide)');await pg.click('#r-lista .btn');await pg.waitForSelector('#s-verif:not(.hide)');
  ok((await pg.textContent('#v-titulo')).includes('não poderá ir'),'quem voltou vê "você avisou que não poderá ir"');
  await pg.fill('#vTel','(42) 91111-2222');await pg.click('#btn-verif');await pg.waitForFunction(()=>document.getElementById('e-vTel').textContent.length>0);
  ok((await pg.textContent('#e-vTel')).includes('não confere'),'celular errado não libera mudança de ideia');
  const dire=env.ctx.confirmar({id:'G002',titNome:'Ilma Strack',titTel:'(42) 98888-0000',vaiAcomp:false,acNome:'',acTel:'',telAtual:''});
  ok(dire.code==='tel_incorreto','confirmar direto sem o celular da recusa é barrado');
  await pg.fill('#vTel','(42) 99988-7766');await pg.click('#btn-verif');await pg.waitForSelector('#s-form:not(.hide)');
  ok(await vis(pg,'bloco-vai'),'celular certo abre o form para confirmar');
  await pg.fill('#tNome','Ilma Strack');await pg.click('#btn-conf');await pg.waitForSelector('#s-ok:not(.hide)');
  const st=env.sheets.Confirmacoes.rows.filter(r=>r[1]==='G002').map(r=>r[9]);
  ok(JSON.stringify(st)===JSON.stringify(['Não vai','Confirmado'].reverse().reverse()).replace('"Não vai"','"Substituído"')||(st.includes('Substituído')&&st.includes('Confirmado')&&!st.includes('Não vai')),'após mudar de ideia: recusa vira "Substituído" e há 1 confirmação ativa: '+st);
  const r2=env.ctx.recusar({id:'G002',titTel:'(42) 97777-0000'});ok(r2.code==='ja_confirmado','já confirmado não pode ser recusado por aqui');
  const r3=env.ctx.recusar({id:'G999',titTel:'(42) 97777-0000'});ok(r3.code==='nao_encontrado','recusa de id inexistente barrada');
  await pg.close()}
 await br.close();console.log(out.join('\n'));
})();
