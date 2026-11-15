import asyncio
from playwright.async_api import async_playwright
C={'Adilson Strack':(18,'Quarta-feira, 18/11','Lonesome Capitain · Country & Folk',0),
   'Eliane Meiners':(19,'Quinta-feira, 19/11','Os Bauretz · Soul, Disco & MPB',1),
   'Marcos Schadeck Fiorentin':(20,'Sexta-feira, 20/11','Hardways · Classic Rock',0),
   'Amanda Süssenbach Pereira':(21,'Sábado, 21/11','Rodrigo Seidel e banda · Pop Rock',0)}
INIT="""
const C=%s;
function call(fn,a,s){setTimeout(function(){
 if(fn==='buscar'){var n=a[0],c=C[n];s({status:'achei',candidatos:[{id:'G1',nome:n,dia:c[0],diaLabel:c[1],atracao:c[2],acomp:c[3]}]})}
 else if(fn==='estado')s({ok:true,jaConfirmado:false,jaNaoVai:false});
 else if(fn==='config')s({whatsapp:'5547992505290'}); else s({ok:true})},20)}
window.google={script:{run:{withSuccessHandler:function(s){return{withFailureHandler:function(f){
 return new Proxy({},{get:function(_,fn){return function(){call(fn,[].slice.call(arguments),s)}}})}}}}}};
""" 
import json
async def m():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        for n,(d,*_) in C.items():
            pg=await b.new_page(viewport={'width':390,'height':760},device_scale_factor=2)
            await pg.add_init_script(INIT%json.dumps(C,ensure_ascii=False))
            pg.on('console',lambda m:print('C:',m.text));pg.on('pageerror',lambda e:print('E:',e));await pg.goto('file:///home/claude/stammhaus/Index.html')
            await pg.fill('#q',n);await pg.click('#btn-buscar');await pg.wait_for_timeout(800);print(await pg.inner_text('#busca-msg'));await pg.wait_for_selector('#s-result:not(.hide)',timeout=3000);await pg.click('#r-lista .btn');await pg.wait_for_selector('#s-form:not(.hide)')
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'shot_tk{d}.png',clip={'x':0,'y':120,'width':390,'height':520})
            await pg.close()
        await b.close()
asyncio.run(m())
