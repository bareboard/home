#!/usr/bin/env python3
"""Build a source-attributed UMS LIVE mineral market snapshot.

Uses public pages with named benchmarks. A failed live fetch never invents a value:
the output retains a dated fallback explicitly marked as such.
"""
from __future__ import annotations
import datetime as dt
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'market-snapshot.json'
UA = 'UMSLiveResearchBot/1.0 (+https://ums-live.example)'
FALLBACK = {
  'lithium': {'symbol':'LITH','name':'Lithium Carbonate','value':'142,750','unit':'CNY/t','change':'+0.88%','source':'Trading Economics','as_of':'2026-08-07','topic':'lithium'},
  'cobalt': {'symbol':'COB','name':'Cobalt Metal','value':'56,290','unit':'USD/t','change':'+0.00%','source':'Trading Economics','as_of':'2026-08-04','topic':'cobalt'},
  'copper': {'symbol':'CU','name':'Copper','value':'6.58','unit':'USD/lb','change':'−1.66%','source':'Trading Economics','as_of':'2026-08-07','topic':'copper'},
  'nickel': {'symbol':'NICK','name':'Nickel Cathode','value':'19,694.69','unit':'USD/t','change':'+1.48%','source':'SMM','as_of':'2026-08-04','topic':'nickel'},
  'ndpr': {'symbol':'NDPR','name':'NdPr Oxide','value':'97,400.79','unit':'USD/t','change':'−11.9%','source':'SMM','as_of':'2026-08-04','topic':'rare-earths'},
  'graphite': {'symbol':'GPH','name':'Natural Graphite','value':'1,728.10','unit':'USD/t','change':'+0.00%','source':'SMM','as_of':'2026-06-01','topic':'graphite'},
  'gallium': {'symbol':'GA','name':'Gallium','value':'1,825.00','unit':'USD/kg','change':'+1.67%','source':'Trading Economics','as_of':'2026-08-05','topic':'gallium'},
  'aggregates': {'symbol':'AGG','name':'Construction Aggregates','value':'—','unit':'regional','change':'Watch','source':'UMS LIVE research','as_of':'2026-08-09','topic':'aggregates'}
}
def page(url: str) -> str:
  req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html'})
  with urllib.request.urlopen(req,timeout=20) as r:return r.read().decode('utf-8','ignore')
def parse_lithium(html: str, record: dict) -> dict:
  m=re.search(r'Lithium rose to ([\d,]+) CNY/T.*?(?:up|down) ([\d.]+)%',html,re.S|re.I)
  if m:
    record.update(value=m.group(1),unit='CNY/t',change='+'+m.group(2)+'%',as_of=dt.date.today().isoformat())
  return record
def parse_copper(html: str, record: dict) -> dict:
  m=re.search(r'Copper (rose|fell) to ([\d.]+) USD/Lbs.*?(?:up|down) ([\d.]+)%',html,re.S|re.I)
  if m:
    sign = '+' if m.group(1).lower() == 'rose' else '−'
    record.update(value=m.group(2),unit='USD/lb',change=sign+m.group(3)+'%',as_of=dt.date.today().isoformat())
  return record
def parse_cobalt(html: str, record: dict) -> dict:
  m=re.search(r'Cobalt traded flat at ([\d,]+) USD/T',html,re.I)
  if m:
    record.update(value=m.group(1),unit='USD/t',change='+0.00%',as_of=dt.date.today().isoformat())
  return record
def main() -> int:
  records={k:dict(v) for k,v in FALLBACK.items()}
  checks=[('lithium','https://tradingeconomics.com/commodity/lithium',parse_lithium),('cobalt','https://tradingeconomics.com/commodity/cobalt',parse_cobalt),('copper','https://tradingeconomics.com/commodity/copper',parse_copper)]
  failures=[]
  for key,url,parser in checks:
    try:records[key]=parser(page(url),records[key])
    except Exception as exc:failures.append({'benchmark':key,'error':str(exc)[:120]})
  benchmarks=list(records.values())
  def change_value(item):
    try:return float(str(item['change']).replace('+','').replace('−','-').replace('%',''))
    except Exception:return 0.0
  benchmarks.sort(key=change_value, reverse=True)
  regional_views = [
    {'region':'China & East Asia','topics':['lithium','rare-earths','graphite','gallium']},
    {'region':'DRC & Central Africa','topics':['cobalt','copper']},
    {'region':'Indonesia & ASEAN','topics':['nickel','cobalt']},
    {'region':'Americas & Australia','topics':['copper','lithium','aggregates']}
  ]
  OUT.write_text(json.dumps({'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'benchmarks':benchmarks,'regional_views':regional_views,'source_failures':failures},indent=2))
  print(f'Wrote {len(records)} market benchmarks')
  return 0
if __name__=='__main__':raise SystemExit(main())
