from pathlib import Path
import json, subprocess, hashlib

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
SOURCE=PROJECT/'staging-release/obsolete-20261018-note/work'
WORK=ROOT/'work'
WORK.mkdir(exist_ok=True)
clips=[SOURCE/f'clip-{i:02}.mp4' for i in range(15)]
assert all(p.is_file() for p in clips)
listing=WORK/'concat.txt'
listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips)+'\n',encoding='utf8')
video=ROOT/'更新了第二版-配音底片-无字幕无音乐.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-map','0:v:0','-c:v','copy','-an','-movflags','+faststart',str(video)],check=True)
sentences=[
 (0.4,7.6,'大赛结束了，玩这个小游戏的人却慢慢多了。'),
 (8.5,11.0,'所以，回来填坑。'),
 (11.5,18.2,'从小细胞，一路长成大猎手。'),
 (18.9,25.0,'长大以后，连地形都能破开。'),
 (25.7,30.1,'以前追着你跑的，现在一口吞。'),
 (30.8,39.8,'结束一局，还能留下种源，孵化新的细胞。'),
 (40.7,43.3,'第二版，回来试试？'),
]
assert all(a<b and (i==0 or a>sentences[i-1][1]) for i,(a,b,_) in enumerate(sentences))
text='\n\n'.join(s for _,_,s in sentences)+'\n'
(ROOT/'简短配音稿.txt').write_text(text,encoding='utf8')
def stamp(t):
 ms=round(t*1000)
 return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
def wrap(s):
 if len(s)<=19:return s
 pos=s.rfind('，',0,19)
 return s[:pos+1]+'\n'+s[pos+1:] if pos>=0 else s[:18]+'\n'+s[18:]
(ROOT/'可选字幕-7句不重叠.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{wrap(s)}' for i,(a,b,s) in enumerate(sentences))+'\n',encoding='utf8')
(ROOT/'配音时间轴.json').write_text(json.dumps({'duration':43.6,'timing':'Suggested placement windows; align to the actual chosen voice after generating speech.','sentences':[{'start':a,'end':b,'text':s} for a,b,s in sentences]},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
assert len(probe['streams'])==1
s=probe['streams'][0]
assert s['codec_type']=='video' and (s['width'],s['height'],s['r_frame_rate'])==(1080,1920,'30/1')
assert abs(float(probe['format']['duration'])-43.6)<.1
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','NUL'],check=True)
proof={'video':video.name,'width':1080,'height':1920,'fps':30,'duration':float(probe['format']['duration']),'audioTracks':0,'addedBurnedText':False,'originalGameUIRetained':True,'subtitleSegments':7,'subtitleOverlaps':0,'decode':'pass','sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'voiceover':'Script only; user supplies voice. No claim of measured TTS duration.'}
(ROOT/'verification.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','1','-i',str(video),'-frames:v','1',str(WORK/'opening.png')],check=True)
print(json.dumps(proof,ensure_ascii=False))
