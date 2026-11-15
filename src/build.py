"""Gera apps-script/Index.html e apps-script/Code.gs a partir de src/. Uso: python3 src/build.py"""
import base64, os
S = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(S, '..', 'apps-script')
def uri(p, m): return 'data:%s;base64,%s' % (m, base64.b64encode(open(os.path.join(S, p), 'rb').read()).decode())
t = open(os.path.join(S, 'Index.template.html')).read()
t = t.replace('__LOGO__', base64.b64encode(open(os.path.join(S, 'logo.png'), 'rb').read()).decode())
for d in (18, 19, 20, 21):
    t = (t.replace('__PL%d__' % d, uri('cards/ph%dL.jpg' % d, 'image/jpeg'))
          .replace('__PR%d__' % d, uri('cards/ph%dR.jpg' % d, 'image/jpeg'))
          .replace('__LOGO%d__' % d, uri('cards/logo%d.png' % d, 'image/png')))
t = t.replace('__PW20__', uri('cards/ph20W.jpg', 'image/jpeg'))
open(os.path.join(A, 'Index.html'), 'w').write(t)
cg = os.path.join(A, 'Code.gs'); h = open(cg).read(); i = h.index('*/') + 2
open(cg, 'w').write(h[:i] + "\n" + open(os.path.join(S, 'Busca.src.gs')).read() + "\n" + open(os.path.join(S, 'Code.src.gs')).read())
print(len(t) // 1024, 'KB')
