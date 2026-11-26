const fs=require('fs');const h=fs.readFileSync('/tmp/out/convidados/Painel.html','utf8');const js=(h.match(/<script[^>]*>([\s\S]*?)<\/script>/g)||[]).join('\n').replace(/<\/?script[^>]*>/g,'');
const a=js.indexOf('function htmlTodos'),b=js.indexOf('function exportarTodos');let src=js.slice(a,b);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const cvTel=c=>c.tel||c.titTel||'';
const S={geradoEm:'16/11 15:00',noites:[{dia:18,label:'Quarta, 18/11',atracao:'Banda A'},{dia:19,label:'Quinta, 19/11',atracao:''}],convidados:[
{id:'1',nome:'Ana Teste',dia:18,acomp:1,status:'Confirmado',pessoas:2,titNome:'Ana Teste',titTel:'(47) 99999-0001',acNome:'Beto Teste',acTel:'(47) 99999-0002',tel:'(47) 99999-0001',tipo:'Digital',env:'15/11 20:00',grupo:'G'},
{id:'2',nome:'Caio <x>',dia:18,acomp:0,status:'Pendente',pessoas:0,tel:'',tipo:'Físico',env:''},{id:'3',nome:'Duda',dia:19,acomp:1,status:'Não vai',pessoas:0}]};
const f=new Function('S','esc','cvTel',src+';return htmlTodos()');const out=f(S,esc,cvTel);let P=0,F=0;const ok=(c,m)=>{c?P++:F++;console.log((c?'PASS ':'FAIL ')+m)};
ok((out.match(/class="pg"/g)||[]).length===1,'uma página por noite (quebra entre noites)');
ok(out.includes('confirmados <b>1</b> (2 pessoas)')&&out.includes('sem resposta <b>1</b>')&&out.includes('Sem resposta')&&out.includes('+ Beto Teste'),'contagens, status e acompanhante');
ok(out.includes('Caio &lt;x&gt;')&&!out.includes('<x>'),'nomes escapados');
ok(out.includes('Não vai')&&out.includes('(+1)'),'não vai e +1');
console.log('PASS',P,'FAIL',F);process.exit(F?1:0)
