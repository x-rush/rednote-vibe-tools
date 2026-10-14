import sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);content=root/'content.js';text=content.read_text(encoding='utf-8')
for p in (root/'assets').glob('*.png'):
 target=p.with_suffix('.webp')
 with Image.open(p) as im: im.save(target,'WEBP',quality=84,method=6)
 text=text.replace('assets/'+p.name,'assets/'+target.name)
 html=root/'index.html';html.write_text(html.read_text(encoding='utf-8').replace('assets/'+p.name,'assets/'+target.name),encoding='utf-8')
 p.unlink()
content.write_text(text,encoding='utf-8')
