import pandas as pd, numpy as np, warnings
warnings.filterwarnings('ignore')
P=pd.read_pickle('panels.pkl'); A,H,L,atr,s50,s200,rsi,momr,elig,above=[P[k] for k in ['A','H','L','atr','s50','s200','rsi','momr','elig','above']]
idx=A.index; start=pd.Timestamp('2012-01-01')
ok=elig&(pd.Series(idx>=start,index=idx).values[:,None])
ewF={k:(A.shift(-k)/A-1).where(elig) for k in (20,60)}
base={k:v.mean(1) for k,v in ewF.items()}
leader=ok&above&(s200>s200.shift(20))&(momr>=.6)
ext=(A/s50).rolling(20).max().shift(1)>=1.08
zone=((A/s50)>=0.97)&((A/s50)<=1.03)
lo60=L.rolling(60).min().shift(1); hi252=A.rolling(252).max()
ev={ 'Cualquier día (base)':ok,
     'Cualquier día de un líder':leader,
     'Pullback a SMA50 en líder':leader&zone&ext,
     'RSI<40 en líder':leader&(rsi<40),
     'Nuevo máximo 52s en líder':leader&(A>=hi252),
     'Soporte: undercut mín 60d y cierre arriba, BAJO SMA200':ok&~above&(L<lo60)&(A>=lo60),
     'Soporte: undercut mín 60d y cierre arriba, SOBRE SMA200':ok&above&(L<lo60)&(A>=lo60),
     'RSI<30 bajo SMA200 (cuchillo cayendo)':ok&~above&(rsi<30),
     'Bajo SMA200 cualquiera':ok&~above&s200.notna()}
def dedupe(m,gap=20):
    v=m.values.copy(); 
    for j in range(v.shape[1]):
        col=v[:,j]; last=-10**9
        for i in np.flatnonzero(col):
            if i-last<gap: col[i]=False
            else: last=i
    return pd.DataFrame(v,index=m.index,columns=m.columns)
Av,Hv,Lv,ATv=A.values,H.values,L.values,atr.values
ym=idx.year*100+idx.month
rng=np.random.default_rng(7)
print(f"{'evento':56s} {'n':>7s} | exc20d  t   | exc60d   t   %>0 | 2.5R: gana  stop  timeout  E[R] | 2019+: exc60d")
for k,m in ev.items():
    if 'Cualquier' in k or k=='Bajo SMA200 cualquiera':
        v=m.values.copy(); keep=rng.random(v.shape)<0.03; mm=pd.DataFrame(v&keep,index=idx,columns=A.columns)
    else: mm=dedupe(m)
    ii,jj=np.nonzero(mm.values); res=[]
    line=f'{k:56s} {len(ii):7d} |'
    for hz in (20,60):
        x=ewF[hz].values[ii,jj]-base[hz].values[ii]; g=~np.isnan(x)
        s=pd.Series(x[g]).groupby(ym[ii][g]).mean(); t=s.mean()/(s.std()/np.sqrt(len(s)/(hz/20)))
        line+=f' {100*np.nanmean(x):+5.2f}% {t:+5.2f} |' if hz==20 else f' {100*np.nanmean(x):+5.2f}% {t:+5.2f} {100*np.mean(x[g]>0):3.0f}% |'
        if hz==60: x60=x; late=idx[ii]>=pd.Timestamp('2019-01-01')
    w=s_=to=0; Rs=[]
    for i,j in zip(ii,jj):
        if i+60>=len(idx) or np.isnan(ATv[i,j]): continue
        e=Av[i,j]; r=2*ATv[i,j]; stop=e-r; tgt=e+2.5*r
        h=Hv[i+1:i+61,j]; l=Lv[i+1:i+61,j]
        hs=np.flatnonzero(l<=stop); ht=np.flatnonzero(h>=tgt)
        a=hs[0] if len(hs) else 999; b=ht[0] if len(ht) else 999
        if a==999 and b==999: to+=1; Rs.append((Av[i+60,j]-e)/r if not np.isnan(Av[i+60,j]) else 0)
        elif a<=b: s_+=1; Rs.append(-1)
        else: w+=1; Rs.append(2.5)
    n=w+s_+to
    line+=f' {100*w/n:4.0f}% {100*s_/n:4.0f}% {100*to/n:5.0f}%  {np.mean(Rs):+.2f} | {100*np.nanmean(x60[late]):+5.2f}%'
    print(line)
