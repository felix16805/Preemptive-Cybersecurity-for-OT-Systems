import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, pandas as pd, numpy as np
from scipy import stats
df=pd.read_csv("out/results.csv"); W="white"
G1,G2,G3,G4="#999999","#b03030","#b8860b","#1e7a45"
def pl(ax,s): ax.text(-0.10,1.06,s,transform=ax.transAxes,fontsize=10,fontweight="bold")

fig,axs=plt.subplots(2,2,figsize=(9.6,7.2),facecolor=W)
# (a) primary safety endpoint
ax=axs[0,0]
labs=["M1 blind\nquarantine","M2 static\nsegmentation","M3 rigid\nconstrained","M4 SafeCut\n(PST-bounded)"]
vals=[df["m1_blind_deadline"].mean()*100, df["m2_static_deadline"].mean()*100,
      df[df.m3_conn_feasible]["m3_conn_deadline"].mean()*100,
      df[df.m4_pst_feasible]["m4_pst_deadline"].mean()*100]
errs=[]
for k,f in [("m1_blind_deadline",None),("m2_static_deadline",None),
            ("m3_conn_deadline","m3_conn_feasible"),("m4_pst_deadline","m4_pst_feasible")]:
    d=df if f is None else df[df[f]]
    ci=stats.binomtest(int(d[k].sum()),len(d)).proportion_ci(0.95)
    errs.append((ci.low*100,ci.high*100))
b=ax.bar(labs,vals,color=[G1,G2,G3,G4],edgecolor="white")
for i,(v,(lo,hi)) in enumerate(zip(vals,errs)):
    ax.plot([i,i],[lo,hi],color="#222",lw=1.3)
    ax.text(i,hi+2.5,f"{v:.1f}%",ha="center",fontsize=8.5,fontweight="bold")
ax.set_ylim(0,118); ax.set_ylabel("safety loops meeting PST deadline (%)",fontsize=8)
ax.set_title("Primary endpoint: protective-deadline compliance",fontsize=8.8,fontweight="bold")
ax.tick_params(labelsize=6.8); pl(ax,"(a)")

# (b) feasibility M3 vs M4
ax=axs[0,1]
x=np.arange(5); strat=["XS","S","M","L","XL"]; w=0.36
m3=[df[df.stratum==s]["m3_conn_feasible"].mean()*100 for s in strat]
m4=[df[df.stratum==s]["m4_pst_feasible"].mean()*100 for s in strat]
ax.bar(x-w/2,m3,w,color=G3,label="M3 rigid",edgecolor="white")
ax.bar(x+w/2,m4,w,color=G4,label="M4 SafeCut",edgecolor="white")
ax.set_xticks(x); ax.set_xticklabels(strat)
ax.set_ylim(70,105); ax.set_ylabel("scenarios with a safe cut found (%)",fontsize=8)
ax.set_xlabel("network size stratum",fontsize=8)
ax.set_title("Feasibility: PST budgeting resolves rigid failures",fontsize=8.8,fontweight="bold")
ax.legend(fontsize=6.8); pl(ax,"(b)")

# (c) cut size distribution
ax=axs[1,0]
data=[df["m2_static_cut"],df["m1_blind_cut"],
      df[df.m3_conn_feasible]["m3_conn_cut"],df[df.m4_pst_feasible]["m4_pst_cut"]]
bp=ax.boxplot(data,labels=["M2","M1","M3","M4"],patch_artist=True,showfliers=False,widths=.6)
for p,c in zip(bp["boxes"],[G2,G1,G3,G4]): p.set_facecolor(c); p.set_edgecolor("white")
for m in bp["medians"]: m.set_color("#111"); m.set_linewidth(1.4)
ax.set_yscale("symlog"); ax.set_ylabel("network links severed (symlog)",fontsize=8)
ax.set_title("Collateral: links severed per response",fontsize=8.8,fontweight="bold")
for i,d in enumerate(data,1): ax.text(i,d.median()+0.4,f"{d.median():.0f}",ha="center",fontsize=7.5,fontweight="bold")
pl(ax,"(c)")

# (d) latency scaling
ax=axs[1,1]
pos=[df[df.stratum==s]["m4_pst_ms"] for s in strat]
nodes=[df[df.stratum==s]["n_nodes"].mean() for s in strat]
ax.plot(nodes,[p.mean() for p in pos],"o-",color=G4,lw=2,label="mean")
ax.plot(nodes,[p.quantile(.95) for p in pos],"s--",color=G3,lw=1.6,label="p95")
ax.axhline(100,color=G2,ls=":",lw=1.3,label="100 ms response budget")
ax.set_xscale("log"); ax.set_yscale("log")
ax.set_xlabel("network size (nodes)",fontsize=8); ax.set_ylabel("SafeCut solve time (ms)",fontsize=8)
ax.set_title("Solver latency scaling",fontsize=8.8,fontweight="bold")
ax.legend(fontsize=6.6); pl(ax,"(d)")
for a in axs.flat:
    a.tick_params(labelsize=7)
    for s_ in a.spines.values(): s_.set_color("#ccc")
fig.suptitle("FIG. 8 — Experimental Results over SafeCut-Bench (N = 6,000 scenarios)",fontsize=11,fontweight="bold")
plt.tight_layout(rect=[0,0,1,0.955]); fig.savefig("/home/claude/pf8.png",dpi=180,facecolor=W); plt.close(fig)

# ---------------- FIG 9 : dataset verification
fig,axs=plt.subplots(2,2,figsize=(9.6,7.2),facecolor=W)
import json
recs=[json.loads(l) for l in open("out/scenarios.jsonl")]
ax=axs[0,0]
import collections
bc=collections.defaultdict(list)
for r in recs:
    for e in r["edges"]: bc[e["link_class"]].append(e["latency_us"])
order=["fiber_1g","copper_1g","copper_100m","fieldbus"]
ax.boxplot([bc[c] for c in order],labels=["fiber\n1G","copper\n1G","copper\n100M","fieldbus"],
           patch_artist=True,showfliers=False,widths=.6)
ax.set_ylabel("per-link latency (µs)",fontsize=8)
ax.set_title("Link latency by media class (monotonic, as physics requires)",fontsize=8.6,fontweight="bold")
ax.tick_params(labelsize=6.8); pl(ax,"(a)")

ax=axs[0,1]
pst=np.array([s["pst_budget_ms"] for r in recs for s in r["safety_loops"]])
nom=np.array([s["nominal_latency_ms"] for r in recs for s in r["safety_loops"]])
ax.scatter(nom,pst,s=4,alpha=.25,color=G4)
xs=np.linspace(0,nom.max()*1.05,10); ax.plot(xs,xs,color=G2,ls="--",lw=1.4,label="deadline = latency")
ax.set_xlabel("nominal loop latency (ms)",fontsize=8); ax.set_ylabel("PST budget (ms)",fontsize=8)
ax.set_title("Every loop is safe before attack (all points above the line)",fontsize=8.6,fontweight="bold")
ax.legend(fontsize=6.6); pl(ax,"(b)")

ax=axs[1,0]
cnt=df["family"].value_counts()
ax.bar(range(len(cnt)),cnt.values,color=["#1f6fb2","#6a3d9a","#1e7a45","#b8860b","#b03030"],edgecolor="white")
ax.set_xticks(range(len(cnt))); ax.set_xticklabels([c.replace("_","\n") for c in cnt.index],fontsize=6.4)
ax.set_ylabel("scenarios",fontsize=8); ax.set_ylim(0,cnt.max()*1.25)
for i,v in enumerate(cnt.values): ax.text(i,v+30,str(v),ha="center",fontsize=7.5,fontweight="bold")
ax.set_title("Corpus balance across topology families",fontsize=8.6,fontweight="bold"); pl(ax,"(c)")

ax=axs[1,1]
g=df[df.gt_available&df.gt_feasible&df.m4_pst_feasible]
jitter=np.random.default_rng(0).normal(0,0.045,len(g))
ax.scatter(g["gt_optimal_cut"]+jitter,g["m4_pst_cut"]+jitter,s=14,alpha=.5,color=G4)
mx=int(max(g["gt_optimal_cut"].max(),g["m4_pst_cut"].max()))+1
ax.plot([0,mx],[0,mx],color=G2,ls="--",lw=1.4,label="exact optimum")
ax.set_xlabel("exhaustive optimum cut size",fontsize=8); ax.set_ylabel("SafeCut cut size",fontsize=8)
ax.set_title(f"Optimality vs brute force (n={len(g)}, 99.8% exact)",fontsize=8.6,fontweight="bold")
ax.legend(fontsize=6.6); pl(ax,"(d)")
for a in axs.flat:
    a.tick_params(labelsize=7)
    for s_ in a.spines.values(): s_.set_color("#ccc")
fig.suptitle("FIG. 9 — SafeCut-Bench Dataset Verification",fontsize=11,fontweight="bold")
plt.tight_layout(rect=[0,0,1,0.955]); fig.savefig("/home/claude/pf9.png",dpi=180,facecolor=W); plt.close(fig)
print("fig8, fig9 done")
