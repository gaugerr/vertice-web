import asyncio,base64,json,math,re,subprocess,wave,textwrap
from pathlib import Path
import edge_tts
import numpy as np
O=Path("sheet-audio");O.mkdir(exist_ok=True)
base=Path("prior/Vertice-Planilha.mp4")
def probe(p):
 return json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(p)]))
# Boundaries are the exact frame counts from the approved recording.
scenes=[
(0,116,"Sou dev júnior em Erechim. Olha como eu organizo meu salário:",None),
(116,154,"quatro mil e quinhentos reais.","R$ 4.500,00"),
(154,230,"Começo pelo supermercado:",None),
(230,264,"trezentos e oitenta e seis reais e setenta centavos.","R$ 386,70"),
(264,336,"Depois, transporte:",None),
(336,370,"cento e oitenta reais.","R$ 180,00"),
(370,446,"Também anoto o cinema:",None),
(446,481,"setenta e dois reais.","R$ 72,00"),
(481,557,"E os gastos com farmácia:",None),
(557,592,"cinquenta e quatro reais e noventa centavos.","R$ 54,90"),
(592,643,"Agora, os orçamentos.",None),
(643,701,"Mercado: oitocentos reais.","Mercado: R$ 800,00"),
(701,759,"Transporte: trezentos e cinquenta.","Transporte: R$ 350,00"),
(759,817,"Lazer: trezentos reais.","Lazer: R$ 300,00"),
(817,940,"No dashboard, confiro minha receita: quatro mil e quinhentos.","Receita: R$ 4.500,00"),
(940,1019,"Despesas: seiscentos e noventa e três reais e sessenta centavos.","Despesas: R$ 693,60"),
(1019,1098,"Saldo previsto: três mil oitocentos e seis reais e quarenta centavos.","Saldo previsto: R$ 3.806,40"),
(1098,1198,"Assim, cada gasto fica claro e eu planejo o próximo passo.",None),
(1198,1333,"Vértice. Meu mês em equilíbrio.",None)
]
assert abs(float(probe(base)["format"]["duration"])-1333/30)<.05
async def synthesize():
 all_words=[]
 for i,(_,_,text,_) in enumerate(scenes):
  for attempt in range(3):
   try:
    words=[]
    with (O/f"voice-{i}.mp3").open("wb") as f:
     async for chunk in edge_tts.Communicate(text,"pt-BR-AntonioNeural",rate="+3%",boundary="WordBoundary").stream():
      if chunk["type"]=="audio":f.write(chunk["data"])
      elif chunk["type"]=="WordBoundary":words.append((chunk["offset"]/1e7,chunk["duration"]/1e7,chunk["text"]))
    all_words.append(words);print("VOICE_READY",i,text,flush=True);break
   except Exception:
    if attempt==2:raise
    await asyncio.sleep(2)
 return all_words
boundaries=asyncio.run(synthesize())
sr=44100
retimed=[];clips=[];cursor=0
for i,(sf,ef,text,caption) in enumerate(scenes):
 p=O/f"voice-{i}.wav"
 subprocess.run(["ffmpeg","-v","error","-y","-i",str(O/f"voice-{i}.mp3"),"-ar",str(sr),"-ac","1",str(p)],check=True)
 with wave.open(str(p),"rb") as f:
  a=np.frombuffer(f.readframes(f.getnframes()),dtype="<i2").astype(np.float32)/32768
 length=math.ceil(max((ef-sf)/30,len(a)/sr+.3)*30)/30
 retimed.append((sf/30,ef/30,cursor,cursor+length))
 clips.append((cursor+.12,a,text,caption,boundaries[i]))
 print("SYNC",i,round(cursor,3),round(cursor+length,3),"source",sf,ef,flush=True)
 cursor+=length
duration=cursor
N=math.ceil(duration*sr)
voice=np.zeros(N,np.float32)
segments=[];caption_data=[]
for start,a,text,caption,words in clips:
 begin=round(start*sr);voice[begin:begin+len(a)]+=a
 end=start+len(a)/sr
 ws=[(start+t,d,w) for t,d,w in words]
 segments.append((start,end,text,ws));caption_data.append((start,end,text,caption,ws))
rng=np.random.default_rng(23)
music=np.zeros((N,2),np.float32)
beat=60/94
def add(at, sound, gain=1,pan=0):
    p=round(at*sr)
    if p>=N: return
    a=sound[:min(len(sound),N-p)]*gain
    music[p:p+len(a),0]+=a*math.sqrt((1-pan)/2)
    music[p:p+len(a),1]+=a*math.sqrt((1+pan)/2)
def tone(midi, seconds, kind="keys"):
    t=np.arange(round(seconds*sr))/sr
    f=440*2**((midi-69)/12)
    if kind=="bass":
        a=np.sin(2*np.pi*f*t)+0.18*np.sin(4*np.pi*f*t)
        env=(1-np.exp(-t*80))*np.exp(-t*3.4)
    elif kind=="bell":
        a=np.sin(2*np.pi*f*t)+0.2*np.sin(2*np.pi*f*2*t)
        env=(1-np.exp(-t*150))*np.exp(-t*3.0)
    else:
        a=np.sin(2*np.pi*f*t)+0.27*np.sin(4*np.pi*f*t)+0.08*np.sin(6*np.pi*f*t)
        env=(1-np.exp(-t*75))*np.exp(-t*2.0)
    env*=np.minimum(1,np.maximum(0,(seconds-t)/0.06))
    return (a*env).astype(np.float32)
chords=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,64]]
for bar in range(math.ceil(duration/(4*beat))):
    notes=chords[bar%4]; start=bar*4*beat
    for j,n in enumerate(notes):
        add(start+j*0.018,tone(n+12,2.1),0.085,(j-1.5)*0.32)
        add(start+2.5*beat+j*0.014,tone(n+12,1.2),0.05,(j-1.5)*0.32)
    for b in [0,2]:
        add(start+b*beat,tone(notes[0]-12,0.9,"bass"),0.19)
    if bar>=2:
        pattern=[76,79,83,79] if bar%2==0 else [76,74,72,67]
        for j,n in enumerate(pattern):
            a=tone(n,0.9,"bell")
            pos=start+(j+0.5)*beat
            add(pos,a,0.045,(-1)**j*0.4)
            add(pos+beat*0.75,a,0.012,(-1)**(j+1)*0.5)
    for b in range(4):
        t=np.arange(int(sr*0.28))/sr
        kick=np.sin(2*np.pi*(48*t+4*(1-np.exp(-t*32))))*np.exp(-t*20)*(1-np.exp(-t*200))
        if b in (0,2): add(start+b*beat,kick,0.17)
        if b in (1,3):
            t=np.arange(int(sr*0.12))/sr
            noise=rng.normal(0,1,len(t))
            clap=np.concatenate(([0],np.diff(noise)))*np.exp(-t*42)*0.25
            add(start+b*beat,clap,0.065,0.1)
        for half in (0,0.5):
            t=np.arange(int(sr*0.055))/sr
            noise=rng.normal(0,1,len(t))
            hat=np.concatenate(([0],np.diff(noise)))*np.exp(-t*90)
            add(start+(b+half)*beat,hat,0.012 if half else 0.016,-0.35)
time=np.arange(N)/sr
duck=np.ones(N)
for a,b,_,_ in segments:
    # Smooth pre-duck and recovery, keeping words clear.
    envelope=np.minimum(np.clip((time-(a-0.18))/0.18,0,1),np.clip(((b+0.32)-time)/0.32,0,1))
    duck=np.minimum(duck,1-0.58*envelope)
fade=np.minimum(np.clip(time/1.2,0,1),np.clip((duration-time)/1.4,0,1))
music*=((duck*fade)*0.65)[:,None]
# Normalize narration independently, retain clear voice over the instrumental.
active=voice[np.abs(voice)>0.008]
voice*=min(2.5,0.16/(np.sqrt(np.mean(active**2))+1e-9))
mix=voice[:,None]*np.ones((1,2))+music
peak=np.max(np.abs(mix))
if peak>0.94: mix*=0.94/peak
with wave.open(str(O/"mix.wav"),"wb") as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((mix*32767).astype("<i2").tobytes())

def clock(t):
 return f"{int(t//3600)}:{int(t//60)%60:02d}:{int(t)%60:02d}.{int(t%1*100):02d}"
header="""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,54,&H00A7E589,&H00FFFFFF,&H0017131E,&H90000000,-1,0,0,0,100,100,0,0,1,2,0,5,80,80,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
events=""
for start,end,text,caption,words in caption_data:
 panel=r"{\an7\pos(0,0)\p1\bord0\shad0\c&H30202A&\alpha&H18&\fad(90,100)}m 75 1710 l 1005 1710 l 1005 1882 l 75 1882"
 stripe=r"{\an7\pos(0,0)\p1\bord0\shad0\c&HA7E589&\fad(90,100)}m 75 1710 l 82 1710 l 82 1882 l 75 1882"
 for layer,shape in [(0,panel),(1,stripe)]:
  events+=f"Dialogue: {layer},{clock(start)},{clock(end)},Default,,0,0,0,,{shape}\n"
 if caption:
  # Numeric captions preserve the exact amounts visible in the workbook.
  lines=textwrap.wrap(caption,width=25)
  body=r"{\an5\pos(540,1796)\fs60\fad(90,100)}"+r"\N".join(lines)
  events+=f"Dialogue: 2,{clock(start)},{clock(end)},Default,,0,0,0,,{body}\n"
 else:
  groups=[];g=[]
  for word in words:
   if g and (len(" ".join(w[2] for w in g+[word]))>42 or len(g)>=6):
    groups.append(g);g=[]
   g.append(word)
  if g:groups.append(g)
  for gi,g in enumerate(groups):
   a=g[0][0];b=groups[gi+1][0][0] if gi+1<len(groups) else end
   pieces=[];used=0
   for wi,(wt,wd,w) in enumerate(g):
    if used and used+1+len(w)>25:pieces.append(r"\N");used=0
    elif used:pieces.append(" ");used+=1
    until=g[wi+1][0] if wi+1<len(g) else b
    pieces.append(r"{\kf"+str(max(1,round((until-wt)*100)))+"}"+w);used+=len(w)
   body=r"{\an5\pos(540,1796)\fad(60,60)}"+"".join(pieces)
   events+=f"Dialogue: 2,{clock(a)},{clock(b)},Default,,0,0,0,,{body}\n"
(O/"captions.ass").write_text(header+events)
# Piecewise continuous retiming follows each actual typing action without reordering frames.
expr=""
for a,b,c,d in reversed(retimed):
 term=f"({c:.9f}+(T-{a:.9f})*{(d-c)/(b-a):.9f})"
 expr=term if not expr else f"if(lt(T,{b:.9f}),{term},{expr})"
vf=f"setpts='({expr})/TB',fps=30,scale=944:1678,pad=1080:1920:68:20:color=0x0d0d12,subtitles=sheet-audio/captions.ass"
final=O/"Vertice-Planilha-Narrada.mp4"
subprocess.run(["ffmpeg","-hide_banner","-loglevel","warning","-y","-threads","1","-i",str(base),"-i",str(O/"mix.wav"),"-vf",vf,"-filter_threads","1","-c:v","libx264","-threads","2","-preset","veryfast","-crf","18","-c:a","aac","-b:a","192k","-af","loudnorm=I=-16:TP=-1.5:LRA=9","-t",str(duration),"-movflags","+faststart",str(final)],check=True)
p=probe(final)
assert any(s["codec_type"]=="audio" and s["channels"]==2 for s in p["streams"])
assert any(s.get("width")==1080 and s.get("height")==1920 for s in p["streams"])
assert abs(float(p["format"]["duration"])-duration)<.1
for i in [0,3,12,16]:
 t=(retimed[i][2]+retimed[i][3])/2
 jpg=O/f"check-{i}.jpg"
 subprocess.run(["ffmpeg","-v","error","-y","-threads","1","-ss",str(t),"-i",str(final),"-frames:v","1",str(jpg)],check=True)
 data=base64.b64encode(jpg.read_bytes()).decode()
 for k in range(0,len(data),8000):print(f"PREVIEW_{i}_{k//8000:04d}",data[k:k+8000])
print("NARRATED_SHEET_VERIFIED",duration,final.stat().st_size,"pt-BR-AntonioNeural",flush=True)
