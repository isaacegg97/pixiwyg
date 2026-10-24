// SECTION: sound
let ac=null;
function audio(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume()}
function tone(f1,f2,dur,type,vol=.08){const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+dur+.02)}
function noise(dur,freq,vol=.25){const t=ac.currentTime,b=ac.createBuffer(1,ac.sampleRate*dur,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)**2;const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;fl.type='lowpass';fl.frequency.value=freq;g.gain.value=vol;s.connect(fl).connect(g).connect(ac.destination);s.start(t)}
function sfx(k){if(!state.sound||!ac)return;try{({pop:()=>tone(500,1300,.09,'square',.06),boing:()=>{tone(160,520,.25,'triangle',.12)},blip:()=>tone(900,600,.06,'square',.05),click:()=>tone(320,180,.04,'square',.05),hiss:()=>noise(.18,6000,.08),glug:()=>tone(700,140,.3,'sine',.12),boom:()=>{noise(1.2,500,.6);tone(120,30,.8,'sawtooth',.15)},whoosh:()=>noise(.25,1800,.15)})[k]()}catch(e){}}

