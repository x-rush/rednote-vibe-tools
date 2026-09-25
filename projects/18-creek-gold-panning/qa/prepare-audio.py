from pathlib import Path
import subprocess,zipfile,wave,array,math,json
from PIL import Image
base=Path('assets/audio-source');out=Path('assets/audio');out.mkdir(exist_ok=True)
with zipfile.ZipFile(base/'kenney-impact.zip') as z:
 for i in range(3):(base/f'glass{i}.ogg').write_bytes(z.read(f'Audio/impactGlass_light_{i:03}.ogg'))
 (base/'Kenney-LICENSE.txt').write_bytes(z.read('License.txt'))
def convert(src,dst,start,duration,gain=1):
 cmd=['ffmpeg','-y','-v','error','-ss',str(start),'-i',str(base/src),'-t',str(duration),'-ac','1','-ar','22050','-af',f'highpass=f=90,volume={gain},afade=t=in:d=0.012,afade=t=out:st={max(.02,duration-.06)}:d=0.06','-c:a','pcm_s16le',str(out/dst)]
 subprocess.run(cmd,check=True)
for i,(source,start) in enumerate([('splash1.wav',.15),('splash1.wav',1.05),('splash2.wav',.2)]):convert(source,f'water-{i}.wav',start,.62,.7)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(base/'sand.mp3'),'-ac','1','-ar','22050','-c:a','pcm_s16le',str(base/'sand-decoded.wav')],check=True)
with wave.open(str(base/'sand-decoded.wav'),'rb') as f:
 samples=array.array('h',f.readframes(f.getnframes()));rate=f.getframerate()
windows=[]
for start in range(0,len(samples)-int(rate*.42),int(rate*.08)):
 chunk=samples[start:start+int(rate*.42)];rms=math.sqrt(sum(x*x for x in chunk)/len(chunk));windows.append((rms,start/rate))
chosen=[]
for energy,start in sorted(windows,reverse=True):
 if all(abs(start-p)>.6 for p in chosen):chosen.append(start)
 if len(chosen)==3:break
for i,start in enumerate(chosen):convert('sand-decoded.wav',f'sand-{i}.wav',start,.42,.7)
for i in range(3):convert(f'glass{i}.ogg',f'pick-{i}.wav',0,.24,.45)
c=json.loads(Path('src/content/content.json').read_text(encoding='utf-8-sig'))
c['audio']={'gain':.18,'groups':{k:[k+'-'+str(i) for i in range(3)] for k in ['water','sand','pick']},'assets':[{'id':p.stem,'file':'assets/audio/'+p.name} for p in sorted(out.glob('*.wav'))],'credits':'水与砂拟音：Peludo / RNAn（CC0，rnan.itch.io）；玻璃轻碰：Kenney Impact Sounds（CC0，kenney.nl）。已裁切、转单声道并淡入淡出。'}
Path('src/content/content.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name in ['worn-pan','wet-sand']:
 im=Image.open('assets/'+name+'.png');im.thumbnail((768,768));im.save('assets/'+name+'.webp',quality=84,method=6)
print('Sand segment offsets',chosen)
print('Encoded WAV total bytes',sum(p.stat().st_size for p in out.glob('*.wav')))
