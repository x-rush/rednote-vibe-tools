import numpy as np,json
z=np.load('assets/source/beat-analysis.npz');env=z['env'];dt=float(z['dt']);best=[]
for bpm in np.arange(94,99,.01):
 period=60/bpm
 for phase in np.arange(0,period,.005):
  times=np.arange(phase+period*12,118,period);val=np.interp(times/dt,np.arange(len(env)),env).mean();best.append((float(val),float(bpm),float(phase)))
print(json.dumps(sorted(best,reverse=True)[:12]))
