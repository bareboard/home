#!/usr/bin/env python3
"""Transparent evidence scoring for sourced articles.

This is an auditable deterministic research layer, not a fabricated AI forecast.
It exposes why an item is ranked before any future self-hosted model is added.
"""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
feed=json.loads((ROOT/'data'/'daily-articles.json').read_text())
SIGNALS={'policy':['ban','quota','export','license','tariff','regulation'],'supply':['mine','project','processing','refinery','smelter','production'],'market':['price','demand','supply','offtake','investment'],'aggregates':['aggregate','quarry','sand','gravel','crushed stone','infrastructure']}
for item in ([feed.get('live_article')] if feed.get('live_article') else []) + feed.get('articles',[]):
 text=(item.get('title','')+' '+item.get('summary','')).lower()
 hits={key:sum(term in text for term in terms) for key,terms in SIGNALS.items()}
 item['research_signal']=max(hits,key=hits.get)
 item['evidence_score']=min(100,item.get('authority',0)*10+sum(hits.values())*6)
 item['confidence']='high' if item['authority']>=8 else ('medium' if item['authority']>=6 else 'developing')
(ROOT/'data'/'daily-articles.json').write_text(json.dumps(feed,indent=2,ensure_ascii=False))
print('Evidence fields written for',len(feed.get('articles',[])),'articles')
