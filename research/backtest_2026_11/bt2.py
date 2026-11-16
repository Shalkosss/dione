import pandas as pd, numpy as np, warnings
warnings.filterwarnings('ignore')
px=pd.read_pickle('px.pkl'); U=pd.read_csv('universe.csv').set_index('sym')
idx=px['SPY'].index
pit=pd.read_csv('pit.csv',parse_dates=['date'])
pit['set']=pit.tickers.map(lambda s:set(x.strip().replace('.','-') for x in s.split(',')))
names=sorted(t for t in set().union(*pit['set']) if t in px)
snap=pd.DataFrame([{t:True for t in r.set if t in px} for r in pit.itertuples()],index=pit.date).reindex(columns=names).fillna(False).astype(bool)
snap=snap[~snap.index.duplicated(keep='last')]
M=snap.reindex(snap.index.union(idx)).ffill().reindex(idx).fillna(False).astype(bool)
def panel(col): return pd.DataFrame({s:px[s][col] for s in names}).reindex(idx)
A=panel('a'); C=panel('c'); f=A/C; H=panel('h')*f; L=panel('l')*f
spy=px['SPY']['a'].reindex(idx)
sec=U['GICS Sector'].reindex(names)
elig=(M & A.shift(260).notna() & A.notna())
print('miembros elegibles por fecha:',elig.sum(1).iloc[[400,1500,2500,3500,-1]].tolist())
mom12=A.shift(21)/A.shift(252)-1; mom6=A.shift(21)/A.shift(126)-1
hi52=A.rolling(252).max(); d52=A/hi52
s50=A.rolling(50).mean(); s200=A.rolling(200).mean()
above=(A>s200); gc=(s50>s200)
prev=gc.shift(1,fill_value=False).astype(bool)
cross=gc&~prev
pos=np.arange(len(idx))[:,None]
last_cross=pd.DataFrame(np.where(cross.values,pos,np.nan),index=idx,columns=names).ffill()
gcAge=(pos-last_cross).where(gc)
d=A.diff(); up=d.clip(lower=0).ewm(alpha=1/14,adjust=False).mean(); dn=(-d.clip(upper=0)).ewm(alpha=1/14,adjust=False).mean(); rsi=100-100/(1+up/dn)
pc=A.shift(1); TR=np.maximum(H-L,np.maximum((H-pc).abs(),(L-pc).abs())); atr=TR.ewm(alpha=1/14,adjust=False).mean()
def xr(df): return df.where(elig).rank(axis=1,pct=True)
def z(df):
    x=df.where(elig); return x.sub(x.mean(1),axis=0).div(x.std(1),axis=0).clip(-3,3)
momr=xr(mom12)
Z=lambda: pd.DataFrame(0.0,index=idx,columns=names)
gcp=Z(); gcp[gc]=8; gcp[gcAge<180]=15; gcp[gcAge<90]=22; gcp[gcAge<30]=30
dist=1-d52; dp=Z(); dp[dist<=.25]=5; dp[dist<=.15]=10; dp[dist<=.05]=13; dp[dist<=.01]=15
mp=Z(); mp[momr>=.5]=5; mp[momr>=.6]=10; mp[momr>=.8]=15; mp[momr>=.9]=18
rp=Z()+3; rp[(rsi<40)&gc]=8; rp[(rsi>=40)&(rsi<65)]=10; rp[(rsi>=65)&(rsi<=75)]=8; rp[rsi>75]=2
v3=gcp+dp+mp+rp
v4=(z(mom12)+z(mom6)+z(d52))/3
sig={'mom12_1':mom12,'mom6_1':mom6,'dist52wHigh':d52,'RSI14':rsi,'GC puntos v3':gcp,'TrendTrack v3 (réplica)':v3,'Compuesto v4':v4}
me=pd.Series(idx,index=idx).groupby([idx.year,idx.month]).last().values
me=[t for t in me if t>=pd.Timestamp('2012-01-01')]
print('\n=== A. Rank IC mensual vs retorno futuro (miembros S&P500 point-in-time)')
for hz in (21,63,126):
    F=A.shift(-hz)/A-1; print(f'-- horizonte {hz}d')
    for k,S in sig.items():
        ics=[]
        for t in me:
            a=S.loc[t].where(elig.loc[t]); b=F.loc[t]; m=a.notna()&b.notna()
            if m.sum()>100: ics.append(a[m].rank().corr(b[m].rank()))
        ics=np.array(ics); neff=len(ics)/(hz/21)
        print(f'{k:26s} IC={ics.mean():+.3f} t={ics.mean()/(ics.std()/np.sqrt(neff)):+.2f} %>0={100*(ics>0).mean():.0f} | IC 2019+={ics[-94:].mean():+.3f}')
F63=A.shift(-63)/A-1
def buckets(lbl,cd,F=F63,adj=3):
    rows={k:[] for k in cd}; ns={k:[] for k in cd}
    for t in me:
        fx=F.loc[t]; e=elig.loc[t]&fx.notna(); base=fx[e].mean()
        for k,c in cd.items():
            m=c.loc[t]&e
            if m.sum()>=5: rows[k].append(fx[m].mean()-base); ns[k].append(m.sum())
    print(lbl)
    for k,v in rows.items():
        v=np.array(v)
        if len(v)<10: print(f'   {k:36s} n insuficiente'); continue
        print(f'   {k:36s} exceso 63d={100*v.mean():+.2f}%  t={v.mean()/(v.std()/np.sqrt(len(v)/adj)):+.2f}  nombres/mes={np.mean(ns[k]):.0f}')
print('\n=== B. Exceso a 63d vs promedio del universo')
buckets('Estado de tendencia:',{'precio > SMA200':above,'precio < SMA200':(~above)&s200.notna(),'GC fresco <30d (30 pts v3)':gcAge<30,'GC 30-90d (22 pts)':(gcAge>=30)&(gcAge<90),'GC 90-180d (15 pts)':(gcAge>=90)&(gcAge<180),'GC viejo >180d (8 pts)':gcAge>=180,'sin GC (0 pts)':(~gc)&s200.notna()})
q3=xr(v3); q4=xr(v4)
buckets('Quintiles:',{'v3 Q5':q3>=.8,'v3 Q1':q3<.2,'v4 Q5 (top 20%)':q4>=.8,'v4 Q4':(q4>=.6)&(q4<.8),'v4 Q3':(q4>=.4)&(q4<.6),'v4 Q2':(q4>=.2)&(q4<.4),'v4 Q1 (bottom 20%)':q4<.2,'v4 top 5%':q4>=.95,'v4 Q5 y >SMA200':(q4>=.8)&above})
blend=sum(A/A.shift(k)-1 for k in (21,63,126,252))/4
secm=blend.where(elig).T.groupby(sec).mean().T; secrank=secm.rank(axis=1,ascending=False)
hasS=sec.notna()
top3=pd.DataFrame({s:(secrank[sec[s]]<=3 if hasS[s] else False) for s in names},index=idx)
bot3=pd.DataFrame({s:(secrank[sec[s]]>=9 if hasS[s] else False) for s in names},index=idx)
buckets('Momentum sectorial (blend 1/3/6/12m):',{'top-3 sectores':top3,'bottom-3 sectores':bot3,'top-3 sect. y v4 Q5':top3&(q4>=.8),'fuera top-3 y v4 Q5':(~top3)&(q4>=.8)})
print('Spread tercio sup-inf de v4 dentro de cada sector (63d):')
for sname in sorted(sec.dropna().unique()):
    cols=sec.index[sec==sname]; sp=[]
    for t in me:
        e=elig.loc[t,cols]; fx=F63.loc[t,cols]; s=v4.loc[t,cols]; m=fx.notna()&s.notna()&e
        if m.sum()>=12:
            r=s[m].rank(pct=True); sp.append(fx[m][r>=2/3].mean()-fx[m][r<1/3].mean())
    sp=np.array(sp); print(f'   {sname:24s} {100*sp.mean():+.2f}%  t={sp.mean()/(sp.std()/np.sqrt(len(sp)/3)):+.2f}')
# defensivos: retorno mensual medio por sector cuando SPY<SMA200
spy200=spy>spy.rolling(200).mean()
mret=pd.DataFrame({t1:(A.loc[t1]/A.loc[t]-1).where(elig.loc[t]) for t,t1 in zip(me[:-1],me[1:])}).T
secret=mret.T.groupby(sec).mean().T; ew=mret.mean(1); bear=~spy200.reindex(me[:-1]).values
print('Meses con SPY<SMA200 al inicio: %d de %d. Exceso mensual medio por sector en esos meses:'%(bear.sum(),len(bear)))
print('   '+'  '.join(f'{k[:12]}={100*(secret[k][bear]-ew[bear]).mean():+.2f}%' for k in secret.columns))
print('\n=== C. Carteras equal-weight, rebalanceo mensual, 10 bps por lado')
def run(pick,regime=False):
    rets=[];prev=set()
    for i in range(len(me)-1):
        t,t1=me[i],me[i+1]; hold=pick(t)
        if not hold: rets.append(0.0);continue
        r=(A.loc[t1,hold]/A.loc[t,hold]-1).fillna(0).mean()
        to=1-len(prev&set(hold))/len(hold); r-=to*0.002
        if regime and not spy200.loc[t]: r=0.5*r
        rets.append(r);prev=set(hold)
    return pd.Series(rets,index=me[1:])
def topn(score,n=20,mask=None,maxsec=None):
    def p(t):
        s=score.loc[t].where(elig.loc[t])
        if mask is not None: s=s.where(mask.loc[t])
        s=s.dropna().sort_values(ascending=False)
        if maxsec is None: return list(s.index[:n])
        res=[];cnt={}
        for k in s.index:
            g=sec[k] if isinstance(sec[k],str) else 'NA'
            if cnt.get(g,0)<maxsec: res.append(k);cnt[g]=cnt.get(g,0)+1
            if len(res)==n: break
        return res
    return p
S={'SPY':pd.Series([spy.loc[me[i+1]]/spy.loc[me[i]]-1 for i in range(len(me)-1)],index=me[1:]),
   'Universo equal-weight (PIT)':run(lambda t:list(elig.columns[elig.loc[t]])),
   'v3 TrendTrack top20':run(topn(v3+v4*0.001)),
   'v4 top20':run(topn(v4)),
   'v4 top50':run(topn(v4,n=50)),
   'v4 top20, máx 5/sector':run(topn(v4,maxsec=5)),
   'v4 top20 sólo top-3 sectores':run(topn(v4,mask=top3)),
   'v4 top20 máx5/sector + régimen 50%':run(topn(v4,maxsec=5),regime=True),
   'Universo EW + régimen 50%':run(lambda t:list(elig.columns[elig.loc[t]]),regime=True)}
def stats(r):
    eq=(1+r).cumprod(); yrs=len(r)/12; cagr=eq.iloc[-1]**(1/yrs)-1; vol=r.std()*np.sqrt(12); dd=(eq/eq.cummax()-1).min()
    return cagr,vol,(r.mean()*12-0.02)/vol,dd
for k,r in S.items():
    c,v,sh,dd=stats(r); a=stats(r[:'2018-12-31']); b=stats(r['2019-01-01':]); y22=(1+r['2022-01-01':'2022-12-31']).prod()-1
    print(f'{k:36s} CAGR={100*c:5.1f}% vol={100*v:4.1f}% Sharpe={sh:4.2f} maxDD={100*dd:6.1f}% | 2012-18={100*a[0]:5.1f}% 2019-26={100*b[0]:5.1f}% | 2022={100*y22:+.0f}%')
h=topn(v4)(me[-1]); print('v4 top20 hoy:',h)
pd.to_pickle(dict(A=A,H=H,L=L,atr=atr,s50=s50,s200=s200,rsi=rsi,momr=momr,elig=elig,above=above,q4=q4),'panels.pkl')
