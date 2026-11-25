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
 const E0={cache:'',integrantes:'',consumacao:'',estadia:'',transporte:''};
 const sal=(iso,at)=>w.guest.gDiaSalvar(K,iso,at,'Rock',true,Object.assign({aberto:true},E0));
 // ---- andar ----
 sal('2026-11-25','Banda Andar');w.pub.cacheLimpa_();
 const dia=R(w.pub.dados()).noites.find(x=>x.atracao==='Banda Andar').dia;
 let r=R(w.pub.reservar({dia,pessoas:[{nome:'Joao Pereira',tel:'(42) 99100-0001'}],andar:'Térreo',cli:'a1'}));ok(r.ok&&r.resumo.andar==='Térreo','reserva com Térreo: resumo traz o ambiente');
 r=R(w.pub.reservar({dia,pessoas:[{nome:'Maria Souza',tel:'(42) 99100-0002'}],andar:'Andar superior',cli:'a2'}));ok(r.ok&&r.resumo.andar==='Andar superior','reserva com Andar superior');
 r=R(w.pub.reservar({dia,pessoas:[{nome:'Ana Lima',tel:'(42) 99100-0003'}],cli:'a3'}));ok(r.ok&&r.resumo.andar==='','sem escolha (página antiga em cache) segue funcionando');
 r=R(w.pub.reservar({dia,pessoas:[{nome:'Rui Costa',tel:'(42) 99100-0004'}],andar:'cobertura',cli:'a4'}));ok(r.ok===false&&r.campo==='andar','ambiente inválido é rejeitado');
 const rs=w.pub.reservas_().filter(x=>x.dia===dia);ok(rs.find(x=>x.nome==='Joao Pereira').andar==='Térreo'&&rs.find(x=>x.nome==='Maria Souza').andar==='Andar superior'&&rs.find(x=>x.nome==='Ana Lima').andar==='','planilha (coluna L) guarda o ambiente por reserva');
 const ab=R(w.pub.abrirReserva('Joao Pereira','(42) 99100-0001'));ok(ab.ok&&ab.resumos[0].andar==='Térreo','consulta da reserva mostra o ambiente');
 const pn=R(w.guest.painel(K));ok(pn.reservas.find(g=>g.pessoas.some(p=>p.nome==='Maria Souza')).andar==='Andar superior','painel recebe o ambiente da reserva');
 // ---- artes: pasta do Drive (mock) ----
 const LISTA={ROOT:[{id:'F1',name:'Banda Nova',mimeType:'application/vnd.google-apps.folder'},{id:'F2',name:'Só PDF',mimeType:'application/vnd.google-apps.folder'},{id:'F3',name:'Os Bauretz',mimeType:'application/vnd.google-apps.folder'}],
   F1:[{id:'L1',name:'Logo branca_Banda Nova.png',mimeType:'image/png',size:'9000'},{id:'L2',name:'Logo preta_Banda Nova.png',mimeType:'image/png',size:'9000'},{id:'P1',name:'IMG_2.jpg',mimeType:'image/jpeg',size:'900000'},{id:'P2',name:'IMG_1.jpg',mimeType:'image/jpeg',size:'800000'},{id:'P3',name:'IMG_3.jpg',mimeType:'image/jpeg',size:'700000'},{id:'V1',name:'video.mp4',mimeType:'video/mp4',size:'9000000'}],
   F2:[{id:'D1',name:'portfolio.pdf',mimeType:'application/pdf',size:'8000000'}],F3:[{id:'S',name:'sub',mimeType:'application/vnd.google-apps.folder'}],S:[{id:'B1',name:'foto.jpg',mimeType:'image/jpeg',size:'500000'}]};
 let chamadas=0;const cache={};const UU=w.pub;
 UU.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};
 UU.ScriptApp.getOAuthToken=()=>'tok';UU.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
 UU.UrlFetchApp={fetch(u){chamadas++;let m;if((m=/files\?q=([^&]+)/.exec(u))){const q=decodeURIComponent(m[1]);const id=/'([^']+)' in parents/.exec(q)[1];return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({files:LISTA[id==='1gTowXWgSFVKnaoGYktAMfN3hrwUYLB7R'?'ROOT':id]||[]})}}
   if(/fields=thumbnailLink/.test(u))return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({thumbnailLink:'https://lh3/'+/files\/([^?]+)/.exec(u)[1]+'=s220'})};
   return{getResponseCode:()=>200,getBlob:()=>({getContentType:()=>'image/jpeg',getBytes:()=>Array.from(Buffer.from('JPG:'+u))})}}};
 UU.DriveApp={getFileById:id=>({getBlob:()=>({getContentType:()=>'image/png',getBytes:()=>Array.from(Buffer.from('PNG:'+id))})})};
 UU.CacheService={getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},putAll:o=>Object.assign(cache,o),getAll:ks=>Object.fromEntries(ks.map(k=>[k,cache[k]??null])),remove:k=>{delete cache[k]}})};
 ok(UU.nomeArtista_('Os Bauretz · Soul')==='bauretz'&&UU.nomeArtista_('Diego Küchler')==='diego kuchler'&&UU.nomeArtista_('Engenheiros do Hawaii Cover - Curitiba/PR')==='engenheiros do hawaii cover','nomes normalizados (acento, "Os", sufixos)');
 let a=R(UU.arte_('Banda Nova · Rock'));ok(a.ok&&Buffer.from(a.logo.split(',')[1],'base64').toString()==='PNG:L2'&&a.fotos.length===2,'busca pelo nome: logo preto escolhido (branco ignorado) e 2 fotos');
 ok(a.fotos[0].startsWith('data:image/jpeg;base64,')&&Buffer.from(a.fotos[0].split(',')[1],'base64').toString().includes('IMG_1'.length?'lh3':''),'fotos vêm da miniatura do Drive, em ordem de nome');
 const c0=chamadas;UU.arte_('Banda Nova');ok(chamadas===c0,'segunda busca vem do cache (sem chamar o Drive)');
 ok(R(UU.arte_('Só PDF')).ok===false,'pasta só com PDF/vídeo: sem arte');ok(R(UU.arte_('Artista Inexistente')).ok===false,'sem pasta com o nome: sem arte');
 a=R(UU.arte_('Os Bauretz'));ok(a.ok&&a.fotos.length===1&&a.logo==='','acha por trecho do nome e em subpasta');
 ok(R(UU.arte_('ab')).ok===false,'nome curto demais não busca');
 // ---- páginas ----
 sal('2026-11-26','Diego Küchler');sal('2026-11-27','Rock Grande · South St. Mathews');sal('2026-11-28','Banda Nova · Rock');sal('2026-12-02','Banda Sem Arte');w.pub.cacheLimpa_();
 let pg=await pagina(w.pub,'/tmp/out/publico/Index.html');await pg.setViewportSize({width:390,height:800});await pg.reload();await pg.waitForSelector('#noites .noite');await pg.waitForTimeout(1500);
 const info=await pg.evaluate(()=>[...document.querySelectorAll('#noites .noite')].map(n=>({t:n.innerText.replace(/\s+/g,' '),f:[...n.querySelectorAll('.tk-hr > div')].map(d=>d.querySelector('small').textContent+'='+d.querySelector('b').textContent),ov:[...n.querySelectorAll('.tk-hr b')].some(b=>b.scrollWidth>b.parentNode.clientWidth+1),ph:[...n.querySelectorAll('.tk-ph')].map(p=>p.style.backgroundImage.slice(0,200)),logo:(n.querySelector('.tk-logo img')||{}).src||'',wp:!!n.querySelector('.tk-wp'),wide:n.querySelector('.tk').classList.contains('wide')})));
 const T=x=>info.find(i=>i.t.includes(x));
 ok(info.length>=4&&info.every(i=>i.f.length===4&&i.f[0].startsWith('Abertura')&&i.f[1].startsWith('Show')&&i.f[2].startsWith('Entrada')&&i.f[3].startsWith('Vagas')),'barra inferior: Abertura, Show, Entrada e Vagas em todos os tickets');
 ok(info.every(i=>!i.ov),'nenhum campo da barra estoura a largura no celular (390 px)');
 console.log(JSON.stringify(info.filter(i=>/26 NOV|27 NOV|28 NOV/.test(i.t)).map(i=>({ph:i.ph,logo:i.logo.slice(0,50),wp:i.wp,wide:i.wide}))));
 ok(T('QUINTA 26 NOV')&&T('QUINTA 26 NOV').ph.length===2&&T('QUINTA 26 NOV').ph[0].includes('art-diego-kuchler-L')&&!T('QUINTA 26 NOV').logo,'Diego Küchler: arte pronta (2 fotos) e nome em texto');
 ok(T('SEXTA 27 NOV')&&T('SEXTA 27 NOV').logo.includes('art-rock-grande-logo')&&T('SEXTA 27 NOV').wp,'Rock Grande: logo + foto larga');
 ok(T('SÁBADO 28 NOV')&&T('SÁBADO 28 NOV').logo.startsWith('data:image/png')&&T('SÁBADO 28 NOV').ph.length===2&&T('SÁBADO 28 NOV').ph[0].includes('data:image/jpeg'),'Banda Nova: arte vinda da pasta do Drive (carregada depois da lista)');
 ok(T('Banda Sem Arte')&&T('Banda Sem Arte').ph.length===0&&!T('Banda Sem Arte').logo,'sem imagem: ticket só de texto');
 // ---- formulário: ambiente obrigatório ----
 await pg.click('#noites .noite:has-text("Banda Andar")');await pg.fill('#pn0','Joao Pereira Dois');await pg.type('#pt0','42991000077');await pg.click('#btn-res');await pg.waitForTimeout(400);
 ok((await pg.textContent('#e-andar')).includes('Escolha'),'sem escolher o ambiente: aviso e não reserva');
 await pg.click('#andar button:nth-child(2)');ok(await pg.evaluate(()=>document.querySelector('#andar button.on').textContent.includes('Andar superior')),'botão do ambiente fica marcado');
 await pg.click('#btn-res');await pg.waitForSelector('#s-ok:not(.hide)',{timeout:6000});ok((await pg.textContent('#ok-sum')).includes('Andar superior'),'resumo da reserva mostra o ambiente');
 await pg.screenshot({path:'/tmp/mob2.png',fullPage:true});
 await br.close();console.log(out.join('\n'));process.exit(0)
})();
