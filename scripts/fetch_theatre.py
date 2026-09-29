"""One-time step: build the Theatre relief backdrop from Terrarium elevation tiles
(AWS Open Data, zoom 5). Output is a styled, dark shaded-relief PNG plus a coarse
Int16 elevation grid for the cursor readout. Coastline comes from the elevation
itself; no political boundaries are drawn.

    python3 scripts/fetch_theatre.py
"""
import io, json, math, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image

Z = 5
WEST, EAST, SOUTH, NORTH = 66.0, 99.0, 5.0, 38.0
OUT = Path(__file__).resolve().parent.parent / 'public' / 'theatre'
OUT.mkdir(parents=True, exist_ok=True)

def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**Z

x0, x1 = int(tx(WEST)), int(tx(EAST))
y0, y1 = int(ty(NORTH)), int(ty(SOUTH))
mosaic = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), dtype=np.float32)
for x in range(x0, x1 + 1):
    for y in range(y0, y1 + 1):
        cache = Path(__file__).resolve().parent / '.cache' / f'terrarium-{Z}-{x}-{y}.png'
        if not cache.exists():
            cache.parent.mkdir(parents=True, exist_ok=True)
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
            cache.write_bytes(urllib.request.urlopen(url).read())
        img = np.asarray(Image.open(cache).convert('RGB')).astype(np.float32)
        h = img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768
        mosaic[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = h
        print('tile', x, y)

# crop to the exact bbox (mercator pixel space)
px = lambda lon: int(round((tx(lon) - x0) * 256))
py = lambda lat: int(round((ty(lat) - y0) * 256))
e = mosaic[py(NORTH):py(SOUTH), px(WEST):px(EAST)]
e = np.asarray(Image.fromarray(e).resize((e.shape[1] * 2, e.shape[0] * 2), Image.BICUBIC)).astype(np.float32)
H, W = e.shape

# hillshade (NW light), styled for a dark UI
gy, gx = np.gradient(e)
cell = 40075016 * math.cos(math.radians(22)) / (512 * 2**Z)
slope = np.arctan(np.hypot(gx, gy) / cell * 5)
aspect = np.arctan2(-gx, gy)
az, alt = math.radians(315), math.radians(40)
shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
land = e > 0
elev = np.clip(e / 5500, 0, 1)
elev = elev ** 0.6
base = np.stack([30 + elev * 72, 38 + elev * 76, 47 + elev * 80], -1)
lit = base * (0.32 + 1.1 * shade[..., None])
sea = np.array([7, 10, 14], dtype=np.float32)
depth = np.clip(-e / 4000, 0, 1)[..., None]
sea_rgb = sea * (1 - depth * 0.15)
rgb = np.where(land[..., None], lit, sea_rgb)
# faint coastline from the land mask
edge = land ^ np.roll(land, 1, 0) | land ^ np.roll(land, 1, 1)
rgb[edge] = [96, 118, 138]
Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(OUT / 'relief.png', optimize=True)

grid = np.asarray(Image.fromarray(e).resize((W // 4, H // 4), Image.BILINEAR)).astype(np.int16)
(OUT / 'elev.bin').write_bytes(grid.tobytes())
json.dump({'bbox': {'west': WEST, 'east': EAST, 'south': SOUTH, 'north': NORTH}, 'projection': 'web-mercator',
           'width': W, 'height': H, 'elevWidth': grid.shape[1], 'elevHeight': grid.shape[0],
           'source': 'Terrarium elevation tiles (AWS Open Data, SRTM/GMTED/ETOPO), zoom 5'},
          open(OUT / 'relief.json', 'w'), indent=2)
print('relief', W, H)
