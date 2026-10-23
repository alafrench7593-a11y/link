"""Contact sheet: python3 sheet.py out.jpg cols thumbW files..."""
import sys
from PIL import Image, ImageDraw
out, cols, w, *files = sys.argv[1:]
cols, w = int(cols), int(w)
ims = []
for f in files:
    im = Image.open(f).convert('RGB')
    h = int(im.height * w / im.width)
    im = im.resize((w, h))
    c = Image.new('RGB', (w, h + 22), 'black')
    c.paste(im, (0, 22))
    ImageDraw.Draw(c).text((4, 5), f.split('/')[-1][:40], fill='yellow')
    ims.append(c)
H = max(i.height for i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, H * rows), (20, 20, 20))
for i, c in enumerate(ims):
    sheet.paste(c, ((i % cols) * w, (i // cols) * H))
sheet.save(out, quality=72)
print(out, sheet.size)
