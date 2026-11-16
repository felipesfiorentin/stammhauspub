const vm=require('vm'),fs=require('fs');let P=0,F=0;const ok=(c,m)=>{c?P++:F++;console.log((c?'PASS ':'FAIL ')+m)};
const src=fs.readFileSync('/tmp/out/publico/Code.gs','utf8');
const ctx={console,Utilities:{formatDate:()=>'2026-11-19'},HtmlService:{createHtmlOutputFromFile(n){return{_t:n,setTitle(){return this},addMetaTag(){return this},setXFrameOptionsMode(){return this}}},XFrameOptionsMode:{ALLOWALL:1}},
 ContentService:{MimeType:{JSON:'json'},createTextOutput(t){return{_t:t,setMimeType(m){this._m=m;return this}}}}};
vm.createContext(ctx);vm.runInContext(src,ctx);
vm.runInContext("prog_=function(){return {18:{iso:'2026-11-18',label:'Quarta, 18/11',atracao:'A',estilo:'x',pub:true},19:{iso:'2026-11-19',label:'Quinta, 19/11',atracao:'B',estilo:'y',pub:true},21:{iso:'2026-11-21',label:'Sábado, 21/11',atracao:'C',estilo:'z',pub:false}}};ordemDias_=function(m){return Object.keys(m).map(Number).sort(function(a,b){return a-b})};",ctx);
const r=ctx.doGet({parameter:{p:'programacao'}});const j=JSON.parse(r._t);
ok(r._m==='json'&&j.ok&&j.noites.length===2&&j.noites[0].iso==='2026-11-19'&&j.noites[1].atracao==='C','?p=programacao devolve JSON só com noites de hoje em diante (lidas da aba)');
ok(!/instagram|conv|tel/i.test(r._t),'JSON não expõe dados internos');
ok(ctx.doGet()._t==='Index'&&ctx.doGet({parameter:{}})._t==='Index','doGet padrão continua sendo a página de reservas');
console.log('PASS',P,'FAIL',F);process.exit(F?1:0)
