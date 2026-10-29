import os,time,subprocess,json,base64,math
from pathlib import Path
import uno
from com.sun.star.beans import PropertyValue
from PIL import Image,ImageDraw,ImageFilter
from Xlib import display,X
O=Path("sheet-output");O.mkdir(exist_ok=True)
profile=Path("/tmp/vertice-sheet-profile/user");profile.mkdir(parents=True,exist_ok=True)
profile.joinpath("registrymodifications.xcu").write_text('''<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Setup/L10N"><prop oor:name="ooLocale" oor:op="fuse"><value>pt-BR</value></prop><prop oor:name="ooSetupSystemLocale" oor:op="fuse"><value>pt-BR</value></prop></item><item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="ShowTipOfTheDay" oor:op="fuse"><value>false</value></prop><prop oor:name="FirstRun" oor:op="fuse"><value>false</value></prop></item><item oor:path="/org.openoffice.Office.Linguistic/General"><prop oor:name="IsSpellAuto" oor:op="fuse"><value>false</value></prop></item></oor:items>''')
def prop(n,v):
 p=PropertyValue();p.Name=n;p.Value=v;return p
subprocess.Popen(["libreoffice","-env:UserInstallation=file:///tmp/vertice-sheet-profile","--norestore","--nodefault","--nofirststartwizard","--accept=socket,host=localhost,port=2002;urp;StarOffice.ComponentContext"])
local=uno.getComponentContext()
resolver=local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver",local)
for _ in range(100):
 try:ctx=resolver.resolve("uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext");break
 except Exception:time.sleep(.2)
desktop=ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop",ctx)
doc=desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(Path("sheet.xlsx").resolve())),"_blank",0,(prop("Hidden",False),prop("ReadOnly",False),prop("UpdateDocMode",3),prop("MacroExecutionMode",4)))
controller=doc.getCurrentController()
window=controller.getFrame().getContainerWindow()
window.setPosSize(0,0,1600,1000,15)
dispatch=ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.DispatchHelper",ctx)
def command(name,props=()):
 dispatch.executeDispatch(controller.getFrame(),name,"",0,props)
def key(k):
 subprocess.run(["xdotool","key","--clearmodifiers",k],check=True)
time.sleep(2)
key("Escape")
# Remove the first-run information strip and enter a clean sheet-focused editor.
subprocess.run(["xdotool","mousemove","1542","126","click","1"],check=True)
command(".uno:SpellOnline",(prop("Enable",False),))
command(".uno:FullScreen",(prop("FullScreen",True),))
time.sleep(.7)
lm=controller.getFrame().LayoutManager
for resource in ["private:resource/toolbar/fullscreenbar","private:resource/toolbar/standardbar","private:resource/toolbar/formatobjectbar","private:resource/menubar/menubar"]:
 try:lm.hideElement(resource)
 except Exception:pass
controller.setActiveSheet(doc.Sheets.getByName("Lançamentos"))
controller.ZoomValue=100
controller.select(doc.Sheets.getByName("Lançamentos").getCellRangeByName("B6"))
time.sleep(.7)
d=display.Display();root=d.screen().root
def screenshot():
 raw=root.get_image(0,0,1600,1000,X.ZPixmap,0xffffffff)
 return Image.frombytes("RGB",(1600,1000),raw.data,"raw","BGRX")
def diagnostic(name,img=None):
 if img is None:img=screenshot()
 p=O/(name+".jpg");img.save(p,quality=82)
 data=base64.b64encode(p.read_bytes()).decode()
 for k in range(0,len(data),8000):print("SHOT_"+name+"_"+str(k//8000).zfill(4),data[k:k+8000],flush=True)
diagnostic("ready")
# Only the downloaded demonstration copy is edited. Workbook formulas remain intact.
launch=doc.Sheets.getByName("Lançamentos")
budget=doc.Sheets.getByName("Orçamento")
dash=doc.Sheets.getByName("Dashboard")
dash.getCellRangeByName("Q3").String="Outubro"
dash.getCellRangeByName("V3").Value=2026
from datetime import date
serial=lambda day:(date(2026,10,day)-date(1899,12,30)).days
rows=[
(6,5,"Salário mensal","R01 · Salário","Transferência","4500,00","Recebido"),
(7,7,"Supermercado","D03 · Mercado","Pix","386,70","Pago"),
(8,9,"Transporte","D05 · Transporte","Pix","180,00","Pago"),
(9,12,"Cinema","D08 · Lazer","Pix","72,00","Pago"),
(10,15,"Farmácia","D06 · Saúde","Pix","54,90","Pago")]
# Dates and validated selections are prepared as context; descriptions and amounts are typed on camera.
for row,day,name,cat,payment,amount,status in rows:
 launch.getCellRangeByName(f"A{row}").Value=serial(day)
 launch.getCellRangeByName(f"C{row}").String=cat
 launch.getCellRangeByName(f"D{row}").String=payment
 launch.getCellRangeByName(f"F{row}").String=status
doc.calculateAll()
time.sleep(.3)
# Build smooth camera paths around genuine editor screenshots, at 30 fps.
W,H=1080,1920
FPS=30
bg=Image.new("RGB",(W,H),(14,13,20))
glow=Image.new("RGB",(W,H),(14,13,20))
gd=ImageDraw.Draw(glow);gd.ellipse((-300,-100,1300,1300),fill=(32,24,48))
bg=glow.filter(ImageFilter.GaussianBlur(200))
mask=Image.new("L",(980,1720),0);ImageDraw.Draw(mask).rounded_rectangle((0,0,979,1719),radius=35,fill=255)
encoder=subprocess.Popen(["ffmpeg","-hide_banner","-loglevel","warning","-y","-f","rawvideo","-vcodec","rawvideo","-pix_fmt","rgb24","-s","1080x1920","-r","30","-i","-","-an","-c:v","libx264","-threads","2","-preset","veryfast","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart",str(O/"Vertice-Planilha.mp4")],stdin=subprocess.PIPE)
camera=[490.,470.,830.]
frame_count=0
def frame(img,cam,opacity=1):
 global frame_count
 cx,cy,cw=cam;ch=cw*1720/980
 # Padding is the same dark canvas when the camera pulls back past the editor.
 pad=Image.new("RGB",(4800,4800),(17,16,23));pad.paste(img,(1600,1600))
 box=(1600+cx-cw/2,1600+cy-ch/2,1600+cx+cw/2,1600+cy+ch/2)
 tile=pad.resize((980,1720),Image.Resampling.BICUBIC,box=box)
 out=bg.copy();out.paste(tile,(50,100),mask)
 if opacity<1:out=Image.blend(bg,out,opacity)
 encoder.stdin.write(out.tobytes());frame_count+=1
def hold(seconds,img=None):
 if img is None:img=screenshot()
 for _ in range(round(seconds*FPS)):frame(img,camera)
def move(target,seconds=.75,img=None):
 global camera
 if img is None:img=screenshot()
 origin=camera[:]
 for i in range(round(seconds*FPS)):
  t=(i+1)/round(seconds*FPS);e=t*t*(3-2*t)
  cam=[a+(b-a)*e for a,b in zip(origin,target)]
  frame(img,cam)
 camera=list(target)
def type_cell(sheet,cell,text,seconds=1):
 controller.select(sheet.getCellRangeByName(cell))
 time.sleep(.07)
 # xdotool sends actual keyboard events into Calc's cell editor, including accents.
 for c in text:
  subprocess.run(["xdotool","type","--clearmodifiers","--delay","0",c],check=True)
  time.sleep(.035)
  hold(seconds/len(text))
 key("Return");time.sleep(.16)
 doc.calculateAll();hold(.32)
def cellxy(sheet,name):
 cell=sheet.getCellRangeByName(name)
 # Calc grid after fullscreen: 36 px row header, 18 px column header.
 return (36+cell.Position.X*96/2540+cell.Size.Width*96/2540/2,18+cell.Position.Y*96/2540+cell.Size.Height*96/2540/2)
def focus(sheet,name,width=510):
 x,y=cellxy(sheet,name)
 # Keep the active cell in the upper middle, with surrounding rows visible.
 return [max(width/2+10,min(1580-width/2,x)),max(440,min(560,y+145)),width]
img=screenshot()
for i in range(21):frame(img,camera,(i+1)/21)
hold(.5)
for idx,(row,day,name,cat,payment,amount,status) in enumerate(rows):
 move(focus(launch,f"B{row}",520),.65)
 type_cell(launch,f"B{row}",name,1.0 if idx==0 else .8)
 move(focus(launch,f"E{row}",490),.72)
 type_cell(launch,f"E{row}",amount,.9)
 assert abs(launch.getCellRangeByName(f"E{row}").Value-float(amount.replace(",",".")))<.001,(row,launch.getCellRangeByName(f"E{row}").String)
 print("ROW_DONE",row,name,launch.getCellRangeByName(f"E{row}").String,flush=True)
diagnostic("entries")
# Pull back to reveal the real workbook tab bar, then gently dissolve to the next view.
def switch(sheet):
 global camera
 move([790,630,1560],.65)
 hold(.25)
 before=screenshot()
 controller.setActiveSheet(sheet);controller.ZoomValue=100
 controller.select(sheet.getCellRangeByName("B10" if sheet.Name=="Orçamento" else "B8"))
 time.sleep(.4)
 after=screenshot()
 for i in range(15):frame(Image.blend(before,after,(i+1)/15),camera)
 hold(.25)
switch(budget)
for cell,amount in [("B10","800"),("B12","350"),("B15","300")]:
 move(focus(budget,cell,520),.65)
 type_cell(budget,cell,amount,.65)
 hold(.35)
doc.calculateAll()
diagnostic("budget")
for a,expected in [("D10",386.7),("D12",180),("D15",72)]:
 assert abs(budget.getCellRangeByName(a).Value-expected)<.01,(a,budget.getCellRangeByName(a).String)
switch(dash)
doc.calculateAll();time.sleep(.5)
expected={"B8":4500,"G8":693.6,"L8":3806.4}
for a,val in expected.items():
 c=dash.getCellRangeByName(a)
 print("DASH_CHECK",a,c.String,c.Value,flush=True)
 assert abs(c.Value-val)<.01,(a,c.String)
diagnostic("dashboard")
# Focus sequentially on genuine dashboard cards and charts.
move([350,440,680],.9);hold(1.5)
move([760,440,650],1.15);hold(1.5)
move([1170,440,640],1.15);hold(1.5)
move([520,630,820],1.15);hold(1.6)
# Soft fade into the already approved official Vértice closing animation.
img=screenshot()
for i in range(18):frame(img,camera,1-(i+1)/18)
closing=Path("prior/vertice-lista-de-compras-1080x1920.mp4")
decoder=subprocess.Popen(["ffmpeg","-v","error","-threads","1","-ss","32.333333","-i",str(closing),"-t","4.5","-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
for i in range(135):
 raw=decoder.stdout.read(W*H*3)
 if len(raw)<W*H*3:break
 im=Image.frombytes("RGB",(W,H),raw)
 alpha=min(1,(i+1)/15,(135-i)/20)
 if alpha<1:im=Image.blend(bg,im,alpha)
 encoder.stdin.write(im.tobytes());frame_count+=1
decoder.stdout.close();decoder.wait()
encoder.stdin.close();assert encoder.wait()==0
p=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(O/"Vertice-Planilha.mp4")]))
assert not any(s["codec_type"]=="audio" for s in p["streams"])
assert p["streams"][0]["width"]==1080 and p["streams"][0]["height"]==1920
for secs in [5,20,32,42]:
 jpg=O/f"final-{secs}.jpg"
 subprocess.run(["ffmpeg","-v","error","-threads","1","-y","-ss",str(secs),"-i",str(O/"Vertice-Planilha.mp4"),"-frames:v","1",str(jpg)],check=True)
 if jpg.exists():diagnostic(f"final{secs}",Image.open(jpg))
print("SHEET_VIDEO_VERIFIED",p["format"]["duration"],frame_count,expected,flush=True)
doc.close(True)
