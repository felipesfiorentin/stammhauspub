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

 // ---- preparação ----
 let w=W();
 ok(['Reservas','Lotacao','Usuarios','Auditoria'].every(n=>w.sheets[n]),'prepararReservas cria Reservas, Lotacao, Usuarios e Auditoria');
 ok(w.sheets.Config.rows.some(r=>r[0]==='teto_por_noite'&&r[1]===81)&&w.sheets.Config.rows.some(r=>r[0]==='valor_ingresso'&&r[1]===40)&&w.sheets.Config.rows.some(r=>r[0]==='reserva_valida_ate'&&r[1]==='20h')&&w.sheets.Config.rows.some(r=>r[0]==='max_pessoas_reserva'&&r[1]===4),'Config recebe teto 81, valor 40, validade 20h, máx. 4');
 const nCfg=w.sheets.Config.rows.length;w.guest.prepararReservas();ok(w.sheets.Config.rows.length===nCfg&&w.sheets.Usuarios.rows.length===1,'prepararReservas é idempotente (sem duplicar linhas)');
 let d=R(w.pub.dados());
 ok(d.noites.length===4&&d.noites.every(n=>!n.lotado&&n.vagas===4)&&d.info.valor===40&&d.info.ate==='20h'&&d.info.max===4,'público vê 4 noites disponíveis, valor 40, até 20h, máx. 4');
 ok(JSON.stringify(d).includes('Strack')===false&&!/"nome"/.test(JSON.stringify(d)),'resposta pública não expõe nomes de convidados');
 // contagem base: lista inteira conta (pendentes = titular + acompanhante)
 ok(cnt(w,18).total===63&&cnt(w,19).total===55&&cnt(w,20).total===62&&cnt(w,21).total===65&&cnt(w,18).restantes===18,'lista garantida conta 63/55/62/65 e restam 18 na noite 18 (teto 81)');

 // ---- reservas ----
 let r=R(w.pub.reservar({dia:18,pessoas:[P('Joao Pereira','(42) 99100-0001'),P('Maria Pereira','(42) 99100-0002')],cli:'a'}));
 ok(r.ok&&r.resumo.protocolo==='R2'&&r.resumo.pessoas.length===2,'reserva de 2 pessoas gravada (protocolo R2)');
 ok(w.sheets.Reservas.rows.length===3&&w.sheets.Reservas.rows[1][6]==='Confirmado'&&w.sheets.Reservas.rows[2][3]===2&&w.sheets.Reservas.rows[1][7]==='(42) 99100-0001'&&String(w.sheets.Reservas.rows[1][8]).startsWith('Sim'),'2 linhas (uma por pessoa), titular, consentimento registrado');
 ok(cnt(w,18).total===65&&cnt(w,18).publico===2&&cnt(w,18).reservas===1,'contagem: cada pessoa conta (63+2=65), 1 reserva');
 ok(w.sheets.Lotacao.rows.length>=5,'painel Lotacao atualizado na aba');
 const inv=(p,campo)=>{const x=R(w.pub.reservar({dia:19,pessoas:p,cli:'b'+Math.random()}));return x.ok===false&&x.code==='invalido'&&(!campo||x.campo===campo)};
 ok(inv([1,2,3,4,5].map(i=>P('Pessoa Numero'+'abcde'[i-1],'(42) 99200-000'+i))),'servidor recusa mais de 4 pessoas','qtd');
 ok(inv([P('Ana Souza','(42) 99200-0001'),P('Bia Souza','')],'tel1'),'todas as pessoas precisam de celular');
 ok(inv([P('Ana','(42) 99200-0001')],'nome0'),'nome completo obrigatório (só um nome é recusado)');
 ok(inv([P('Ana Souza','(42) 99200-0001'),P('Bia Souza','(42) 99200-0001')],'tel1'),'celular repetido dentro da reserva é recusado');
 ok(inv([P('Ana Souza','(42) 99200-0001'),P('ana souza','(42) 99200-0002')],'nome1'),'nome repetido dentro da reserva é recusado');
 ok(inv([],'qtd')&&inv([P('Ana Souza','12345')],'tel0'),'reserva vazia e celular inválido recusados');
 ok(R(w.pub.reservar({dia:25,pessoas:[P('Ana Souza','(42) 99200-0001')],cli:'z'})).code==='invalido','noite inexistente recusada');
 ok(R(w.pub.reservar({dia:19,pessoas:[P('Ana Souza','(42) 99200-0001')],cli:'z',site:'http://spam'})).code==='invalido','campo-isca preenchido (robô) recusado');
 r=R(w.pub.reservar({dia:18,pessoas:[P('Joao Pereira','(42) 99100-0009')],cli:'c'}));ok(r.code==='ja_consta'&&r.campo==='nome0','mesmo nome já reservado na noite é recusado');
 r=R(w.pub.reservar({dia:18,pessoas:[P('Outro Nome','(42) 99100-0002')],cli:'c'}));ok(r.code==='ja_consta'&&r.campo==='tel0','mesmo celular já reservado na noite é recusado');
 r=R(w.pub.reservar({dia:19,pessoas:[P('Joao Pereira','(42) 99100-0001')],cli:'c'}));ok(r.ok===true,'mesma pessoa pode reservar outra noite');
 // conflito com convidado confirmado
 w.guest.confirmar({id:'G001',titNome:'Adilson Strack',titTel:'(42) 98000-1111',vaiAcomp:false});const gi=G.find(g=>g.id==='G001');
 r=R(w.pub.reservar({dia:gi.dia,pessoas:[P('Fulano Qualquer','(42) 98000-1111')],cli:'d'}));ok(r.code==='ja_consta','celular de convidado já confirmado na noite é recusado no público');
 // ---- lotação até o teto ----
 w=W();
 const enche=(w,dia,n,off=0)=>{let k=0;while(k<n){const q=Math.min(4,n-k);const ps=[];for(let i=0;i<q;i++){const z=k+i+off;ps.push(P('Cliente Numero'+String.fromCharCode(65+(z%26))+String.fromCharCode(65+Math.floor(z/26)),'(42) 9'+String(5000+z).padStart(4,'0')+'-'+String(dia*100+z).padStart(4,'0')))}const x=R(w.pub.reservar({dia,pessoas:ps,cli:'f'+k+'_'+off}));if(!x.ok)return x;k+=q}return{ok:true}};
 ok(enche(w,18,17).ok&&cnt(w,18).restantes===1&&!cnt(w,18).lotado&&noite(w,18).vagas===1,'com 80 pessoas restam 1 vaga e a noite segue disponível');
 r=R(w.pub.reservar({dia:18,pessoas:[P('Duas Pessoas','(42) 99300-0001'),P('Duas Pessoas Dois','(42) 99300-0002')],cli:'g'}));ok(r.code==='sem_vagas'&&r.restantes===1,'reserva maior que as vagas restantes: sem_vagas com restantes=1');
 r=R(w.pub.reservar({dia:18,pessoas:[P('Ultima Vaga','(42) 99300-0003')],cli:'g'}));ok(r.ok&&cnt(w,18).total===81&&cnt(w,18).lotado&&noite(w,18).lotado,'81ª pessoa fecha a noite: LOTADO');
 r=R(w.pub.reservar({dia:18,pessoas:[P('Alguem Tarde','(42) 99300-0004')],cli:'g'}));ok(r.code==='lotado','noite lotada recusa novas reservas');
 ok(cnt(w,19).restantes===26&&R(w.pub.reservar({dia:19,pessoas:[P('Outra Noite','(42) 99300-0005')],cli:'g'})).ok,'outras noites seguem abertas');
 // convidado "Não vai" libera vaga para o público
 const convs18=G.filter(g=>g.dia===18);const gAc=convs18.find(g=>g.acomp)||convs18[0];const antes=cnt(w,18).total;
 w.guest.recusar({id:gAc.id,titTel:'(42) 97000-0001'});
 ok(cnt(w,18).total===antes-(gAc.acomp?2:1)&&!cnt(w,18).lotado&&cnt(w,18).restantes===(gAc.acomp?2:1),'convidado que avisa "Não vai" libera vaga ('+(gAc.acomp?2:1)+') e a noite reabre');
 r=R(w.pub.reservar({dia:18,pessoas:gAc.acomp?[P('Novo Um','(42) 99400-0001'),P('Novo Dois','(42) 99400-0002')]:[P('Novo Um','(42) 99400-0001')],cli:'h'}));ok(r.ok&&cnt(w,18).lotado,'público ocupa as vagas liberadas e a noite volta a LOTADO');
 // convidado que recusou e quer voltar com a noite cheia: barrado; convidado normal pendente continua garantido
 const rc=R(w.guest.confirmar({id:gAc.id,titNome:gAc.nome.replace(/\s*\(.*\)/,''),titTel:'(42) 97000-0001',vaiAcomp:false,telAtual:'(42) 97000-0001'}));ok(rc.code==='lotado','convidado que tinha dito "Não vai" não consegue voltar com a noite lotada ('+rc.code+')');
 const outro=convs18.find(g=>g.id!==gAc.id&&!g.acomp);const ro=R(w.guest.confirmar({id:outro.id,titNome:outro.nome.replace(/\s*\(.*\)/,''),titTel:'(42) 97100-0001',vaiAcomp:false}));ok(ro.ok===true,'convidado da lista que ainda não respondeu continua garantido com a noite lotada');
 // ---- confirmação do convidado com acompanhante reduz/aumenta ----
 w=W();const ca=G.find(g=>g.dia===19&&g.acomp);const t0=cnt(w,19).total;
 w.guest.confirmar({id:ca.id,titNome:ca.nome.replace(/\s*\(.*\)/,''),titTel:'(42) 97200-0001',vaiAcomp:false});
 ok(cnt(w,19).total===t0-1&&cnt(w,19).confirmadosPessoas===1,'convidado confirma sozinho: acompanhante liberado (total -1)');
 // ---- cancelar reserva ----
 w=W();r=R(w.pub.reservar({dia:20,pessoas:[P('Joana Silva','(42) 99500-0001'),P('Pedro Silva','(42) 99500-0002')],cli:'i'}));const pr=r.resumo.protocolo;
 ok(R(w.pub.abrirReserva('Joana Silva','(42) 99500-0002')).code==='nao_achou','consulta com nome e celular que não batem é recusada');
 ok(R(w.pub.abrirReserva('joana  SILVA','(42) 99500-0001')).resumos.length===1&&R(w.pub.abrirReserva('Pedro Silva','(42) 99500-0002')).ok,'consulta por nome + celular (sem acento/caixa, qualquer pessoa da reserva)');
 ok(R(w.pub.cancelarReserva(pr,'Joana Silva','(42) 99500-0002')).code==='nao_achou'&&cnt(w,20).publico===2,'cancelar com celular errado é recusado');
 ok(R(w.pub.cancelarReserva(pr,'Joana Silva','(42) 99500-0001')).ok&&cnt(w,20).publico===0&&w.sheets.Reservas.rows.slice(1).every(x=>x[6]==='Cancelado'),'cancelamento libera as 2 vagas e marca Cancelado');
 ok(R(w.pub.cancelarReserva(pr,'Joana Silva','(42) 99500-0001')).code==='nao_achou','cancelar duas vezes não funciona');
 ok(R(w.pub.reservar({dia:20,pessoas:[P('Joana Silva','(42) 99500-0001')],cli:'j'})).ok,'após cancelar, a mesma pessoa pode reservar de novo');
 // limite de tentativas por cliente
 {let ult;for(let i=0;i<8;i++)ult=R(w.pub.reservar({dia:21,pessoas:[P('Spam Teste','abc')],cli:'spam'}));ok(ult.code==='limite','muitas tentativas do mesmo cliente -> limite')}
 // ---- páginas (UI) ----
 w=W();
 let pg=await pagina(w.pub,'/tmp/out/publico/Index.html');
 await pg.waitForSelector('#noites .noite');
 ok((await pg.$$('#noites .noite')).length===4&&(await pg.textContent('#s-home')).includes('história')&&!(await pg.textContent('#s-home')).includes('comanda'),'home: 4 cards de noite, texto comercial, sem destaque de cobrança');
 await pg.screenshot({path:'shot_pub_home.png',fullPage:true});
 await pg.click('#noites .noite');await pg.waitForSelector('#s-form:not(.hide)');
 ok((await pg.textContent('#tk .tk-hr')).includes('R$ 40')&&(await pg.textContent('.tk-note')).includes('R$ 40,00')&&(await pg.textContent('.tk-note')).includes('comanda')&&(await pg.$$('.tk-pr')).length===0,'ingresso: valor na faixa dos horários + pequeno comentário (R$ 40,00 na comanda)');
 ok((await pg.$$('#qtd button')).length===4&&(await pg.$$('#pessoas .pess')).length===1,'seletor de 1 a 4 pessoas; começa com 1');
 await pg.screenshot({path:'shot_pub_form1.png',fullPage:true});
 await pg.click('#qtd button:nth-child(3)');ok((await pg.$$('#pessoas .pess')).length===3,'escolher 3 pessoas abre 3 blocos nome+celular');
 await pg.fill('#pn0','Joao');await pg.fill('#pt0','4299');await pg.click('#btn-res');
 ok((await pg.textContent('#e-nome0')).includes('nome completo')&&(await pg.textContent('#e-tel0')).includes('(42) 99999-9999')&&(await pg.textContent('#e-nome1')).includes('pessoa 2')&&(await pg.textContent('#e-tel2')).includes('pessoa 3'),'faltando dados de qualquer pessoa: erro em cada campo, reserva não conclui');
 await pg.fill('#pn0','Joao Pereira');await pg.type('#pt0','','');await pg.fill('#pt0','');await pg.type('#pt0','42991000001');ok((await pg.inputValue('#pt0'))==='(42) 99100-0001','máscara de celular');
 await pg.fill('#pn1','Maria Pereira');await pg.type('#pt1','42991000002');await pg.fill('#pn2','Pedro Pereira');await pg.type('#pt2','42991000003');
 await pg.screenshot({path:'shot_pub_form3.png',fullPage:true});
 await pg.click('#btn-res');await pg.waitForSelector('#s-ok:not(.hide)');
 const sum=await pg.textContent('#ok-sum');ok(sum.includes('R2')&&sum.includes('20h')&&(await pg.textContent('#s-ok')).includes('até as 20h'),'tela de sucesso: protocolo e validade até 20h');
 await pg.screenshot({path:'shot_pub_ok.png',fullPage:true});
 ok(w.sheets.Reservas.rows.length===4&&cnt(w,18).publico===3,'3 pessoas gravadas em Reservas pela página');
 await pg.click('#ok-cancel');ok((await pg.textContent('#ok-cancel')).includes('Toque de novo'),'cancelar pede segundo toque');await pg.click('#ok-cancel');await pg.waitForSelector('#s-aviso:not(.hide)');
 ok((await pg.textContent('#a-titulo'))==='Reserva cancelada'&&cnt(w,18).publico===0,'cancelamento pela página libera as vagas');
 // consulta por protocolo
 w.pub.reservar({dia:19,pessoas:[P('Rita Lopes','(42) 99700-0001')],cli:'m'});
 await pg.click('#a-voltar');await pg.click('#b-look');await pg.fill('#lNome','x');await pg.fill('#lTel','(42) 99700-0001');await pg.click('#btn-look');ok((await pg.textContent('#e-look')).includes('nome completo'),'nome inválido é recusado');
 await pg.fill('#lNome','Rita Lopes');await pg.fill('#lTel','(42) 99700-0001');await pg.click('#btn-look');await pg.waitForSelector('#s-ok:not(.hide)');ok((await pg.textContent('#ok-sum')).includes('Rita Lopes'),'consulta por nome + celular abre a reserva');
 await pg.close();
 // noite lotada na home + sem_vagas na página
 w=W();enche(w,19,25);
 pg=await pagina(w.pub,'/tmp/out/publico/Index.html');await pg.waitForSelector('#noites .noite');
 ok((await pg.textContent('#noites')).includes('Últimas vagas'),'noite com poucas vagas aparece como "Últimas vagas"');
 await pg.close();
 w=W();enche(w,19,26);pg=await pagina(w.pub,'/tmp/out/publico/Index.html');await pg.waitForSelector('#noites .noite');
 const bs=await pg.$$('#noites .noite');ok(cnt(w,19).lotado&&(await bs[1].isDisabled())&&(await bs[1].textContent()).includes('Lotado')&&!(await bs[0].isDisabled()),'noite lotada aparece "Lotado" e não pode ser selecionada; as demais abrem');
 await pg.screenshot({path:'shot_pub_lotado.png',fullPage:true});
 // corrida: a noite enche enquanto a pessoa preenche o formulário
 w=W();enche(w,18,16);pg=await pagina(w.pub,'/tmp/out/publico/Index.html');await pg.waitForSelector('#noites .noite');await pg.click('#noites .noite');await pg.waitForSelector('#s-form:not(.hide)');
 ok((await pg.textContent('#qtd-h')).includes('agilizar o cadastro'),'texto explica que o celular agiliza o cadastro e a experiência');
 if(!enche(w,18,2,100).ok)throw new Error('preparo falhou');
 await pg.click('#qtd button:nth-child(2)');await pg.fill('#pn0','Joao Pereira');await pg.type('#pt0','42991000001');await pg.fill('#pn1','Maria Pereira');await pg.type('#pt1','42991000002');await pg.click('#btn-res');await pg.waitForSelector('#s-aviso:not(.hide)',{timeout:4000}).catch(async()=>{console.log('DBG',await pg.evaluate(()=>[...document.querySelectorAll('section')].filter(x=>!x.classList.contains('hide')).map(x=>x.id).join()+' | '+document.getElementById('btn-res').textContent+' | '+document.getElementById('pn0').value+' | '+document.getElementById('pt1').value),await pg.textContent('#e-geral'),await pg.textContent('#e-nome0'),await pg.textContent('#e-tel0'),await pg.textContent('#e-nome1'),await pg.textContent('#e-tel1'))});
 ok((await pg.textContent('#a-titulo')).includes('esgotou'),'noite que lotou durante o preenchimento: aviso claro, nada gravado ('+w.sheets.Reservas.rows.length+' linhas)');
 await pg.close();
 // falha de comunicação / timeout
 w=W();pg=await pagina(w.pub,'/tmp/out/publico/Index.html');await pg.waitForSelector('#noites .noite');
 await pg.evaluate(()=>{window.__TMO=500;window.google.script.run.withSuccessHandler=()=>({withFailureHandler:()=>new Proxy({},{get:()=>()=>{}})})});
 await pg.click('#noites .noite');await pg.fill('#pn0','Joao Pereira');await pg.type('#pt0','42991000001');await pg.click('#btn-res');await pg.waitForFunction(()=>document.getElementById('e-geral').textContent.includes('Código'),null,{timeout:5000});
 ok((await pg.textContent('#e-geral')).includes('C03')&&!(await vis(pg,'s-ok')),'servidor sem resposta -> C03 e não mostra "reservado"');await pg.close();
 // roteamento doGet
 {const c=w.guest;c.HtmlService={createTemplateFromFile:(n)=>({evaluate(){return{setTitle(){return this},addMetaTag(){return this},setXFrameOptionsMode(){return this},_t:n}}}),createHtmlOutputFromFile:(n)=>({setTitle(){return this},addMetaTag(){return this},setXFrameOptionsMode(){return this},_t:n}),XFrameOptionsMode:{ALLOWALL:1}};
  ok(c.doGet({parameter:{}})._t==='Index'&&c.doGet({parameter:{p:'painel'}})._t==='Painel'&&c.doGet({parameter:{p:'gestao'}})._t==='Painel'&&c.doGet({parameter:{p:'metricas'}})._t==='Painel'&&c.doGet()._t==='Index','doGet: padrão = página dos convidados; ?p=painel (e links antigos) = painel único')}
 // separação: o projeto público não contém busca nem lista de convidados
 const ps=fs.readFileSync('/tmp/out/publico/Code.gs','utf8'),pi=fs.readFileSync('/tmp/out/publico/Index.html','utf8');
 ok(!/buscarNome|function buscar|function confirmar_|function metricas|Strack|script\.google\.com\/macros\/s\/AKfy/.test(ps+pi)&&!ps.includes('Strack'),'projeto público não contém busca, confirmação de convidados, métricas, nomes nem a URL dos convidados');
 await br.close();console.log(out.join('\n'));
})();
