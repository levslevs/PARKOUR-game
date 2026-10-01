#!/usr/bin/env python3
"""Build the published game, or an offline HTML with --portable. Python 3.10+."""
from pathlib import Path
import argparse, base64, json, re

# Paths are relative to this file, so the project can be moved or renamed.
ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'src'
OUT = ROOT
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT/'parkour-enemies.html', help='Write the self-contained HTML to this path.')
args = parser.parse_args()
SOURCE = WORK / 'game-base.js'

def replace_once(source, old, new):
    count = source.count(old)
    if count != 1:
        raise ValueError(f'Expected one source marker, found {count}: {old[:110]!r}. '
                         'Check the matching transformation in scripts/parkour/build.py after editing game-base.js.')
    return source.replace(old, new, 1)


def function_span(source, name):
    m = re.search(r'  function '+re.escape(name)+r'\s*\(', source)
    assert m, name
    start = source.index('{', m.end())
    depth, quote, comment, escape, i = 0, None, None, False, start
    while i < len(source):
        ch, nxt = source[i], source[i:i+2]
        if comment == '//':
            if ch == '\n': comment = None
        elif comment == '/*':
            if nxt == '*/': comment = None; i += 1
        elif quote:
            if escape: escape = False
            elif ch == '\\': escape = True
            elif ch == quote: quote = None
        elif nxt in ('//', '/*'):
            comment = nxt; i += 1
        elif ch in ('"', "'", '`'): quote = ch
        elif ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0: return m.start(), i+1
        i += 1
    raise RuntimeError(name)

script = SOURCE.read_text(encoding='utf-8')
for name in ('draw', 'drawHud', 'boostBar', 'drawSkyline', 'drawItem', 'drawEnemy',
             'drawTitleScene', 'drawPlayer', 'drawGuy', 'buildShop', 'buildLegend', 'showPanels', 'buildLevel', 'bindPad', 'key', 'loop'):
    a,b = function_span(script,name)
    script = script[:a] + script[b:]

skins = json.loads((WORK/'characters.json').read_text(encoding='utf-8'))
script = re.sub(r'  var SKINS = \[.*?\n  \];', '  var SKINS = '+json.dumps(skins)+';', script, count=1, flags=re.S)
script = replace_once(script, "label:'Ⓗ coin', help:'buy skins'", "label:'Gold coin', help:'+1 coin for your character collection.'")
script = replace_once(script, "label:'Speed',   help:'run super fast'", "label:'Speed boost', help:'Run faster for about 7 seconds.'")
script = replace_once(script, "label:'Big jump',help:'jump way higher'", "label:'High jump', help:'Jump higher for about 7 seconds.'")
script = replace_once(script, "label:'Extra life', help:'one more heart'", "label:'Extra heart', help:'Restore a heart, up to five.'")
script = replace_once(script, "label:'Star',    help:'3 coins! way up high'", "label:'Sky star', help:'+3 coins. Take the high route.'")

meta = json.loads((WORK/'sprite-metadata.json').read_text(encoding='utf-8'))
sources = {k:'data:image/png;base64,'+base64.b64encode((OUT/'assets'/f'{k}.png').read_bytes()).decode() for k in meta}
assets = '\n  var ASSET_SRC = '+json.dumps(sources)+';\n  var CHARACTER_ART = '+json.dumps(meta)+';\n'+(WORK/'asset-loader.js').read_text(encoding='utf-8')+'\n'
script = replace_once(script, '  var W = 760, H = 560;', '  var W = 760, H = 560;'+assets)
script = replace_once(script, '  var LOW = 430, HIGH = 310, SKY = 190;   // the three lanes\n  var PITCH = 196, PW = 126;', '')
script = replace_once(script, 'p.inv = 90; p.onGround = false;', 'p.inv = 90; p.onGround = false; p.coyote = 0; p.jumpBuffer = 0;')
script = replace_once(script, '    if(keys.jumpTap && p.coyote > 0){ p.vy = jmp; p.coyote = 0; p.onGround = false; }', '''    if(keys.jumpTap) p.jumpBuffer = 7;
    if(p.jumpBuffer > 0 && p.coyote > 0){
      p.vy = jmp; p.coyote = 0; p.onGround = false; p.jumpBuffer = 0;
    } else if(p.jumpBuffer > 0) p.jumpBuffer--;''')
script = replace_once(script, '''          if(!G.checkpoint || q.x + 4 > G.checkpoint.x){
            G.checkpoint = {x: Math.min(Math.max(p.x, q.x+4), q.x+q.w-p.w-4), y: q.y - p.h - 2};
          }''', '''          if(!G.checkpoint || q.x > (G.checkpoint.platformX === undefined ? -1 : G.checkpoint.platformX)){
            G.checkpoint = {x:q.x+32, y:q.y-p.h-2, platformX:q.x};
          }''')

extra = '\n'.join((WORK/name).read_text(encoding='utf-8') for name in ('level-layout.js','world-renderer.js','character-renderer.js','ui-upgrades.js','touch-support.js','render-support.js'))
script = replace_once(script, '  /* ---------- boot ---------- */',extra+'\n  /* ---------- boot ---------- */')
script = replace_once(script, '    showPanels(); loop();', '    showPanels(); startAssetLoading(); loop();')

css = (WORK/'theme.css').read_text(encoding='utf-8')
shell = (WORK/'shell.html').read_text(encoding='utf-8')
html = '''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#111c32">
<meta name="description" content="A playful island-hopping adventure. Choose your path, collect coins, and meet the Soft 3D crew.">
<title>Parkour Enemies — Soft 3D</title>
<style>'''+css+'''\n</style></head><body data-parkour-release="polish-v2">'''+shell+'''\n<script>'''+script+'''\n</script></body></html>'''
target = args.output.resolve()
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(html, encoding='utf-8', newline='\n')
print('Built', target, f'({len(html)/1000000:.2f} MB)')
