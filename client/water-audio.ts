import * as T from 'three';
import type {WaterSound} from '../shared/water';
// One shared noise buffer, at most 12 short voices, and inexpensive stereo panning.
export function waterAudio(camera:T.Camera){
 let context:AudioContext|undefined,noise:AudioBuffer|undefined,enabled=localStorage.getItem('water-muted')!=='1',voices=0,played=0,lastKind='';
 const forward=new T.Vector3();
 function unlock(){if(!enabled)return;context??=new AudioContext();if(context.state==='suspended')void context.resume().catch(()=>{});if(!noise){noise=context.createBuffer(1,Math.ceil(context.sampleRate*.3),context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);}}
 function update(){if(!context)return;const l=context.listener;camera.getWorldDirection(forward);l.positionX.value=camera.position.x;l.positionY.value=camera.position.y;l.positionZ.value=camera.position.z;l.forwardX.value=forward.x;l.forwardY.value=forward.y;l.forwardZ.value=forward.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
 return{unlock,update,get enabled(){return enabled;},toggle(){enabled=!enabled;localStorage.setItem('water-muted',enabled?'0':'1');if(enabled)unlock();return enabled;},
  play(v:WaterSound){if(!enabled||!context||context.state!=='running'||voices>=12)return;update();const c=context,t=c.currentTime,duration=v.kind==='reload'?.24:v.kind==='device'?.28:v.kind==='shot'?.14:.10,gain=c.createGain(),filter=c.createBiquadFilter(),panner=c.createPanner();panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=2;panner.maxDistance=50;panner.rolloffFactor=1;panner.positionX.value=v.x;panner.positionY.value=v.y;panner.positionZ.value=v.z;
   filter.type='lowpass';filter.frequency.value=v.kind==='step'?450:v.kind==='reload'?1100:1900;const volume=v.kind==='step'?(v.walk?.015:.05):v.kind==='shot'?.065:.04;gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);filter.connect(gain);gain.connect(panner);panner.connect(c.destination);
   let source:AudioScheduledSourceNode;if(v.kind==='pickup'||v.kind==='device'){const oscillator=c.createOscillator();oscillator.type='sine';oscillator.frequency.setValueAtTime(v.kind==='device'?520:680,t);oscillator.frequency.exponentialRampToValueAtTime(240,t+duration);source=oscillator;}else{const buffer=c.createBufferSource();buffer.buffer=noise!;buffer.playbackRate.value=v.kind==='step'?.7:v.kind==='reload'?1.2:1.6;source=buffer;}source.connect(filter);voices++;played++;lastKind=v.kind;source.onended=()=>{voices--;source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};source.start(t);source.stop(t+duration);
  },diagnostic:()=>({enabled,unlocked:context?.state==='running',voices,limit:12,played,lastKind}),dispose:()=>{void context?.close();},
 };
}
