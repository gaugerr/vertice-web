import asyncio, json, math, subprocess, wave, textwrap
from pathlib import Path
import edge_tts
O=Path("video-output")
meta=json.loads((O/"capture.json").read_text())
notes=meta["notes"]
def at(prefix):
    return next(x["at"] for x in notes if x["note"].startswith(prefix))
base=O/"vertice-lista-de-compras-1080x1920.mp4"
duration=float(json.loads(subprocess.check_output(["ffprobe","-v","error","-show_format","-of","json",str(base)]))["format"]["duration"])
cues=[
 (0.5,"Suas compras começam com uma lista."),
 (at("Criação")+0.2,"No Vértice, crie sua lista e adicione o que precisa levar."),
 (at("Preço de Arroz")+0.1,"No mercado, marque os produtos e registre os preços."),
 (at("Preço de Feijão")+0.1,"O total acompanha cada escolha, para você conferir quanto já gastou."),
 (at("Resumo")+0.1,"Mais clareza, do primeiro item ao fim da compra."),
 (meta["appDuration"]+0.65,"Vértice. Onde suas compras encontram o equilíbrio.")
]
async def speak():
    for i,(_,text) in enumerate(cues):
        print("VOICE_SEGMENT",i,text,flush=True)
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text,"pt-BR-FranciscaNeural",rate="-3%").save(str(O/f"voz-{i}.mp3"))
                break
            except Exception:
                if attempt==2: raise
                await asyncio.sleep(2)
asyncio.run(speak())
sr=24000
timeline=bytearray(math.ceil(duration*sr)*2)
subtitles=[]
for i,(start,text) in enumerate(cues):
    mp3=O/f"voz-{i}.mp3"
    raw=float(json.loads(subprocess.check_output(["ffprobe","-v","error","-show_format","-of","json",str(mp3)]))["format"]["duration"])
    next_start=cues[i+1][0] if i+1<len(cues) else duration-0.55
    available=next_start-start-0.18
    speed=max(1,raw/available)
    target=O/f"voz-{i}.wav"
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(mp3),"-af",f"atempo={speed:.5f}","-ar",str(sr),"-ac","1",str(target)],check=True)
    with wave.open(str(target),"rb") as f:
        pcm=f.readframes(f.getnframes())
    begin=round(start*sr)*2
    timeline[begin:begin+len(pcm)]=pcm
    end=start+len(pcm)/(2*sr)
    subtitles.append((start,end,text))
with wave.open(str(O/"narracao-pt-BR.wav"),"wb") as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(timeline)
def clock(t,ass=False):
    h=int(t//3600);m=int(t//60)%60;s=int(t)%60
    return f"{h}:{m:02d}:{s:02d}.{int(t%1*100):02d}" if ass else f"{h:02d}:{m:02d}:{s:02d},{int(t%1*1000):03d}"
srt="";events=""
for i,(start,end,text) in enumerate(subtitles,1):
    lines=textwrap.wrap(text,width=39)
    srt+=f"{i}\n{clock(start)} --> {clock(end)}\n"+chr(10).join(lines)+"\n\n"
    events+=f"Dialogue: 0,{clock(start,True)},{clock(end,True)},Default,,0,0,0,,"+r"\N".join(lines)+chr(10)
(O/"legendas-sincronizadas.srt").write_text(srt)
header="""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,43,&H00FFFFFF,&H00FFFFFF,&H00101014,&H90000000,0,0,0,0,100,100,0,0,3,2,1,2,65,65,90,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
(O/"legendas.ass").write_text(header+events)
final=O/"vertice-com-audio-e-legendas.mp4"
subprocess.run(["ffmpeg","-hide_banner","-loglevel","info","-y","-threads","1","-i",str(base),"-i",str(O/"narracao-pt-BR.wav"),"-vf","subtitles=video-output/legendas.ass","-filter_threads","1","-c:v","libx264","-threads","2","-preset","veryfast","-crf","18","-c:a","aac","-b:a","192k","-af","loudnorm=I=-16:TP=-1.5:LRA=11","-t",str(duration),"-movflags","+faststart",str(final)],check=True)
probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(final)]))
assert any(s["codec_type"]=="audio" for s in probe["streams"])
assert any(s.get("width")==1080 and s.get("height")==1920 for s in probe["streams"])
(O/"verificacao-audio.json").write_text(json.dumps({"duration":duration,"voice":"pt-BR-FranciscaNeural","synthetic":True,"cues":subtitles,"scrollFps":30,"width":1080,"height":1920},ensure_ascii=False,indent=2))
subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-threads","1","-i",str(final),"-ss","18","-frames:v","1",str(O/"previa-legendas.jpg")],check=True)
import base64
data=base64.b64encode((O/"previa-legendas.jpg").read_bytes()).decode()
for n in range(0,len(data),8000): print("PREVIEW_"+str(n//8000).zfill(4),data[n:n+8000])
print("VIDEO_WITH_AUDIO_VERIFIED",duration,flush=True)
