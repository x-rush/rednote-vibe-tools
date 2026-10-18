import wave,numpy as np,json
with wave.open('assets/source/analysis.wav') as w: sr=w.getframerate();x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float)/32768
hop=220;size=2048
frames=np.lib.stride_tricks.sliding_window_view(x,size)[::hop];spec=np.abs(np.fft.rfft(frames*np.hanning(size),axis=1));freq=np.fft.rfftfreq(size,1/sr)
lo=spec[:,(freq>35)&(freq<190)].sum(axis=1);flux=np.maximum(0,np.diff(np.log1p(spec[:,freq<6000]),axis=0)).sum(axis=1);env=np.maximum(0,np.diff(lo));env=env/(np.std(env)+1e-6)+flux/(np.std(flux)+1e-6);dt=hop/sr
scores=[]
for bpm in np.arange(85,110,.05):
 period=60/bpm;lag=period/dt;idx=np.arange(len(env)-int(lag)-1);corr=np.mean(env[idx]*np.interp(idx+lag,np.arange(len(env)),env));scores.append((corr,float(bpm)))
bpm=max(scores)[1];period=60/bpm
phaseScores=[]
for phase in np.arange(0,period,.002):
 times=np.arange(phase,125,period);v=np.interp(times/dt,np.arange(len(env)),env);phaseScores.append((float(v.mean()),float(phase)))
phase=max(phaseScores)[1];print(json.dumps({'bpm':bpm,'phase':phase,'top':sorted(scores,reverse=True)[:5],'duration':len(x)/sr,'rmsSections':[(i,round(float(np.sqrt(np.mean(x[i*sr:(i+4)*sr]**2))),3)) for i in range(0,130,4)]}))
np.savez('assets/source/beat-analysis.npz',env=env,dt=dt)
