const vm=require('vm'),fs=require('fs');let P=0,F=0;const ok=(c,m)=>{c?P++:F++;console.log((c?'PASS ':'FAIL ')+m)};
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('/tmp/out/convidados/Code.gs','utf8'),ctx);
const todos=[{id:'G215',nome:'Helon Teixeira'},{id:'G216',nome:'Heron Teixeira'},{id:'G1',nome:'Ana Maria Silva'},{id:'G2',nome:'Ana Silva'},{id:'G3',nome:'Andressa Jarschel'}];
const g=id=>todos.find(x=>x.id===id);const U=(id,d,confs=[])=>ctx.regrasUnicidade_(g(id),d,confs,todos,0);
ok(U('G215',{titNome:'Helon Teixeira',acNome:'Andressa Adamcheski'})===null,'Helon confirma com a esposa Andressa Adamcheski: liberado');
ok(U('G216',{titNome:'Heron Teixeira',acNome:'Andressa Adamcheski'})===null,'Heron confirma o próprio convite: liberado');
const conf=[{status:'Confirmado',linha:2,titNome:'Helon Teixeira',acNome:'Andressa Adamcheski'}];
ok(U('G216',{titNome:'Heron Teixeira'},conf)===null,'Heron não é barrado por Helon já confirmado');
const r=U('G216',{titNome:'Heron Teixeira',acNome:'Andressa Adamcheski'},conf);
ok(r&&r.code==='nome_duplicado','mas a mesma esposa não pode entrar em dois convites');
ok((U('G2',{titNome:'Ana Maria Silva'})||{}).code==='titular_outro_convidado','titular que digita o nome completo de OUTRO convite continua barrado');
ok(U('G1',{titNome:'Ana Maria Silva'})===null,'o dono do convite digitando o próprio nome passa');
ok((U('G215',{titNome:'Helon Teixeira',acNome:'Andressa Jarschel'})||{}).code==='acomp_e_convidado','acompanhante que já tem convite próprio continua barrado');
ok(U('G215',{titNome:'Helom Teixeira'})===null,'typo de uma letra no próprio nome continua aceito');
console.log('PASS',P,'FAIL',F);process.exit(F?1:0)
