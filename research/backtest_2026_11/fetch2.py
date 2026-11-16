import pandas as pd, numpy as np, subprocess, time, io, json
from concurrent.futures import ThreadPoolExecutor
def curl(url):
    return subprocess.run(['curl','-s','-m','40','-A','Mozilla/5.0',url],capture_output=True,text=True).stdout
t=pd.read_html(io.StringIO(curl('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies')))[0]
t['sym']=t['Symbol'].str.replace('.','-',regex=False)
t[['sym','GICS Sector','GICS Sub-Industry','Date added']].to_csv('universe.csv',index=False)
syms=list(t['sym'])+['SPY','QQQ','RSP']
p1=int(pd.Timestamp('2010-06-01').timestamp()); p2=int(time.time())
def get(s):
    for k in range(4):
        try:
            host='query1' if k%2==0 else 'query2'
            j=json.loads(curl(f'https://{host}.finance.yahoo.com/v8/finance/chart/{s}?period1={p1}&period2={p2}&interval=1d&events=div%2Csplit'))['chart']['result'][0]
            q=j['indicators']['quote'][0]
            df=pd.DataFrame({'o':q['open'],'h':q['high'],'l':q['low'],'c':q['close'],'v':q['volume'],'a':j['indicators']['adjclose'][0]['adjclose']},index=pd.to_datetime(j['timestamp'],unit='s').normalize())
            return s,df.dropna(subset=['c','a'])
        except Exception as e: time.sleep(2+2*k)
    return s,None
out={}
with ThreadPoolExecutor(4) as ex:
    for s,df in ex.map(get,syms):
        if df is not None and len(df)>300: out[s]=df
print('ok',len(out),'de',len(syms),'faltan',[s for s in syms if s not in out][:30])
pd.to_pickle(out,'px.pkl'); print(out['SPY'].tail(2)); print(out['SPY'].index[0])
