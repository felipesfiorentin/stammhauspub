#!/usr/bin/env python3
"""Gera o site institucional (GitHub Pages). Uso: python3 build_site.py <pasta do repo stammhauspub.github.io>"""
import sys, os, shutil
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/site'
HERE = os.path.dirname(os.path.abspath(__file__))
PX = lambda i, w=1600: f'https://images.pexels.com/photos/{i}/pexels-photo-{i}.jpeg?auto=compress&cs=tinysrgb&w={w}'
VID = lambda f: f'https://videos.pexels.com/video-files/{f.split("/")[0]}/{f.split("/")[1]}.mp4'
APP = 'https://script.google.com/macros/s/AKfycbx3wEPWFrKRAjefiG9RLPOqeLPZHeCSnlu551adkqPNJHWbzldQOuhEFcSiqq6ylf-RDw/exec'

CSS = r'''
:root{--verde:#113325;--verde2:#0D5B1D;--ouro:#B47E00;--ouro2:#d9a62e;--laranja:#E04E27;--marrom:#471600;--carvao:#190E0D;--off:#EAE7DA;--escuro:#0b2217}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--escuro);color:var(--off);font:17px/1.65 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}
h1,h2,h3{font-family:'Playfair Display',Georgia,serif;font-weight:700;line-height:1.15;margin:0 0 .5em}
h1{font-size:clamp(34px,6vw,68px)}h2{font-size:clamp(28px,4vw,44px)}h3{font-size:22px}
p{margin:0 0 1em}
.wrap{max-width:1180px;margin:0 auto;padding:0 22px}
.eb{font:700 12px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--ouro2);margin:0 0 14px;display:block}
.lead{font-size:clamp(18px,2.2vw,22px);opacity:.92;max-width:62ch}
.mut{opacity:.72}
.btn{display:inline-block;background:var(--ouro);color:#11251b;font-weight:700;text-decoration:none;padding:15px 28px;border-radius:10px;border:2px solid var(--ouro);transition:.2s;font-size:16px}
.btn:hover{background:var(--ouro2);border-color:var(--ouro2)}
.btn.o{background:transparent;color:var(--off);border-color:rgba(234,231,218,.55)}.btn.o:hover{border-color:var(--ouro2);color:var(--ouro2)}
.row{display:flex;gap:14px;flex-wrap:wrap}
/* nav */
header.nav{position:fixed;top:0;left:0;right:0;z-index:50;transition:background .25s,box-shadow .25s}
header.nav.sol{background:rgba(11,34,23,.96);box-shadow:0 2px 18px rgba(0,0,0,.4);backdrop-filter:blur(6px)}
.nv{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;height:84px;max-width:1280px;margin:0 auto;padding:0 22px}
.nv ul{display:flex;gap:6px;list-style:none;margin:0;padding:0}.nv ul.r{justify-content:flex-end}
.nv a.l{display:block;padding:10px 12px;text-decoration:none;font:600 13px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;opacity:.9}
.nv a.l:hover,.nv a.l.on{color:var(--ouro2);opacity:1}
.nv a.int{border:1px solid rgba(234,231,218,.35);border-radius:8px;font-size:12px}
.logo img{height:52px;width:auto}
.burger{display:none;background:none;border:0;color:var(--off);width:44px;height:44px;cursor:pointer;justify-self:end}
.burger span{display:block;width:26px;height:2px;background:currentColor;margin:6px auto;transition:.2s}
@media(max-width:940px){
 .nv{grid-template-columns:auto 1fr;height:68px}.logo img{height:40px}
 .nv ul{display:none}.burger{display:block}
 header.nav.open{background:rgba(11,34,23,.98)}
 header.nav.open .menu{display:flex}
 .menu{display:none;position:absolute;top:68px;left:0;right:0;background:rgba(11,34,23,.98);flex-direction:column;padding:8px 22px 22px;border-top:1px solid rgba(180,126,0,.4)}
 .menu a{display:block;padding:15px 4px;text-decoration:none;font:600 15px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;border-bottom:1px solid rgba(234,231,218,.1)}
}
@media(min-width:941px){.menu{display:none!important}}
/* hero */
.hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;background:#06130c}
.hero video,.hero .poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,19,12,.55) 0,rgba(6,19,12,.25) 40%,rgba(11,34,23,1) 100%)}
.hero .in{position:relative;z-index:2;padding:130px 22px 90px;max-width:900px}
.hero .sel{display:inline-block;border:1px solid var(--ouro);color:var(--ouro2);padding:9px 18px;border-radius:99px;font:700 12px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;margin-bottom:26px;text-decoration:none;background:rgba(11,34,23,.5)}
.hero h1{text-shadow:0 2px 24px rgba(0,0,0,.6)}.hero h1 em{color:var(--ouro2);font-style:italic}
.hero .lead{margin:0 auto 32px;text-shadow:0 1px 12px rgba(0,0,0,.6)}
.hero .row{justify-content:center}
.scroll{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);z-index:2;opacity:.7;font-size:12px;letter-spacing:.2em;text-transform:uppercase}
.pagehero{position:relative;padding:170px 0 80px;text-align:center;background:linear-gradient(rgba(6,19,12,.7),rgba(11,34,23,1)),var(--bg) center/cover}
.pagehero p{margin-left:auto;margin-right:auto}
/* sections */
section{padding:90px 0}
.alt{background:var(--verde)}
.center{text-align:center}.center .lead{margin-left:auto;margin-right:auto}
.quote{font:italic 600 clamp(24px,3.4vw,38px)/1.3 'Playfair Display',Georgia,serif;text-align:center;color:var(--off);max-width:26ch;margin:0 auto}
.quote small{display:block;margin-top:18px;font:700 12px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--ouro2);font-style:normal}
.split{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.split.rev .ph{order:2}
.ph{aspect-ratio:4/3;border-radius:14px;background:#000 center/cover;box-shadow:0 18px 50px rgba(0,0,0,.5);position:relative;overflow:hidden}
.ph:after{content:"";position:absolute;inset:10px;border:1px solid rgba(217,166,46,.55);border-radius:8px;pointer-events:none}
@media(max-width:860px){.split{grid-template-columns:1fr;gap:28px}.split.rev .ph{order:0}section{padding:64px 0}}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:44px}
.card{background:rgba(7,28,18,.55);border:1px solid rgba(180,126,0,.45);border-radius:14px;padding:28px 24px}
.card .n{font:700 13px/1 Inter,sans-serif;letter-spacing:.2em;color:var(--ouro2);margin-bottom:14px;display:block}
.card p{margin:0;opacity:.88;font-size:16px}
.card h3{margin-bottom:.4em}
.parc{border-top:1px solid rgba(180,126,0,.5);border-bottom:1px solid rgba(180,126,0,.5);padding:46px 0;text-align:center;background:linear-gradient(90deg,transparent,rgba(180,126,0,.12),transparent)}
.parc h2{margin-bottom:.3em}
/* programação */
.days{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;margin-top:40px}
.day{background:#efe8d4;color:#16241b;border-radius:10px;padding:0;overflow:hidden;position:relative;box-shadow:0 10px 26px rgba(0,0,0,.45)}
.day .d{display:flex;align-items:baseline;gap:10px;padding:18px 20px 0}
.day .d b{font:800 46px/1 'Playfair Display',Georgia,serif}
.day .d span{font:800 11px/1.2 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#7a5400}
.day .a{padding:10px 20px 4px;font:700 20px/1.2 'Playfair Display',Georgia,serif}
.day .s{padding:0 20px 20px;font-style:italic;opacity:.8}
.day:after{content:"";position:absolute;inset:6px;border:1.5px solid rgba(22,36,27,.6);border-radius:6px;pointer-events:none}
/* teasers */
.tz{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:40px}
.tz a{position:relative;display:flex;align-items:flex-end;min-height:320px;border-radius:14px;overflow:hidden;text-decoration:none;background:#000 center/cover;border:1px solid rgba(180,126,0,.45)}
.tz a:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,19,12,.1),rgba(6,19,12,.9));transition:.25s}
.tz a:hover:before{background:linear-gradient(180deg,rgba(6,19,12,.25),rgba(6,19,12,.95))}
.tz div{position:relative;padding:24px}.tz h3{margin-bottom:.2em}.tz p{margin:0;opacity:.85;font-size:15px}
.tz .go{display:inline-block;margin-top:10px;color:var(--ouro2);font:700 12px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase}
.blur{filter:blur(9px) brightness(.55);transform:scale(1.08)}
/* suspense */
.sus{min-height:80vh;display:flex;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden;padding:150px 22px 90px}
.sus .bg{position:absolute;inset:0;background:var(--bg) center/cover;filter:blur(14px) brightness(.4);transform:scale(1.1)}
.sus .in{position:relative;max-width:620px}
.sus .lock{width:64px;height:64px;border:1.5px solid var(--ouro);border-radius:50%;margin:0 auto 26px;display:flex;align-items:center;justify-content:center;font-size:26px;color:var(--ouro2)}
.fnd{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;margin-top:40px}
.fnd .card{padding:32px 28px}
.fnd .av{width:84px;height:84px;border-radius:50%;border:1.5px solid var(--ouro);background:rgba(180,126,0,.14);display:flex;align-items:center;justify-content:center;font:700 28px/1 'Playfair Display',serif;color:var(--ouro2);margin-bottom:18px}
.fnd .role{font:700 12px/1.4 Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--ouro2);margin-bottom:12px}
.team{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:20px;margin-top:40px}
.team .m{border:1.5px dashed rgba(217,166,46,.5);border-radius:14px;padding:46px 20px;text-align:center;opacity:.8}
.team .m i{display:block;width:70px;height:70px;border-radius:50%;background:rgba(234,231,218,.08);margin:0 auto 14px}
.tl{border-left:2px solid rgba(180,126,0,.6);margin:34px 0 0 8px;padding-left:28px}
.tl .t{position:relative;margin-bottom:34px}.tl .t:before{content:"";position:absolute;left:-37px;top:7px;width:14px;height:14px;border-radius:50%;background:var(--ouro);border:3px solid var(--escuro)}
.draft{border:1px dashed rgba(217,166,46,.6);border-radius:10px;padding:14px 18px;font-size:14.5px;background:rgba(180,126,0,.1);margin-bottom:34px}
.cta{background:linear-gradient(135deg,#0D5B1D,#113325);text-align:center;border-top:1px solid rgba(180,126,0,.5);border-bottom:1px solid rgba(180,126,0,.5)}
.cta .row{justify-content:center}
footer{background:var(--carvao);padding:64px 0 34px;font-size:15px}
.ft{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:36px}
.ft h4{font:700 12px/1 Inter,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--ouro2);margin:0 0 16px}
.ft ul{list-style:none;margin:0;padding:0}.ft li{margin-bottom:9px}.ft a{text-decoration:none;opacity:.85}.ft a:hover{color:var(--ouro2);opacity:1}
.ft img{height:56px;margin-bottom:14px}
.copy{border-top:1px solid rgba(234,231,218,.12);margin-top:40px;padding-top:22px;font-size:13px;opacity:.6;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
@media(max-width:760px){.ft{grid-template-columns:1fr}}
.rv{opacity:0;transform:translateY(22px);transition:opacity .8s,transform .8s}.rv.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.rv{opacity:1;transform:none;transition:none}html{scroll-behavior:auto}.hero video{display:none}}
'''

JS = r'''
(function(){
var h=document.querySelector('header.nav');
function sc(){h.classList.toggle('sol',window.scrollY>40||document.body.hasAttribute('data-sol'))}
sc();addEventListener('scroll',sc,{passive:true});
var b=document.querySelector('.burger');if(b)b.addEventListener('click',function(){var o=h.classList.toggle('open');b.setAttribute('aria-expanded',o)});
document.querySelectorAll('.menu a').forEach(function(a){a.addEventListener('click',function(){h.classList.remove('open')})});
var v=document.querySelector('.hero video');
if(v){var small=innerWidth<720;v.src=small?v.dataset.sm:v.dataset.lg;var p=v.play();if(p&&p.catch)p.catch(function(){})}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});document.querySelectorAll('.rv').forEach(function(e){io.observe(e)})}else{document.querySelectorAll('.rv').forEach(function(e){e.classList.add('in')})}
})();
'''

NAV = [('/', 'Início', 'home'), ('/historia/', 'História', 'historia'), ('/equipe/', 'Equipe', 'equipe'),
       ('/cardapio/', 'Cardápio', 'cardapio'), ('/fotos/', 'Fotos', 'fotos'), ('/reservas/', 'Reservas', 'reservas'),
       ('/painel/', 'Gestão', 'painel')]

def nav(cur):
    def li(h, t, k):
        cls = 'l' + (' on' if k == cur else '') + (' int' if k == 'painel' else '')
        lab = t + (' · interno' if k == 'painel' else '')
        return f'<li><a class="{cls}" href="{h}">{lab}</a></li>'
    L = ''.join(li(*x) for x in NAV[:3]); R = ''.join(li(*x) for x in NAV[3:])
    menu = ''.join(f'<a href="{h}">{t}{" (acesso interno)" if k=="painel" else ""}</a>' for h, t, k in NAV)
    return f'''<header class="nav"><div class="nv"><ul>{L}</ul><a class="logo" href="/" aria-label="Das Stammhaus Pub"><img src="/assets/site/logo.png" alt="Das Stammhaus Pub"></a><ul class="r">{R}</ul>
<button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button></div><nav class="menu">{menu}</nav></header>'''

FOOT = '''<footer><div class="wrap"><div class="ft">
<div><img src="/assets/site/logo.png" alt="Das Stammhaus Pub"><p class="mut">Pub de estilo europeu em um casarão histórico.<br>Canoinhas · Santa Catarina</p><p style="font-style:italic;font-family:'Playfair Display',serif;color:#d9a62e">O que é bom resiste ao tempo.</p></div>
<div><h4>A casa</h4><ul><li><a href="/historia/">História e fundadores</a></li><li><a href="/equipe/">Equipe</a></li><li><a href="/cardapio/">Cardápio</a></li><li><a href="/fotos/">Fotos</a></li></ul></div>
<div><h4>Visite</h4><ul><li><a href="/reservas/">Reservar minha noite</a></li><li><a href="/convidados/">Já tenho convite · confirmar presença</a></li><li><a href="/painel/">Gestão (acesso interno)</a></li></ul></div>
</div><div class="copy"><span>© 2026 Das Stammhaus Pub · Canoinhas, SC</span><span>Imagens ilustrativas de banco de imagens (Pexels) · fotos reais em breve</span></div></div></footer>'''

def page(cur, title, desc, body, hero_sol=True):
    return f'''<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:type" content="website"><meta property="og:image" content="{PX(5858067,1200)}">
<meta name="theme-color" content="#113325">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site/site.css"></head><body{'' if cur=='home' else ' data-sol'}>
{nav(cur)}
{body}
{FOOT}
<script src="/assets/site/site.js"></script></body></html>'''

def ph(i, w=1200): return f"background-image:url('{PX(i,w)}')"

HOME = f'''
<section class="hero"><img class="poster" alt="" src="{PX(5858067,1600)}">
<video muted loop playsinline autoplay preload="metadata" poster="{PX(5858067,1600)}" data-lg="{VID('4752641/4752641-hd_1280_720_25fps')}" data-sm="{VID('4752641/4752641-sd_960_540_25fps')}"></video>
<div class="in"><a class="sel" href="#inauguracao">Semana de Inauguração · 18 a 21 de novembro</a>
<h1>O que é bom <em>resiste ao tempo.</em></h1>
<p class="lead">Um pub de estilo europeu clássico em um casarão histórico de Canoinhas. Chopp de qualidade, música ao vivo e conversa sem pressa.</p>
<div class="row"><a class="btn" href="/reservas/">Reservar minha noite</a><a class="btn o" href="#casa">Conhecer a casa</a></div></div>
<span class="scroll">role</span></section>

<section class="center rv"><div class="wrap"><span class="eb">Nossa proposta</span>
<p class="quote">Há lugares que nascem para a pressa. Outros, para permanecer.<small>Das Stammhaus Pub</small></p></div></section>

<section class="alt" id="proposta"><div class="wrap">
<div class="center rv"><span class="eb">Proposta de valor</span><h2>Um refúgio com curadoria em cada detalhe</h2>
<p class="lead">Canoinhas pedia um lugar para quem busca substância e conforto, sem precisar viajar para outra cidade. Cuidamos do que realmente importa: o chopp, o som, a casa e o tempo da conversa.</p></div>
<div class="cards rv">
<div class="card"><span class="n">01</span><h3>Chopp bem tirado</h3><p>Chopp gelado, no ponto, em parceria exclusiva com a Heineken, e bebidas bem servidas.</p></div>
<div class="card"><span class="n">02</span><h3>Música de qualidade</h3><p>Som profissional em volume que convida à conversa. Rock, blues, MPB e pop rock, sem gritar para ser ouvido.</p></div>
<div class="card"><span class="n">03</span><h3>Gastronomia descomplicada</h3><p>Menu enxuto e caprichado, pensado para acompanhar a noite. Os detalhes seguem em segredo até a inauguração.</p></div>
<div class="card"><span class="n">04</span><h3>Casarão com história</h3><p>Dois andares de arquitetura preservada, madeira nobre e a herança madeireira da região em cada canto.</p></div>
</div></div></section>

<section id="casa"><div class="wrap split">
<div class="ph rv" style="{ph(38949607)}" role="img" aria-label="Casarão histórico de madeira (imagem ilustrativa)"></div>
<div class="rv"><span class="eb">O casarão</span><h2>Dois andares de herança madeireira</h2>
<p class="lead">O Das Stammhaus nasce de um casarão, de uma cidade e de gente que gosta de coisa bem feita. A restauração preserva a arquitetura e a força da cultura madeireira e da imigração europeia que formaram Canoinhas.</p>
<p class="mut">Madeira nobre, marcenaria fina e precisão histórica: sem exageros e sem caricaturas.</p>
<a class="btn o" href="/historia/">Nossa história</a></div></div></section>

<section class="alt"><div class="wrap split rev">
<div class="ph rv" style="{ph(5984690)}" role="img" aria-label="Parreiral (imagem ilustrativa)"></div>
<div class="rv"><span class="eb">Kaffee · Garten · Pub</span><h2>Da tarde à noite, sob o parreiral</h2>
<p class="lead">Um jardim com parreiral de mais de 50 anos, lounge com firepit, sofás e palco acústico, ligado ao casarão. À tarde, o Kaffee/Garten com cafés e encontros leves. À noite, o Pub.</p>
<p class="mut">Horários de funcionamento serão divulgados em breve.</p></div></div></section>

<section class="parc rv"><div class="wrap"><span class="eb">Parceria</span><h2>Chopp Heineken, com exclusividade</h2>
<p class="lead" style="margin:0 auto">O Das Stammhaus Pub conta com parceria exclusiva com a Heineken: o chopp que você toma aqui é Heineken, tirado do jeito certo.</p></div></section>

<section><div class="wrap split">
<div class="rv"><span class="eb">Para quem recebemos</span><h2>Para quem valoriza uma boa conversa</h2>
<p class="lead">Casais, famílias jovens e grupos de amigos que querem chopp gelado, boa música e tempo para conversar. Ouvimos 147 moradores de Canoinhas e a música de qualidade foi a prioridade número um.</p>
<p class="mut">Simples, mas caprichoso: um lugar onde dá para chegar e se sentir em casa.</p></div>
<div class="ph rv" style="{ph(1089930)}" role="img" aria-label="Brinde com chopp (imagem ilustrativa)"></div></div></section>

<section class="alt" id="inauguracao"><div class="wrap"><div class="center rv"><span class="eb">Semana de Inauguração</span><h2>Quatro noites de música ao vivo</h2>
<p class="lead">De 18 a 21 de novembro, a casa abre as portas. As noites já estão com vagas limitadas: reserve a sua.</p></div>
<div class="days rv">
<div class="day"><div class="d"><b>18</b><span>Quarta<br>Nov</span></div><div class="a">Lonesome Capitain</div><div class="s">Country &amp; Folk</div></div>
<div class="day"><div class="d"><b>19</b><span>Quinta<br>Nov</span></div><div class="a">Os Bauretz</div><div class="s">Soul, Disco &amp; MPB</div></div>
<div class="day"><div class="d"><b>20</b><span>Sexta<br>Nov</span></div><div class="a">Hardways</div><div class="s">Classic Rock</div></div>
<div class="day"><div class="d"><b>21</b><span>Sábado<br>Nov</span></div><div class="a">Rodrigo Seidel e banda</div><div class="s">Pop Rock</div></div>
</div>
<div class="center rv" style="margin-top:38px"><div class="row" style="justify-content:center"><a class="btn" href="/reservas/">Reservar minha noite</a><a class="btn o" href="/convidados/">Tenho convite: confirmar presença</a></div></div></div></section>

<section><div class="wrap"><div class="center rv"><span class="eb">Em breve</span><h2>O que vem por aí</h2></div>
<div class="tz rv">
<a href="/cardapio/" style="{ph(5858067,900)}"><div><h3>Cardápio</h3><p>Vamos manter o suspense.</p><span class="go">Ver →</span></div></a>
<a href="/fotos/" style="{ph(9315792,900)}"><div><h3>Fotos</h3><p>As melhores imagens da casa, em breve.</p><span class="go">Ver →</span></div></a>
<a href="/equipe/" style="{ph(34638198,900)}"><div><h3>Equipe</h3><p>Quem faz a casa acontecer.</p><span class="go">Ver →</span></div></a>
</div></div></section>

<section class="cta rv"><div class="wrap"><span class="eb">Honre suas raízes</span><h2>Embriague-se aqui.</h2>
<p class="lead" style="margin:0 auto 28px">Garanta o seu lugar na Semana de Inauguração do Das Stammhaus Pub.</p>
<div class="row"><a class="btn" href="/reservas/">Reservar minha noite</a></div></div></section>
'''

HIST = f'''
<section class="pagehero" style="--bg:url('{PX(38949607,1600)}')"><div class="wrap"><span class="eb">História</span><h1>Raízes que resistem ao tempo</h1>
<p class="lead">A história de um casarão, de uma cidade e de gente que gosta de coisa bem feita.</p></div></section>
<section><div class="wrap" style="max-width:860px">
<div class="draft rv"><b>Texto em construção.</b> Este é um primeiro resumo, que vamos lapidar com datas, nomes e fatos confirmados sobre o casarão e a região.</div>
<div class="tl rv">
<div class="t"><span class="eb">A cidade</span><h3>Canoinhas e a força da madeira</h3><p>Canoinhas, no Planalto Norte de Santa Catarina, tem a história ligada à cultura madeireira e à chegada de imigrantes europeus. É dessa herança que o Das Stammhaus tira a madeira nobre, a marcenaria fina e o respeito pelo que dura.</p></div>
<div class="t"><span class="eb">O casarão</span><h3>Dois andares de arquitetura preservada</h3><p>O pub ocupa um casarão histórico de dois andares, com jardim e um parreiral de mais de 50 anos. A restauração mantém o caráter da casa e comunica permanência.</p></div>
<div class="t"><span class="eb">A ideia</span><h3>Um lugar para ficar</h3><p>Percebemos que a cidade tinha poucas opções de lazer com substância para o público maduro, que muitas vezes viaja para outras cidades ou deixa de sair. Quisemos um refúgio onde dá para conversar, ouvir boa música e beber bem, sem pressa.</p></div>
<div class="t"><span class="eb">A curadoria</span><h3>O que é bom resiste ao tempo</h3><p>Do chopp à acústica, da seleção musical ao menu enxuto: cada detalhe passa por curadoria. Daí o nome, Das Stammhaus, a casa-raiz, o lugar de encontro de quem se reconhece.</p></div>
</div>
<p class="quote rv" style="margin-top:50px">Honre suas raízes, embriague-se aqui.<small>Nosso brinde</small></p>
</div></section>
<section class="alt"><div class="wrap"><div class="center rv"><span class="eb">Os fundadores</span><h2>Quem está por trás da casa</h2></div>
<div class="fnd rv">
<div class="card"><div class="av">FS</div><div class="role">Co-fundador</div><h3>Felipe Schadeck Fiorentin</h3><p>Engenheiro agrônomo com carreira em agricultura digital. Traz rigor de gestão, análise de dados e processos para uma casa que quer ser impecável e duradoura.</p></div>
<div class="card"><div class="av">MR</div><div class="role">Co-fundadora</div><h3>Mirian Regina Strack Schadeck</h3><p>Advogada e perita criminal da Polícia Científica. Cuida de gestão financeira e conformidade e da cultura de hospitalidade e do relacionamento com o público.</p></div>
</div>
<p class="mut center rv" style="margin-top:26px">Biografias em construção: vamos contar essa parte com mais calma, e com fotos.</p></div></section>
<section class="cta rv"><div class="wrap"><h2>Venha fazer parte dessa história.</h2><div class="row"><a class="btn" href="/reservas/">Reservar minha noite</a></div></div></section>
'''

EQ = f'''
<section class="pagehero" style="--bg:url('{PX(34638198,1600)}')"><div class="wrap"><span class="eb">Equipe</span><h1>Quem faz a casa acontecer</h1>
<p class="lead">Atendimento atento, conversa de verdade e capricho em cada chopp.</p></div></section>
<section><div class="wrap center"><div class="draft rv" style="max-width:620px;margin:0 auto 10px"><b>Em construção.</b> Vamos apresentar a nossa equipe aqui, em breve.</div>
<div class="team rv"><div class="m"><i></i>Em breve</div><div class="m"><i></i>Em breve</div><div class="m"><i></i>Em breve</div><div class="m"><i></i>Em breve</div></div>
<p class="lead rv" style="margin:44px auto 0">Enquanto isso, conheça <a href="/historia/" style="color:#d9a62e">a história da casa e dos fundadores</a>.</p></div></section>
'''

def sus(cur_img, title, text, icon='✦'):
    return f'''<section class="sus" style="--bg:url('{PX(cur_img,1600)}')"><div class="bg"></div><div class="in rv"><div class="lock">{icon}</div>
<h1 style="font-size:clamp(34px,5vw,56px)">{title}</h1><p class="lead">{text}</p><div class="row" style="justify-content:center;margin-top:26px"><a class="btn" href="/reservas/">Reservar minha noite</a><a class="btn o" href="/">Voltar ao início</a></div></div></section>'''

CARD = sus(5530258, 'Cardápio', 'Vamos compartilhar o cardápio depois da inauguração. Por ora, vamos manter o suspense para surpreender a todos 😉', '🍺')
FOTOS = sus(15937644, 'Fotos', 'As fotos da casa também ficam para depois da inauguração. Estamos preparando as melhores imagens e, por ora, mantemos o suspense 😉', '✦')

os.makedirs(OUT + '/assets/site', exist_ok=True)
open(OUT + '/assets/site/site.css', 'w').write(CSS)
open(OUT + '/assets/site/site.js', 'w').write(JS)
shutil.copy(os.path.join(HERE, '..', 'src', 'logo.png'), OUT + '/assets/site/logo.png')
pages = {
 'index.html': page('home', 'Das Stammhaus Pub · Canoinhas, SC', 'Pub de estilo europeu em um casarão histórico de Canoinhas-SC. Chopp de qualidade, música ao vivo e conversa sem pressa. Semana de inauguração: 18 a 21 de novembro.', HOME),
 'historia/index.html': page('historia', 'História · Das Stammhaus Pub', 'A história do casarão, da cidade e dos fundadores do Das Stammhaus Pub, em Canoinhas-SC.', HIST),
 'equipe/index.html': page('equipe', 'Equipe · Das Stammhaus Pub', 'Equipe do Das Stammhaus Pub: em construção.', EQ),
 'cardapio/index.html': page('cardapio', 'Cardápio · Das Stammhaus Pub', 'O cardápio do Das Stammhaus Pub será revelado depois da inauguração.', CARD),
 'fotos/index.html': page('fotos', 'Fotos · Das Stammhaus Pub', 'As fotos do Das Stammhaus Pub serão reveladas depois da inauguração.', FOTOS),
}
for p, h in pages.items():
    os.makedirs(os.path.dirname(os.path.join(OUT, p)) or OUT, exist_ok=True)
    open(os.path.join(OUT, p), 'w', encoding='utf-8').write(h)
print('ok', list(pages))
