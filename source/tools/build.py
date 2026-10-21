import json,glob,os
B='/home/claude/s2'
chs=[];qs=[]
for f in sorted(glob.glob(B+'/bank/ch*.json'),key=lambda x:int(x.split('ch')[-1].split('.')[0])):
    d=json.load(open(f))
    chs.append({k:d[k] for k in ['ch','title','short','summary','cards']})
    for q in d['questions']:
        q=dict(q); q['ch']=d['ch']; q.setdefault('sc',0); qs.append(q)
ex=json.load(open(B+'/bank/extras.json'))
data={'meta':ex['meta'],'pairs':ex['pairs'],'chapters':chs,'questions':qs}
js='window.DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';'
html=open(B+'/app/index.html').read()
html=html.replace('/*CSS*/',open(B+'/app/style.css').read()).replace('/*DATA*/',js.replace('</','<\\/')).replace('/*APP*/',open(B+'/app/app.js').read())
os.makedirs(B+'/dist',exist_ok=True)
open(B+'/dist/index.html','w').write(html)
json.dump(data,open(B+'/dist/questions.json','w'),ensure_ascii=False,indent=1)
print('built',len(qs),'questions',len(html)//1024,'KB')
