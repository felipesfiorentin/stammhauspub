const vm=require('vm'),fs=require('fs');let P=0,F=0;const ok=(c,m)=>{c?P++:F++;console.log((c?'PASS ':'FAIL ')+m)};
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('/tmp/out/convidados/Code.gs','utf8'),ctx);
const todos=[{id:'G1',nome:'Luciane Pereira',dia:19},{id:'G2',nome:'Luciane Pereira',dia:21}];
const confs=[{status:'Confirmado',linha:2,id:'G1',dia:19,titNome:'Luciane Pereira',acNome:''}];
const r=ctx.regrasUnicidade_(todos[1],{titNome:'Luciane Pereira',acNome:''},confs,todos,0);
ok(r===null,'mesma pessoa confirma a noite 21 já confirmada na 19');
const r2=ctx.regrasUnicidade_(todos[0],{titNome:'Luciane Pereira',acNome:''},confs,todos,0);
ok(r2&&r2.code==='nome_duplicado','mas não duas vezes na mesma noite');
const L=ctx; vm.runInContext(fs.readFileSync('/tmp/out/convidados/Code.gs','utf8').includes('lnPlano_')?'':'',ctx);
const l=(nome,dia)=>({nome,dia,tel:{tel:''},mais1:false,tipo:'',n:null,estilo:'',grupo:'Lista',convite:''});
const b=(id,linha,nome,dia)=>({id,linha,nome,dia,estilo:'',grupo:'',acomp:0,busca:'',tel:'',tipo:'',env:''});
const pl=ctx.lnPlano_([l('Luciane Pereira',19),l('Luciane Pereira',21)],[b('G1',2,'Luciane Pereira',19)]);
ok(pl.novos.length===1&&pl.novos[0].dia===21,'sincronização cria o convite da noite 21 sem fundir com o da 19');
console.log(P,F);process.exit(F?1:0)
