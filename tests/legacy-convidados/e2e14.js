const vm=require('vm'),fs=require('fs');let P=0,F=0;const ok=(c,m)=>{c?P++:F++;console.log((c?'PASS ':'FAIL ')+m)};
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('/home/claude/stammhauspub/src/Lista.src.gs','utf8'),ctx);
const L=(nome,dia,tel,extra={})=>Object.assign({nome,dia,tel:{tel},mais1:false,tipo:'',n:null,estilo:'',grupo:'Lista',convite:''},extra);
const B=(id,linha,nome,dia,tel,extra={})=>Object.assign({id,linha,nome,dia,estilo:'',grupo:'',acomp:0,busca:'',tel:tel||'',tipo:'',env:''},extra);
// 1) variante de grafia com o mesmo celular casa com o convite existente (não cria novo)
let pl=ctx.lnPlano_([L('Fulana Carolina Silvestre Henkels',19,'(47) 90000-0001')].map(x=>{x.nome='Carolina Winter Henkels';return x}),[B('G084',5,'Carolina Winter Henckels',19,'(47) 90000-0001')]);
ok(pl.novos.length===0&&pl.busca.length===1,'Carolina/Caroline + Henckels/Henkels com mesmo celular: mesma pessoa, sem convite novo');
// 2) sem celular igual, mesmo nome com 2 divergências NÃO casa por aproximação
pl=ctx.lnPlano_([L('Caroline Winter Henkels',19,'')],[B('G084',5,'Carolina Winter Henckels',19,'(47) 90000-0001')]);
ok(pl.novos.length===1,'sem celular igual não funde por aproximação (evita unir pessoas diferentes)');
// 3) Helon e Heron com celulares diferentes continuam distintos
pl=ctx.lnPlano_([L('Helon Teixeira',20,'(47) 90000-0002'),L('Heron Teixeira',20,'(47) 90000-0003')],[B('G1',1,'Helon Teixeira',20,'(47) 90000-0002'),B('G2',2,'Heron Teixeira',20,'(47) 90000-0003')]);
ok(pl.novos.length===0&&pl.remover.length===0,'Helon e Heron permanecem dois convites');
// 4) duplicado já existente no banco (mesmo celular, nome parecido, mesma noite) é removido; fica o mais antigo
pl=ctx.lnPlano_([],[B('G084',5,'Carolina Winter Henckels',19,'(47) 90000-0001'),B('G217',90,'Caroline Winter Henkels',19,'(47) 90000-0001')]);
ok(pl.remover.length===1&&pl.remover[0].id==='G217'&&pl.busca.some(x=>x.id==='G084'),'duplicata G217 removida; nome dela vai para a busca do original');
// 5) Helon/Heron mesmo celular (casal compartilhando) NÃO são fundidos
pl=ctx.lnPlano_([],[B('G1',1,'Helon Teixeira',20,'(47) 90000-0002'),B('G2',2,'Heron Teixeira',20,'(47) 90000-0002')]);
ok(pl.remover.length===0,'nomes curtos parecidos com mesmo celular não são fundidos');
console.log('PASS',P,'FAIL',F);process.exit(F?1:0)
