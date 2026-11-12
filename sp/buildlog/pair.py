# python3 pair.py out.png before.png after.png [crop_px] [top_px]  -> side by side, labelled Before / After
import sys
from PIL import Image, ImageDraw, ImageFont
out, a, b = sys.argv[1:4]
crop = int(sys.argv[4]) if len(sys.argv) > 4 else 2400
top = int(sys.argv[5]) if len(sys.argv) > 5 else 0
ims = []
for p in (a, b):
    im = Image.open(p).convert('RGB')
    ims.append(im.crop((0, top, im.width, min(im.height, top + crop))))
h = max(i.height for i in ims); gap = 24; lab = 56
W = sum(i.width for i in ims) + gap
canvas = Image.new('RGB', (W, h + lab), (255, 255, 255))
d = ImageDraw.Draw(canvas)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 32)
except Exception: f = ImageFont.load_default()
x = 0
for name, im in zip(('Before', 'After'), ims):
    d.text((x + 16, 10), name, fill=(40, 40, 40), font=f)
    canvas.paste(im, (x, lab)); x += im.width + gap
canvas.save(out)
print(out, canvas.size)
