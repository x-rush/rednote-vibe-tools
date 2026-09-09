// All public times are seconds on the audio output timeline, not render-ahead time.
export function outputTime(context, eventTime=performance.now(), now=performance.now()) {
  const at=Number.isFinite(eventTime)&&Math.abs(eventTime-now)<1000?eventTime:now;
  try {
    const stamp=context.getOutputTimestamp?.();
    if(stamp&&stamp.contextTime>0&&stamp.performanceTime>0&&Math.abs(now-stamp.performanceTime)<1000){
      return Math.max(0,Math.min(context.currentTime,stamp.contextTime+(at-stamp.performanceTime)/1000));
    }
  } catch { /* Older browsers still have an audio clock and manual calibration. */ }
  const latency=Math.min(.5,Math.max(0,context.baseLatency||0)+Math.max(0,context.outputLatency||0));
  return Math.max(0,context.currentTime-latency+(at-now)/1000);
}

export function medianOffset(samples){
  if(samples.length<8)return null;
  const sorted=samples.filter(Number.isFinite).sort((a,b)=>a-b);
  if(sorted.length<8)return null;
  const middle=sorted.slice(2,-2);
  if(middle.at(-1)-middle[0]>100)return null;
  const value=Math.round((sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.ceil((sorted.length-1)/2)])/10)*5;
  return Math.abs(value)<=250?value:null;
}
