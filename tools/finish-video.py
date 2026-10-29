import asyncio, base64, json, math, subprocess, wave, textwrap
from pathlib import Path
import edge_tts
import numpy as np
O=Path("video-output")
base=O/"vertice-lista-de-compras-1080x1920.mp4"
def probe(p):
    return json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(p)]))
duration=float(probe(base)["format"]["duration"])
cues=[
(0.35,"Uma compra mais leve começa com organização."),
(4.3,"Crie sua lista no Vértice e dê nome aos seus planos."),
(8.5,"Arroz, feijão, café... adicione o que faz parte da sua rotina."),
(13.4,"Tudo à mão, para lembrar do que precisa."),
(16.6,"Pegou um produto? Marque e registre o preço."),
(20.5,"O total se atualiza a cada escolha."),
(24.0,"Assim, você acompanha os gastos enquanto compra."),
(28.0,"Lista organizada. Valores claros. Mais tranquilidade no mercado."),
(33.0,"Vértice. Onde suas compras encontram o equilíbrio.")
]
async def speak():
    boundaries=[]
    for i,(_,text) in enumerate(cues):
        for attempt in range(3):
            try:
                words=[]
                with (O/f"voice-{i}.mp3").open("wb") as f:
                    async for c in edge_tts.Communicate(text,"pt-BR-FranciscaNeural",rate="+0%",boundary="WordBoundary").stream():
                        if c["type"]=="audio": f.write(c["data"])
                        elif c["type"]=="WordBoundary": words.append((c["offset"]/1e7,c["duration"]/1e7,c["text"]))
                boundaries.append(words)
                print("VOICE_READY",i,len(words),flush=True)
                break
            except Exception:
                if attempt==2: raise
                await asyncio.sleep(2)
    return boundaries
boundaries=asyncio.run(speak())
sr=44100
N=math.ceil(duration*sr)
voice=np.zeros(N,np.float32)
segments=[]
for i,(start,text) in enumerate(cues):
    raw=float(probe(O/f"voice-{i}.mp3")["format"]["duration"])
    stop=cues[i+1][0]-0.14 if i+1<len(cues) else duration-0.55
    speed=max(1,raw/(stop-start))
    assert speed<1.65, (i,speed)
    wav=O/f"voice-{i}.wav"
    subprocess.run(["ffmpeg","-v","error","-y","-i",str(O/f"voice-{i}.mp3"),"-af",f"atempo={speed}","-ar",str(sr),"-ac","1",str(wav)],check=True)
    with wave.open(str(wav),"rb") as f: a=np.frombuffer(f.readframes(f.getnframes()),dtype="<i2").astype(np.float32)/32768
    begin=round(start*sr); end=min(N,begin+len(a))
    voice[begin:end]+=a[:end-begin]
    words=[(start+t/speed,d/speed,w) for t,d,w in boundaries[i]]
    if not words:
        ws=text.split(); step=len(a)/sr/len(ws)
        words=[(start+j*step,step,w) for j,w in enumerate(ws)]
    segments.append((start,end/sr,text,words))
    print("VOICE_TIMING",i,round(start,2),round(end/sr,2),"speed",round(speed,2),flush=True)
# Original 102 BPM instrumental: warm keys, soft bass, light percussion and melodic bells.
rng=np.random.default_rng(23)
music=np.zeros((N,2),np.float32)
beat=60/102
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
music*=((duck*fade)*0.85)[:,None]
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
Style: Default,DejaVu Sans,56,&H00A7E589,&H00FFFFFF,&H0017131E,&H90000000,-1,0,0,0,100,100,0,0,1,2,0,5,80,80,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
events=""
for start,end,text,words in segments:
    # Fixed purple caption panel occupies only the free space below the app.
    panel=r"{\an7\pos(0,0)\p1\bord0\shad0\c&H261C30&\alpha&H20&\fad(100,100)}m 100 1693 l 980 1693 l 980 1864 l 100 1864"
    events+=f"Dialogue: 0,{clock(start)},{clock(end)},Default,,0,0,0,,{panel}\n"
    stripe=r"{\an7\pos(0,0)\p1\bord0\shad0\c&HA7E589&\fad(100,100)}m 100 1693 l 107 1693 l 107 1864 l 100 1864"
    events+=f"Dialogue: 1,{clock(start)},{clock(end)},Default,,0,0,0,,{stripe}\n"
    groups=[];g=[]
    for word in words:
        if g and (len(" ".join(w[2] for w in g+[word]))>40 or len(g)>=6):
            groups.append(g);g=[]
        g.append(word)
    if g: groups.append(g)
    for gi,g in enumerate(groups):
        a=g[0][0]
        b=groups[gi+1][0][0] if gi+1<len(groups) else end
        lines=textwrap.wrap(" ".join(w[2] for w in g),width=24)
        # Highlight each word in mint as it is spoken, preserving phrase readability.
        pieces=[];line=0;used=0
        for wi,(wt,wd,w) in enumerate(g):
            if used and used+1+len(w)>24: pieces.append(r"\N");used=0
            elif used: pieces.append(" ");used+=1
            until=g[wi+1][0] if wi+1<len(g) else b
            pieces.append(r"{\kf"+str(max(1,round((until-wt)*100)))+"}"+w)
            used+=len(w)
        caption=r"{\an5\pos(540,1778)\fad(60,60)}"+"".join(pieces)
        events+=f"Dialogue: 2,{clock(a)},{clock(b)},Default,,0,0,0,,{caption}\n"
(O/"final.ass").write_text(header+events)
final=O/"Vertice.mp4"
subprocess.run(["ffmpeg","-hide_banner","-loglevel","warning","-y","-threads","1","-i",str(base),"-i",str(O/"mix.wav"),"-vf","subtitles=video-output/final.ass","-filter_threads","1","-c:v","libx264","-threads","2","-preset","veryfast","-crf","18","-c:a","aac","-b:a","192k","-af","loudnorm=I=-16:TP=-1.5:LRA=9","-t",str(duration),"-movflags","+faststart",str(final)],check=True)
p=probe(final)
assert any(s["codec_type"]=="audio" and s["channels"]==2 for s in p["streams"])
assert any(s.get("width")==1080 and s.get("height")==1920 for s in p["streams"])
for at in [9.5,18.3,34.5]:
    jpg=O/f"check-{at}.jpg"
    subprocess.run(["ffmpeg","-v","error","-y","-threads","1","-ss",str(at),"-i",str(final),"-frames:v","1",str(jpg)],check=True)
    data=base64.b64encode(jpg.read_bytes()).decode()
    for k in range(0,len(data),8000): print(f"CHECK_{at}_{k//8000:04d}",data[k:k+8000])
print("FINAL_VERIFIED",duration,final.stat().st_size,"stereo, original music, 9 voice segments",flush=True)
