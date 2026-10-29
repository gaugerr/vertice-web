import os,time,subprocess,json,base64
from pathlib import Path
import uno
from com.sun.star.beans import PropertyValue
from PIL import Image
from Xlib import display,X
O=Path("sheet-output");O.mkdir(exist_ok=True)
def prop(n,v):
 p=PropertyValue();p.Name=n;p.Value=v;return p
subprocess.Popen(["libreoffice","-env:UserInstallation=file:///tmp/vertice-sheet-profile","--norestore","--nodefault","--nofirststartwizard","--accept=socket,host=localhost,port=2002;urp;StarOffice.ComponentContext"])
local=uno.getComponentContext()
resolver=local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver",local)
for _ in range(100):
 try:
  ctx=resolver.resolve("uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext");break
 except Exception:time.sleep(.2)
desktop=ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop",ctx)
doc=desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(Path("sheet.xlsx").resolve())),"_blank",0,(prop("Hidden",False),prop("ReadOnly",False),prop("UpdateDocMode",3),prop("MacroExecutionMode",4)))
controller=doc.getCurrentController()
controller.getFrame().getContainerWindow().setPosSize(0,0,1600,1000,15)
time.sleep(2)
# Disable tips and first-run notices through normal UI dispatch; screenshot diagnostic.
dispatch=ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.DispatchHelper",ctx)
controller.setActiveSheet(doc.Sheets.getByName("Lançamentos"))
controller.ZoomValue=110
controller.select(doc.Sheets.getByName("Lançamentos").getCellRangeByName("B6"))
time.sleep(2)
d=display.Display();root=d.screen().root
def shot(name):
 raw=root.get_image(0,0,1600,1000,X.ZPixmap,0xffffffff)
 img=Image.frombytes("RGB",(1600,1000),raw.data,"raw","BGRX")
 img.save(O/(name+".jpg"),quality=85)
 data=base64.b64encode((O/(name+".jpg")).read_bytes()).decode()
 for k in range(0,len(data),8000):print("DIAG_"+name+"_"+str(k//8000).zfill(4),data[k:k+8000],flush=True)
shot("launch")
print("SHEETS",doc.Sheets.getElementNames(),flush=True)
for n in ["Lançamentos","Orçamento","Dashboard"]:
 s=doc.Sheets.getByName(n)
 print("SHEET_INFO",n,s.getCellRangeByName("B6").Position,s.getCellRangeByName("B6").Size,flush=True)
print("CATEGORIES",[(i,doc.Sheets.getByName("_Categorias").getCellByPosition(7,i).String) for i in range(1,14)],flush=True)
doc.calculateAll()
print("DASH_BASE",doc.Sheets.getByName("Dashboard").getCellRangeByName("B8").String,flush=True)
print("PROBE_COMPLETE",flush=True)
doc.close(True)
