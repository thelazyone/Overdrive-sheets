import json, math
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader
root=Path.cwd();data=json.loads((root/'tmp/pdfs/opulence-manual-data.json').read_text(encoding='utf-8'));ship=data['ship']
for key,name in [('Body','TitilliumWeb-Regular.ttf'),('Bold','TitilliumWeb-Bold.ttf')]: pdfmetrics.registerFont(TTFont(key,str(root/'fonts'/name)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold')
out=root/'output/pdf/opulence-manual-draft.pdf'; c=canvas.Canvas(str(out),pagesize=A4); W,H=A4;M=30;gap=12;cw=(W-2*M-2*gap)/3
ink=HexColor('#17232b');muted=HexColor('#57646a');line=HexColor('#bbc4c7');pale=HexColor('#eef1f2')
def text(s,x,y,size=10,font='Body',color=ink):
 c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,str(s))
def para(s,x,y,w,size=9,leading=11):
 p=Paragraph(s,ParagraphStyle('p',fontName='Body',fontSize=size,leading=leading,textColor=ink));_,h=p.wrap(w,1000);p.drawOn(c,x,y-h);return y-h

def page(title,num,subtitle):
 text('FULL SPECTRUM OVERDRIVE / DRAFT SHIP REFERENCE',M,H-26,8,'Bold',muted)
 text(title,M,H-53,22,'Bold');para(subtitle,M,H-64,W-2*M,9,12)
 c.setStrokeColor(line);c.line(M,33,W-M,33);text('OPULENCE / Current authored profiles - TBD values await design',M,20,8,color=muted);text(f'{num} / 2',W-M-23,20,8)
 return H-99

def group(title,x,y):
 c.setFillColor(ink);c.rect(x,y-20,cw,20,fill=1,stroke=0);text(title,x+6,y-14,10,'Bold',white);return y-27

def req(r):
 return ' + '.join(([' or '.join(t+' Trait' for t in r['traits'])] if r['traits'] else [])+r['upgrades']) or 'Free'

def arc(s,x,y,label):
 r=10;c.setStrokeColor(ink);c.setFillColor(ink);c.setLineWidth(.7)
 a=s['arc-start'];b=s['arc-end']
 if a==b or b-a==8:c.circle(x,y,r,stroke=0,fill=1)
 else:
  a0=(90+a*45)%360;a1=(90+b*45)%360
  if a1<=a0:a1+=360
  p=c.beginPath();p.moveTo(x,y)
  for i in range(41):
   ang=math.radians(a0+(a1-a0)*i/40);p.lineTo(x+r*math.cos(ang),y-r*math.sin(ang))
  p.close();c.drawPath(p,stroke=0,fill=1)
 c.circle(x,y,r+1.5,stroke=1,fill=0);text(label,x-12,y-22,6.8)

def tokens(x,y,crew,energy):
 c.setStrokeColor(HexColor('#387644'));c.setFillColor(HexColor('#73ad79'));c.setLineWidth(.45)
 for i in range(crew):c.rect(x+i*7,y-5,5,5,stroke=1,fill=1)
 x+=crew*7
 c.setStrokeColor(HexColor('#a48718'));c.setFillColor(HexColor('#f1cc4d'))
 for i in range(energy):c.circle(x+2.5+i*7,y-2.5,2.5,stroke=1,fill=1)

def attack(s,x,y):
 c.setStrokeColor(ink);c.setFillColor(white);c.setLineWidth(.7)
 p=c.beginPath();p.moveTo(x,y);p.lineTo(x+47,y);p.lineTo(x+54,y-7.5);p.lineTo(x+47,y-15);p.lineTo(x,y-15);p.close();c.drawPath(p,stroke=1,fill=1);c.line(x+17,y,x+17,y-15)
 c.setFillColor(ink);c.setFont('Bold',9);c.drawCentredString(x+8.5,y-10.7,str(s.get('damage','?')));c.drawCentredString(x+33,y-10.7,str(s.get('range','?')))

def slothead(title,x,y,slot=True):
 c.setFillColor(pale);c.rect(x,y-17,cw,17,stroke=0,fill=1)
 text(title,x+4,y-12,9,'Bold')
 c.setFillColor(muted);c.setFont('Body',6.5);c.drawRightString(x+cw-4,y-12,'MULTIPLE CHOICES' if slot else 'FIXED')
 return y-20

def card(opt,x,y,w=None,arcs=None,fixed=False):
 if w is None:w=cw
 p=opt['profile'];pending='pending' in p.get('rules','').lower();xx=x+4;ww=w-8
 if fixed:y=slothead(opt['name'],x,y,False)
 else:
  requirement=req(opt['requirements'])
  name=opt['name'];nw=pdfmetrics.stringWidth(name,'Bold',8.5)
  rw=pdfmetrics.stringWidth(requirement,'Body',7.5) if requirement!='Free' else 0
  if nw+rw+8<=ww:
   text(name,xx,y-8.5,8.5,'Bold')
   if rw:
    c.setFillColor(muted);c.setFont('Body',7.5);c.drawRightString(x+w-4,y-8.5,requirement)
   y-=10
  else:
   y=para('<b>'+escape(name)+'</b>',xx,y,ww,8.5,10)
   r=Paragraph(escape(requirement),ParagraphStyle('req',fontName='Body',fontSize=7.5,leading=9,textColor=muted,alignment=2))
   _,h=r.wrap(ww,100);r.drawOn(c,xx,y-h);y-=h+2
 hits=[f for k,f in [('hull','hull_icon.png'),('electronics','electric_icon.png'),('life_support','life_support_icon.png')] if p.get(k)]
 reserve=max(12,len(hits)*10+4)
 areas=p.get('areas',[])
 if pending:areas=[{'cost':{'crew':1,'energy':1},'description':'?','shoot':{} } ] if p.get('weapon') else [{'cost':{'crew':1,'energy':1},'description':'?'}]
 passive=p.get('rules','') if not pending else ''
 for a in areas:
  cost=a.get('cost',{});crew=cost.get('crew',0);energy=cost.get('energy',0);n=crew+energy
  tokens(xx,y-4,crew,energy);offset=n*7+4 if n else 0
  if 'shoot' in a:
   attack(a['shoot'],xx+offset,y)
   desc='' if pending else a.get('description','')
   if a['shoot']:
    c.saveState();c.translate(xx+offset+65,y-7.5);c.scale(.58,.58);arc(a['shoot'],0,0,'');c.restoreState()
    if desc:para(escape(desc),xx+offset+77,y-2,ww-offset-77-reserve,7.5,8)
   y-=16
  else:
   effect=a.get('description') or a.get('name') or ''
   if passive:effect=passive+'; '+effect;passive=''
   y=para(escape(effect),xx+offset,y,ww-offset-reserve,8,9)-1
 if p.get('speed_slots'):y=para('Speed / turn: '+escape('; '.join(a['speed']+' / '+a['rotation'] for a in p['speed_slots'])),xx,y,ww-reserve,7.5,9)-1
 if not areas and not p.get('rules'):y=para('Empty system',xx,y,ww,8,9)-1
 if passive:y=para(escape(passive),xx,y,ww-reserve,8,9)-1
 if hits:
  width=len(hits)*10+3;right=x+w-4;bottom=y+1
  for i,f in enumerate(hits):c.drawImage(str(root/'tmp/pdfs'/('black_'+f)),right-width+2+i*10,bottom+1,7,7,mask='auto')
 else:
  c.setFillColor(muted);c.setFont('Body',7);c.drawRightString(x+w-4,y+2,'?')
 y-=1
 c.setStrokeColor(line);c.setLineWidth(.3);c.line(x,y,x+w,y)
 assert y>42,(opt['name'],y)
 return y-2

def get(side,label):return next(r['options'] for r in data['sections'][side] if r.get('label')==label)
bridge=get('left','Bridge');sides=get('left','Side');sensors=get('left','Sensors');weapons=get('core','Fore weapon');hab=get('right','Hab')
y=page('OPULENCE CLASS FREIGHTER',1,'[Ship description, role and background: author text to be supplied.]')
y=para('<b>Required upgrades:</b> '+escape(' + '.join(data['requirements']['upgrades']))+'<br/><b>Required traits:</b> '+escape(' or '.join(t+' Trait' for t in data['requirements']['traits']))+' (at least one).',M,y,W-2*M,11,15)-18
stats=[('SIZE','3'),('FAST REACTOR','Rating 6 / production 3'),('QUARTERS','Crew 3 / med bay 1'),('FRONT SHIELD TRACK','2 / 1 / 1 / 0'),('REAR SHIELD TRACK','2 / 1 / 1'),('CARGO CAPACITY','TBD')]
for i,(label,val) in enumerate(stats):
 x=M+i%3*(cw+gap);yy=y-i//3*45;c.setFillColor(pale);c.rect(x,yy-40,cw,40,fill=1,stroke=0);text(label,x+7,yy-13,8,'Bold');text(val,x+7,yy-30,10)
c.showPage()
y=H-30
c.setStrokeColor(line);c.line(M,33,W-M,33);text('OPULENCE / Systems & fittings',M,20,8,color=muted);text('2 / 2',W-M-23,20,8)
gap=18;cw=(W-2*M-gap)/2

def slotblock(title,options,x,y):
 top=y;y=slothead(title,x,y)
 for o in options:
  y=card(o,x+5,y,w=cw-5)
  c.setStrokeColor(line);c.setLineWidth(.3);c.line(x,y+2,x+5,y+2)
 c.setFillColor(HexColor('#aeb7bb'));c.rect(x,y+2,3,top-y-2,fill=1,stroke=0)
 return y-3

# Centre is a full-width section containing two independent object columns.
c.setFillColor(ink);c.rect(M,y-20,W-2*M,20,stroke=0,fill=1);text('CENTRE',M+6,y-14,10,'Bold',white);y-=27
centre_bottom=slotblock('Weapon (two slots)',weapons,M,y)
x=M+cw+gap;fixed_y=y
for ref in data['sections']['core']:
 if ref['kind']=='fixed':
  p=ref['system'];fixed_y=card({'name':p['name'],'profile':p,'requirements':{'traits':[],'upgrades':[]}},x,fixed_y,fixed=True)-5
para('Weapon (two slots): fore and aft mounts. Their current profiles share the shown arc; orientation awaits confirmation.',x+4,fixed_y-8,cw-8,8,10)
y=min(centre_bottom,fixed_y)-7
for col,(side,title) in enumerate([('left','LEFT'),('right','RIGHT')]):
 x=M+col*(cw+gap);yy=group(title,x,y)
 for ref in data['sections'][side]:
  if ref['kind']=='fixed':
   p=ref['system'];yy=card({'name':p['name'],'profile':p,'requirements':{'traits':[],'upgrades':[]}},x,yy,fixed=True)-3
  else:yy=slotblock(ref['label'],ref['options'],x,yy)
c.save()
r=PdfReader(out);body='\n'.join(p.extract_text() for p in r.pages)
for o in bridge+sides+sensors+weapons+hab:assert o['name'] in body,o['name']
assert len(r.pages)==2
print('Created 2 pages; all 28 options on page 2.')
