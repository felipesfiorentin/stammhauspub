const vm=require('vm'),fs=require('fs');let P=0,F=0;const ok=(c,m)=>{c?P++:F++;console.log((c?'PASS ':'FAIL ')+m)};
const src=fs.readFileSync('/home/claude/stammhauspub/src/Whats.src.gs','utf8');
function mk(rows,cfg,opts={}){
 const sent=[],cells={};let trig=0;
 const sheetC={getLastRow:()=>rows.length+1,getMaxColumns:()=>12,insertColumnsAfter(){},getRange(r,c,nr,nc){return{getValues:()=>rows.map(x=>{const y=x.slice();while(y.length<13)y.push('');return y}),getValue:()=>rows[r-2][c-1]||'',setValue(v){rows[r-2][c-1]=v;cells[r+','+c]=v},setValues(){}}}};
 const sheetCfg={getLastRow:()=>Object.keys(cfg).length,getRange:(r,c,nr,nc)=>({getValues:()=>Object.entries(cfg).map(([k,v])=>[k,v]),setValues(v){cfg[v[0][0]]=v[0][1]}})};
 const ctx={console,JSON,Date,Math,Number,String,RegExp,Object,Array,Error,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>({WA_TOKEN:'t',WA_PHONE_ID:'123'}[k])})},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  Utilities:{sleep(){},formatDate:(d,tz,f)=>f==='yyyy-MM-dd'?d.toISOString().slice(0,10):''},
  ScriptApp:{getProjectTriggers:()=>[],newTrigger:()=>({timeBased:()=>({everyMinutes:()=>({create(){trig++}})})})},
  UrlFetchApp:{fetch(u,o){const b=JSON.parse(o.payload);sent.push(b);const fail=opts.fail&&opts.fail(b);return{getResponseCode:()=>fail?400:200,getContentText:()=>JSON.stringify(fail?{error:{message:'template nao aprovado'}}:{messages:[{id:'wamid.'+sent.length}]})}}},
  TZ:'America/Sao_Paulo',ABA:{CONV:'Convidados',CFG:'Config'},
  aba_:n=>n==='Convidados'?sheetC:sheetCfg,lerConfig_:()=>Object.entries(cfg),registrarErro_(){},digitos_:s=>String(s||'').replace(/\D/g,''),
  prog_:()=>({18:{label:'Quarta-feira, 18/11',atracao:'Formal'},19:{label:'Quinta-feira, 19/11',atracao:'MPB'}})};
 vm.createContext(ctx);vm.runInContext(src,ctx);return{ctx,sent,rows,cells,get trig(){return trig}};
}
const mkrows=()=>[['A1','Ana Souza',18,1,'Família',1,'','','','(47) 99250-5290','Digital','',''],
 ['A2','Bruno Lima',19,2,'Projeto',0,'','','','(47) 99111-2222','Fisico','',''],
 ['A3','Sem Fone',18,1,'Família',0,'','','','','','',''],
 ['A4','Ja Enviado',18,1,'Família',0,'','','','(47) 98888-7777','Digital',new Date('2026-11-14T12:00:00Z'),''],
 ['A5','Fone Ruim',18,1,'Família',0,'','','','4799','Digital','','']];
let t=mk(mkrows(),{convites_ativo:'NAO'});
ok(t.ctx.processarConvitesWhats().ok===false&&t.sent.length===0,'desligado por padrão: nada é enviado');
t=mk(mkrows(),{convites_ativo:'SIM'});let r=t.ctx.processarConvitesWhats();
ok(r.ok&&r.feitos===2&&t.sent.length===2,'envia só a quem tem celular válido e ainda não recebeu (2 de 5)');
const b0=t.sent[0],c=b0.template;
ok(b0.to==='5547992505290'&&b0.type==='template'&&c.name==='convite_inauguracao'&&c.language.code==='pt_BR','destino com 55, template e idioma corretos');
ok(c.components[0].parameters.map(x=>x.text).join('|')==='Ana|Quarta-feira, 18/11|Formal|Seu convite inclui um acompanhante.','variáveis: nome, noite, atração, acompanhante');
ok(t.sent[1].template.components[0].parameters[3].text==='Convite individual.','sem acompanhante: "Convite individual."');
ok(t.rows[0][11] instanceof Date&&/^ENVIADO · wamid\./.test(t.rows[0][12])&&!t.rows[2][11]&&!t.rows[4][11],'grava data (L) e situação (M) só de quem enviou');
r=t.ctx.processarConvitesWhats();ok(r.feitos===0&&t.sent.length===2,'segunda rodada não reenvia');
const rs=t.ctx.resumoConvitesWhats();ok(rs.convidados===5&&rs.comTelefone===3&&rs.jaEnviados===3&&rs.aEnviar===0,'resumo: '+JSON.stringify(rs));
// falhas
t=mk(mkrows(),{convites_ativo:'SIM'},{fail:()=>true});r=t.ctx.processarConvitesWhats();
ok(/^ERRO 1 · /.test(t.rows[0][12])&&!t.rows[0][11],'erro: registra tentativa 1 e não marca como enviado');
t.ctx.processarConvitesWhats();t.ctx.processarConvitesWhats();
ok(/^FALHOU · /.test(t.rows[0][12]),'após 3 tentativas fica FALHOU');
const n3=t.sent.length;t.ctx.processarConvitesWhats();ok(t.sent.length===n3,'FALHOU não é reenviado sozinho');
// painel marcou enviado
const rows=mkrows();rows[0][11]=new Date();t=mk(rows,{convites_ativo:'SIM'});t.ctx.processarConvitesWhats();ok(t.sent.length===1&&t.sent[0].to==='5547991112222','quem o painel já marcou como enviado é pulado');
// limite diário
const big=[];for(let i=0;i<230;i++)big.push(['B'+i,'Pessoa '+i,18,1,'Família',0,'','','','(47) 99'+String(100+i%900).padStart(3,'0')+'-'+String(1000+i).slice(-4),'Digital','','']);
t=mk(big,{convites_ativo:'SIM'});let tot=0;for(let k=0;k<20;k++)tot+=t.ctx.processarConvitesWhats().feitos;
ok(tot===200,'limite de 200 por dia respeitado: '+tot);
// instalar
const cfg={whatsapp_ativo:'NAO'};t=mk(mkrows(),cfg);t.ctx.instalarConvitesWhats();ok(cfg.convites_ativo==='NAO'&&t.trig===1,'instalação cria Config convites_ativo=NAO e o gatilho');
console.log('\nPASS',P,'FAIL',F);
