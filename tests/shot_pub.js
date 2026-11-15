const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--allow-file-access-from-files']});
let h=fs.readFileSync('/tmp/out/publico/Index.html','utf8').replace('https://stammhauspub.github.io/assets/cards/','file:///home/claude/work/cards/');fs.writeFileSync('/tmp/pubshot.html',h);
const L=['Quarta-feira, 18/11','Quinta-feira, 19/11','Sexta-feira, 20/11','Sábado, 21/11'],A=['Lonesome Capitain · Country & Folk','Os Bauretz · Soul, Disco & MPB','Hardways · Classic Rock','Rodrigo Seidel e banda · Pop Rock'];
const pg=await br.newPage({viewport:{width:390,height:900},deviceScaleFactor:2});
await pg.addInitScript(({L,A})=>{window.google={script:{run:{withSuccessHandler(s){return{withFailureHandler(f){return new Proxy({},{get:(_,fn)=>()=>setTimeout(()=>s({ok:true,noites:[18,19,20,21].map((d,i)=>({dia:d,label:L[i],atracao:A[i],lotado:false,vagas:4})),info:{valor:40,ate:'20h',max:4}}),50)})}}}}}}},{L,A});
await pg.goto('file:///tmp/pubshot.html');await pg.waitForSelector('.noite');
for(let i=0;i<4;i++){await pg.goto('file:///tmp/pubshot.html');await pg.waitForSelector('.noite');await (await pg.$$('.noite'))[i].click();await pg.waitForTimeout(600);await (await pg.$('#tk')).screenshot({path:'/tmp/tk'+(18+i)+'.png'})}
await br.close()})();
