#!/usr/bin/env python3
"""Recorta e harmoniza as fotos dos fundadores e prepara o casarão e os logos. Uso: process_assets.py <pasta com originais> <pasta de saída>"""
import sys, glob, numpy as np
from PIL import Image, ImageOps, ImageFilter
D, O = sys.argv[1], sys.argv[2]
def op(k): return ImageOps.exif_transpose(Image.open(glob.glob(f'{D}/*{k}*')[0])).convert('RGB')

def hsv(a):
    return np.array(Image.fromarray(a).convert('HSV')).astype(np.float32)
def from_hsv(h):
    return np.array(Image.fromarray(np.clip(h,0,255).astype(np.uint8),'HSV').convert('RGB'))

def grade(im, tl=104, ts=0.36):
    """normaliza luminosidade média e saturação média, depois aplica o mesmo split-tone (sombras verde-floresta, luzes off-white quente)"""
    a = np.asarray(im).astype(np.float32)
    # luminosidade: ajuste por gamma para atingir a média alvo (nos tons médios)
    lum = (0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2])/255
    m = float(np.clip(lum.mean(),0.05,0.95)); g = np.log(tl/255)/np.log(m)
    a = 255*np.power(np.clip(a/255,0,1), g)
    # saturação média -> alvo
    h = hsv(a.astype(np.uint8)); s = h[...,1]/255
    k = ts/max(float(s.mean()),1e-3); h[...,1] = np.clip(h[...,1]*min(max(k,0.45),1.35),0,255)
    a = from_hsv(h).astype(np.float32)/255
    # split-tone
    l = (0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2])[...,None]
    sh = np.array([0.04,0.13,0.09]); hi = np.array([0.96,0.92,0.84])
    tone = sh*(1-l)+hi*l
    a = a*0.82 + (a*0.35+tone*0.65)*0.18
    # curva suave de contraste
    a = np.clip(a,0,1); a = a*a*(3-2*a)*0.35 + a*0.65
    return Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8))

def vig(im, k, cy=0.42):
    a=np.asarray(im).astype(np.float32); h,w=a.shape[:2]
    y,x=np.mgrid[0:h,0:w]; d=np.sqrt(((x-w/2)/(w*0.62))**2+((y-h*cy)/(h*0.62))**2)
    m=1-k*np.clip(d,0,1.3)**2.2; return Image.fromarray(np.clip(a*m[...,None],0,255).astype(np.uint8))

def crop(im, box):  # box em frações (x0,y0,x1,y1)
    w,h = im.size; return im.crop((int(box[0]*w),int(box[1]*h),int(box[2]*w),int(box[3]*h)))

def save(im, name, w):
    im = im.resize((w, int(im.height*w/im.width)), Image.LANCZOS)
    im.save(f'{O}/{name}', quality=84, optimize=True, progressive=True); print(name, im.size)

# Felipe: 3266x4899  -> retrato 4:5 (cabeça e tronco)
f = op('3b457783'); f = crop(f,(0,0,1,0.8333)) ; f = ImageOps.fit(f,(1000,1250),centering=(0.5,0.18))
# Regina: 1800x4000 -> 4:5 centrado no rosto
r = op('1315dfbc'); r = crop(r,(0,0.075,1,0.075+ (1800*1.25)/4000)); r = ImageOps.fit(r,(1000,1250),centering=(0.45,0.2))
# tons compartilhados: mesma luminosidade/saturação alvo
def lum(im,b):
    a=np.asarray(im).astype(np.float32); h,w=a.shape[:2]; p=a[int(b[1]*h):int(b[3]*h),int(b[0]*w):int(b[2]*w)]
    return float((0.299*p[...,0]+0.587*p[...,1]+0.114*p[...,2]).mean())
def facefit(im,b,target=118):
    """gamma que leva a luminância média do rosto ao alvo (mesmo alvo para os dois retratos)"""
    a=np.asarray(im).astype(np.float32)/255; lo,hi=0.4,2.5
    for _ in range(30):
        g=(lo+hi)/2; v=lum(Image.fromarray((np.power(a,g)*255).astype(np.uint8)),b)
        lo,hi=(g,hi) if v>target else (lo,g)
    return Image.fromarray((np.power(a,g)*255).astype(np.uint8))
FACE_F,FACE_R=(.4,.22,.62,.42),(.38,.22,.62,.38)
fg, rg = facefit(vig(grade(f,tl=100),0.28),FACE_F), facefit(vig(grade(r,tl=100),0.3),FACE_R)
# alinhamento final: iguala média dos canais (equilíbrio de cor) ao ponto médio entre as duas
mf, mr = np.asarray(fg).reshape(-1,3).mean(0), np.asarray(rg).reshape(-1,3).mean(0); mt = (mf+mr)/2
def bal(im,m):
    g=mt/m; g=g/g.mean(); a=np.asarray(im).astype(np.float32)*g; return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
fg, rg = bal(fg,mf), bal(rg,mr)
save(fg,'felipe.jpg',800); save(rg,'regina.jpg',800)
# casarão pré-obra: recorte retrato da fachada (sem a placa do vizinho à direita)
c = op('61450df6'); W,H = c.size
c = c.crop((int(0.06*W),int(0.19*H),int(0.76*W),int(0.19*H+ 0.70*W*1.25))); c = ImageOps.fit(c,(1000,1250))
save(c,'casarao-pre-obra.jpg',900)
# logos: 03 horizontal (nav) e 01 padrão (rodapé)
for k,n,w in [('fdceceb7','logo-horizontal.png',900),('65c8c378','logo-padrao.png',900)]:
    l = Image.open(glob.glob(f'{D}/*{k}*')[0]).convert('RGBA'); bb = l.getbbox(); l = l.crop(bb); l = l.resize((w,int(l.height*w/l.width)),Image.LANCZOS); l.save(f'{O}/{n}',optimize=True); print(n,l.size)

a = ImageOps.exif_transpose(Image.open(glob.glob(f'{D}/*15b4920d*')[0])).convert('RGB'); save(a,'canoinhas-antiga.jpg',1000)
