import base64
import json
import shlex
import subprocess
from pathlib import Path
from PIL import Image

OUT = Path("video-output")
FPS = 30
WIDTH, HEIGHT = 1080, 1920

def entries(name):
    result = []
    image = None
    for line in (OUT / name).read_text().splitlines():
        if line.startswith("file "):
            image = OUT / "frames" / Path(shlex.split(line)[1]).name
        elif line.startswith("duration "):
            result.append((image, float(line.split()[1])))
    return result

def encode(shots, target):
    command = [
        "ffmpeg", "-hide_banner", "-y", "-loglevel", "info",
        "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", "1080x1920",
        "-framerate", "30", "-i", "pipe:0", "-an",
        "-filter_threads", "1", "-threads", "2", "-c:v", "libx264",
        "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(OUT / target),
    ]
    print("ENCODING", target, "shots", len(shots), flush=True)
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    total = 0.0
    sent = 0
    try:
        for index, (path, duration) in enumerate(shots):
            with Image.open(path) as image:
                if image.size != (WIDTH, HEIGHT):
                    raise ValueError("Unexpected capture dimensions: " + str(image.size))
                pixels = image.convert("RGB").tobytes()
            total += duration
            count = round(total * FPS) - sent
            for _ in range(count):
                process.stdin.write(pixels)
            sent += count
            if index % 10 == 0:
                print("FRAME_PROGRESS", target, index, "of", len(shots), "frames", sent, flush=True)
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("Encoder failed: " + target)
    print("ENCODE_COMPLETE", target, sent, "frames", flush=True)
    return sent / FPS

app_duration = encode(entries("app.ffconcat"), "vertice-gravacao-bruta.mp4")
end_duration = encode(entries("end.ffconcat"), "closing.mp4")
duration = app_duration + end_duration - 1.0
camera = "zoompan=z='1.018+0.016*sin(on/30*0.28-1)':x='iw/2-(iw/zoom/2)':y='ih*0.43-(ih/zoom*0.43)':d=1:s=1080x1920:fps=30"
filters = (
    "[0:v]" + camera + ",setsar=1,settb=AVTB,setpts=PTS-STARTPTS,fps=30[a];"
    "[1:v]setsar=1,settb=AVTB,setpts=PTS-STARTPTS,fps=30[b];"
    "[a][b]xfade=transition=fade:duration=1:offset=" + str(app_duration - 1.0) +
    ",fade=t=in:st=0:d=0.5,fade=t=out:st=" + str(duration - 0.7) + ":d=0.7,format=yuv420p[v]"
)
final = OUT / "vertice-lista-de-compras-1080x1920.mp4"
print("COMPOSITING_FINAL", duration, "seconds", flush=True)
subprocess.run([
    "ffmpeg", "-hide_banner", "-loglevel", "info", "-y", "-filter_complex_threads", "1",
    "-threads", "1", "-i", str(OUT / "vertice-gravacao-bruta.mp4"),
    "-threads", "1", "-i", str(OUT / "closing.mp4"),
    "-filter_complex", filters, "-map", "[v]", "-an", "-t", str(duration),
    "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", str(final)
], check=True)
probe = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(final)
]))
video = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
assert video["width"] == WIDTH and video["height"] == HEIGHT
assert video["avg_frame_rate"] == "30/1"
assert not any(stream["codec_type"] == "audio" for stream in probe["streams"])
assert 34 <= float(probe["format"]["duration"]) <= 36
subprocess.run([
    "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y", "-threads", "1", "-i", str(final),
    "-vf", "fps=1/4,scale=360:640,tile=3x3", "-frames:v", "1", "-threads", "1", "-q:v", "5",
    str(OUT / "contato-video.jpg")
], check=True)
metadata = json.loads((OUT / "capture.json").read_text())
metadata.update({
    "sourceCommit": "e625cb74d7dbbaa5a65a7b51951624414cd13a7d",
    "recording": "Real app, isolated local build with fictional data; production untouched",
    "verifiedTotal": "52.30", "width": WIDTH, "height": HEIGHT, "fps": 30,
    "duration": probe["format"]["duration"], "bytes": probe["format"]["size"], "audio": False
})
(OUT / "verificacao.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
(OUT / "narracao.txt").write_text("""Suas compras começam com uma lista.

No Vértice, você cria, organiza e adiciona o que precisa levar.

No mercado, é só marcar os produtos e registrar os preços.

O total acompanha cada escolha, para você conferir quanto já gastou.

Mais clareza, do primeiro item ao fim da compra.

Vértice. Onde suas compras encontram o equilíbrio.
""")
(OUT / "legendas-sugeridas.srt").write_text("""1
00:00:00,400 --> 00:00:04,000
Suas compras começam com uma lista.

2
00:00:04,000 --> 00:00:10,000
No Vértice, você cria, organiza
e adiciona o que precisa levar.

3
00:00:10,000 --> 00:00:17,000
No mercado, é só marcar os produtos
e registrar os preços.

4
00:00:17,000 --> 00:00:24,000
O total acompanha cada escolha,
para conferir quanto já gastou.

5
00:00:24,000 --> 00:00:29,000
Mais clareza, do primeiro item
ao fim da compra.

6
00:00:29,000 --> 00:00:34,500
Vértice. Onde suas compras
encontram o equilíbrio.
""")
(OUT / "LEIA-ME.txt").write_text("""VÉRTICE — VÍDEO DEMONSTRATIVO

vertice-lista-de-compras-1080x1920.mp4: vídeo final vertical em H.264, 35 segundos e 30 fps, sem áudio nem legendas fixas. Inclui zoom suave, transição para a marca e fade-out.
vertice-gravacao-bruta.mp4: demonstração antes dos efeitos de câmera e fechamento.
closing.mp4: fechamento da marca separado.
narracao.txt: texto sugerido para gravar a voz.
legendas-sugeridas.srt: ajuste os tempos à voz que você gravar.
contato-video.jpg: folha de contato para revisão.

A interface é a do app real, gravado em uma cópia local isolada da versão atual com dados fictícios. Não foram alterados produção, conta real ou APIs.
""")
contact = base64.b64encode((OUT / "contato-video.jpg").read_bytes()).decode()
for index in range(0, len(contact), 8000):
    print("CONTACT_CHUNK_" + str(index // 8000).zfill(4), contact[index:index+8000])
print("VIDEO_FINAL_VERIFIED", json.dumps({
    "duration": metadata["duration"], "width": WIDTH, "height": HEIGHT,
    "fps": 30, "bytes": metadata["bytes"], "audio": False
}), flush=True)
