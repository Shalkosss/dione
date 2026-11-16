import pandas as pd, numpy as np, subprocess, time, json
from concurrent.futures import ThreadPoolExecutor
def curl(url): return subprocess.run(['curl','-s','-m','40','-A','Mozilla/5.0',url],capture_output=True,text=True).stdout
best=None
for f in ['sp500hist/S&P 500 Historical Components & Changes (Updated).csv','sp500hist/S&P 500 Historical Components & Changes.csv']:
    d=pd.read_csv(f); d['date']=pd.to_datetime(d['date']); print(f[-40:],d.date.min().date(),d.date.max().date(),len(d))
    if best is None or d.date.max()>best.date.max(): best=d
d=best[best.date>='2011-01-01'].copy()
d['set']=d.tickers.map(lambda s:set(x.strip().replace('.','-') for x in s.split(',')))
allt=set().union(*d['set']); print('tickers históricos 2011+:',len(allt),'| último snapshot',d.date.max().date(),len(d['set'].iloc[-1]))
d[['date','tickers']].to_csv('pit.csv',index=False)
px=pd.read_pickle('px.pkl'); miss=sorted(allt-set(px)); print('sin precio aún:',len(miss))
p1=int(pd.Timestamp('2010-06-01').timestamp()); p2=int(time.time())
def get(s):
    for k in range(3):
        try:
            host='query1' if k%2==0 else 'query2'
            j=json.loads(curl(f'https://{host}.finance.yahoo.com/v8/finance/chart/{s}?period1={p1}&period2={p2}&interval=1d&events=div%2Csplit'))['chart']
            if j.get('error'): return s,None
            j=j['result'][0]; q=j['indicators']['quote'][0]
            df=pd.DataFrame({'o':q['open'],'h':q['high'],'l':q['low'],'c':q['close'],'v':q['volume'],'a':j['indicators']['adjclose'][0]['adjclose']},index=pd.to_datetime(j['timestamp'],unit='s').normalize())
            return s,df.dropna(subset=['c','a'])
        except Exception as e: time.sleep(2+2*k)
    return s,None
got=0
with ThreadPoolExecutor(4) as ex:
    for s,df in ex.map(get,miss):
        if df is not None and len(df)>300: px[s]=df; got+=1
print('recuperados:',got,'de',len(miss)); pd.to_pickle(px,'px.pkl')
# cobertura: % de miembros con precio en cada fecha
cov=[(r.date,np.mean([ (t in px and px[t].index[0]<=r.date<=px[t].index[-1]) for t in r.set])) for r in d.iloc[::120].itertuples()]
print('cobertura de miembros con precio:',[(str(a)[:7],round(b,2)) for a,b in cov])
