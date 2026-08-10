#!/usr/bin/env python3
"""Build the UMS LIVE sector heatmap from live benchmark and evidence data."""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
market=json.loads((ROOT/'data'/'market-snapshot.json').read_text())
feed=json.loads((ROOT/'data'/'daily-articles.json').read_text())
SECTORS=[
 ('Battery Materials',['lithium','cobalt','nickel'],28),
 ('Copper & Grid',['copper'],23),
 ('Rare Earths & Magnets',['rare-earths'],18),
 ('Graphite & Anodes',['graphite'],15),
 ('Processing & Refining',['cobalt','nickel','lithium','rare-earths'],14),
 ('Construction Aggregates',['aggregates'],10),
 ('Strategic Minor Minerals',['gallium'],8),
]
def num(value):
 try:return float(str(value).replace('+','').replace('−','-').replace('%','').replace('Watch','0'))
 except:return 0.0
bench={b['topic']:b for b in market['benchmarks']}
articles=([feed.get('live_article')] if feed.get('live_article') else [])+feed.get('articles',[])
out=[]
for name,topics,base in SECTORS:
 vals=[num(bench[t]['change']) for t in topics if t in bench]
 momentum=round(sum(vals)/len(vals),2) if vals else 0.0
 evidence=sum((a.get('evidence_score',0) for a in articles if a and a.get('topic') in topics))
 weight=base+min(8,evidence/100)
 out.append({'name':name,'topics':topics,'signal_weight':weight,'momentum':momentum,'evidence_score':round(evidence/len(topics),1) if topics else 0})
total=sum(x['signal_weight'] for x in out)
for x in out:x['signal_weight']=round(x['signal_weight']/total*100,2)
out.sort(key=lambda x:x['signal_weight'],reverse=True)
(ROOT/'data'/'sector-heatmap.json').write_text(json.dumps({'generated_at':market['generated_at'],'sectors':out,'method':'signal weight combines named sector relevance, current benchmark movement and sourced evidence'},indent=2))
print('Wrote',len(out),'sector heatmap records')
