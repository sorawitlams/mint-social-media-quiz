import json,glob,sys,collections
bank=[]; chs=[]
for f in sorted(glob.glob('/home/claude/s2/bank/ch*.json'),key=lambda x:int(x.split('ch')[-1].split('.')[0])):
    d=json.load(open(f)); chs.append(d)
    for q in d['questions']:
        q['ch']=d['ch']; bank.append(q)
errs=[]; ids=set(); longest=0; lv=collections.Counter(); sc=0
for q in bank:
    for k in ['id','lv','lo','q','c','ex','w','pg','ev']:
        if k not in q: errs.append((q.get('id'),'missing',k))
    if q['id'] in ids: errs.append((q['id'],'dup id'))
    ids.add(q['id'])
    if len(q['c'])!=4: errs.append((q['id'],'choices',len(q['c'])))
    if len(set(q['c']))!=4: errs.append((q['id'],'dup choice'))
    if len(q['w'])!=3: errs.append((q['id'],'why',len(q['w'])))
    L=[len(c) for c in q['c']]
    if L[0]==max(L) and L.count(max(L))==1: longest+=1
    lv[q['lv']]+=1; sc+=q.get('sc',0)
    for c in q['c']:
        if 'ถูกทุกข้อ' in c or 'ไม่มีข้อใดถูก' in c: errs.append((q['id'],'all/none'))
print('total',len(bank),'per ch',collections.Counter(q['ch'] for q in bank))
print('levels',lv,'scenario',sc)
print('correct is longest:',longest, f'{longest/len(bank):.0%}')
print('errors',errs)
