"""Quality check of the 20 campaign images: size, near-duplicates (difference hash), photo reuse.
python3 qa-images.py <IRLY_MARKETING dir> <report.md>"""
import glob
import os
import re
import sys

from PIL import Image

root, report = sys.argv[1], sys.argv[2]
folders = ['01_IRLY_MIXTE_IMAGES', '02_IRLY_GIRL_IMAGES', '03_IRLY_NETWORK_IMAGES', '04_TIKTOK_SLIDESHOW']
files = [f for d in folders for f in sorted(glob.glob(os.path.join(root, d, '*.png')))]


def dhash(path, size=16):
    im = Image.open(path).convert('L').resize((size + 1, size), Image.LANCZOS)
    px = list(im.getdata())
    bits = 0
    for y in range(size):
        for x in range(size):
            bits = (bits << 1) | (px[y * (size + 1) + x] > px[y * (size + 1) + x + 1])
    return bits


lines = ['# Contrôle qualité des images', '', '| Fichier | Dimensions | Poids | Statut |', '| --- | --- | --- | --- |']
hashes = {}
ok = True
for f in files:
    im = Image.open(f)
    size_ok = im.size == (1080, 1920)
    ok &= size_ok
    hashes[f] = dhash(f)
    lines.append(f'| {os.path.relpath(f, root)} | {im.size[0]} × {im.size[1]} | {os.path.getsize(f) // 1024} Ko | {"OK" if size_ok else "DIMENSIONS"} |')

lines += ['', '## Quasi-doublons (distance de hachage < 40 sur 256)', '']
near = []
fs = list(hashes)
for i in range(len(fs)):
    for j in range(i + 1, len(fs)):
        d = bin(hashes[fs[i]] ^ hashes[fs[j]]).count('1')
        if d < 40:
            near.append(f'- {os.path.basename(fs[i])} / {os.path.basename(fs[j])} : {d}')
lines += near or ['Aucun.']

lines += ['', '## Photos utilisées par plus d’une image', '']
uses = {}
for html in glob.glob(os.path.join(root, '_source/images/*.html')):
    for photo in set(re.findall(r'assets/photos/([\w-]+\.jpg)', open(html).read())):
        uses.setdefault(photo, []).append(os.path.basename(html))
multi = [f'- {p} : {", ".join(sorted(v))}' for p, v in sorted(uses.items()) if len(v) > 1]
lines += multi or ['Aucune : chaque photo n’apparaît que dans une image.']
lines += ['', f'Images : {len(files)} · dimensions toutes conformes : {"oui" if ok else "non"}']
open(report, 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
