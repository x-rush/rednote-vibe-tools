"""Development-only UVR MDX inference; ONNX data, no model-provided Python code."""
import sys,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'test-results/audio-tools'))
import numpy as np, soundfile as sf, onnxruntime as ort
model=root/'test-results/UVR_MDXNET_Main.onnx'
raw=model.read_bytes();model_hash=hashlib.md5(raw[-10000*1024:]).hexdigest()
metadata=json.loads((root/'test-results/model-metadata.json').read_text(encoding='utf-8-sig'))
assert model_hash in metadata,('Unknown model hash',model_hash)
c=metadata[model_hash];N=c['mdx_n_fft_scale_set'];F=c['mdx_dim_f_set'];T=2**c['mdx_dim_t_set'];hop=1024
assert c['primary_stem']=='Vocals',c
print('Verified UVR model metadata',c,flush=True)
opts=ort.SessionOptions();opts.intra_op_num_threads=4
sess=ort.InferenceSession(str(model),sess_options=opts,providers=['CPUExecutionProvider']);print(sess.get_inputs()[0].shape,flush=True)
x,sr=sf.read(root/'test-results/mix-stereo.wav',dtype='float32',always_2d=True);assert sr==44100
x=x.T;window=np.hanning(N+1)[:-1].astype('float32');chunk=hop*(T-1);trim=N//2;step=chunk-2*trim

def stft(a):
 a=np.pad(a,((0,0),(N//2,N//2)),mode='reflect');frames=np.lib.stride_tricks.sliding_window_view(a,N,axis=-1)[:,::hop,:]
 z=np.fft.rfft(frames*window,axis=-1).transpose(0,2,1)
 return z

def istft(z):
 frames=np.fft.irfft(z.transpose(0,2,1),n=N,axis=-1)*window
 length=(frames.shape[1]-1)*hop+N;out=np.zeros((2,length));den=np.zeros(length)
 for i in range(frames.shape[1]):out[:,i*hop:i*hop+N]+=frames[:,i];den[i*hop:i*hop+N]+=window**2
 out/=np.maximum(den,1e-8)
 return out[:,N//2:-N//2]
# Independent round-trip ensures no resampling/time shifts in the adapter.
test=x[:,:chunk];assert np.max(np.abs(test-istft(stft(test))))<1e-5
padded=np.pad(x,((0,0),(trim,chunk)));parts=[]
for start in range(0,x.shape[1],step):
 block=padded[:,start:start+chunk];z=stft(block)
 features=np.stack((z.real,z.imag),axis=1).reshape(4,N//2+1,T)[:,:F,:][None].astype('float32')
 result=sess.run(None,{sess.get_inputs()[0].name:features})[0][0]
 result=result.reshape(2,2,F,T);zs=result[:,0]+1j*result[:,1];zs=np.pad(zs,((0,0),(0,N//2+1-F),(0,0)))
 parts.append(istft(zs)[:,trim:-trim]);print('separated',round(min(x.shape[1],start+step)/sr,1),'seconds',flush=True)
vocals=np.concatenate(parts,axis=1)[:,:x.shape[1]]*c['compensate'];instrumental=x-vocals
sf.write(root/'test-results/vocals.wav',vocals.T,sr,subtype='FLOAT');sf.write(root/'test-results/instrumental.wav',instrumental.T,sr,subtype='FLOAT')
(root/'design/separation-report.json').write_text(json.dumps({'model':'UVR_MDXNET_Main.onnx','modelTailMd5':model_hash,'sha256':hashlib.sha256(raw).hexdigest(),'metadata':c,'samples':x.shape[1],'sampleRate':sr,'reconstructionMaxError':float(np.max(np.abs(x-vocals-instrumental)))},indent=2))
