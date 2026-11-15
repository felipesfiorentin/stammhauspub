"""Gera os dois projetos do Apps Script a partir de src/.
 uso: python3 build.py [--sheet-id ID] [--out DIR]
  DIR/convidados/{Code.gs,Index.html,Painel.html,appsscript.json}
  DIR/publico/{Code.gs,Index.html,appsscript.json}
 Sem --sheet-id o publico sai com o marcador __SHEET_ID__ (versão do repositório)."""
import base64, os, sys, shutil
H = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]
sid = a[a.index('--sheet-id') + 1] if '--sheet-id' in a else '__SHEET_ID__'
out = a[a.index('--out') + 1] if '--out' in a else os.path.join(H, '..', 'apps-script')
IMGBASE = 'https://stammhauspub.github.io/assets/cards/'
def rd(n, m='r'): return open(os.path.join(H, n), m, **({} if 'b' in m else {'encoding': 'utf-8'})).read()
def uri(p, m): return 'data:%s;base64,%s' % (m, base64.b64encode(rd(p, 'rb')).decode())
logo = base64.b64encode(rd('logo.png', 'rb')).decode()

# ---- convidados ----
t = rd('Index.template.html').replace('__LOGO__', logo)
for d in (18, 19, 20, 21):
    t = (t.replace('__PL%d__' % d, uri('cards/ph%dL.jpg' % d, 'image/jpeg')).replace('__PR%d__' % d, uri('cards/ph%dR.jpg' % d, 'image/jpeg'))
          .replace('__LOGO%d__' % d, uri('cards/logo%d.png' % d, 'image/png')))
t = t.replace('__PW20__', uri('cards/ph20W.jpg', 'image/jpeg'))
HDR_G = "/* =====================================================================\n * Das Stammhaus Pub — Confirmação de presença dos CONVIDADOS + métricas. ARQUIVO ÚNICO (Code.gs).\n * Ordem: Comum (núcleo/lotação) · Busca · Convidados · Métricas · Preparação.\n * ===================================================================== */\n"
g = HDR_G + rd('Comum.src.gs') + '\n' + rd('Busca.src.gs') + '\n' + rd('Code.src.gs') + '\n' + rd('Setup.src.gs') + '\n' + rd('Auth.src.gs') + '\n' + rd('Gestao.src.gs')
# ---- público ----
HDR_P = "/* =====================================================================\n * Das Stammhaus Pub — RESERVAS DO PÚBLICO. ARQUIVO ÚNICO (Code.gs). Projeto separado do dos convidados.\n * ===================================================================== */\n"
p = HDR_P + rd('Comum.src.gs') + '\n' + rd('Publico.src.gs').replace("'__SHEET_ID__'", "'%s'" % sid) + '\n' + rd('Whats.src.gs')
pt = rd('Publico.template.html').replace('__LOGO__', logo).replace('__IMGBASE__', IMGBASE).replace('__LOGOD__', base64.b64encode(rd('logo_dark.png','rb')).decode())
for d, name, txt in (('convidados', 'Code.gs', g), ('convidados', 'Index.html', t), ('convidados', 'Painel.html', rd('Painel.html').replace('__LOGOD__', base64.b64encode(rd('logo_dark.png','rb')).decode()).replace('__LOGOL__', base64.b64encode(rd('logo_login.png','rb')).decode())),
                     ('publico', 'Code.gs', p), ('publico', 'Index.html', pt)):
    os.makedirs(os.path.join(out, d), exist_ok=True)
    open(os.path.join(out, d, name), 'w', encoding='utf-8').write(txt)
mf = rd('appsscript.json') if os.path.exists(os.path.join(H, 'appsscript.json')) else open('/home/claude/stammhaus/appsscript.json').read()
for d in ('convidados', 'publico'): open(os.path.join(out, d, 'appsscript.json'), 'w').write(mf)
print({k: len(v) // 1024 for k, v in (('g.gs', g), ('g.html', t), ('p.gs', p), ('p.html', pt))}, 'KB')
