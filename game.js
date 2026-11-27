const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const startPanel = document.getElementById('start');
const overPanel = document.getElementById('gameover');
const toast = document.getElementById('toast');

let W=0,H=0,DPR=1, running=false, last=0, score=0, lives=3, distance=0, speed=0;
let car, enemies=[], particles=[], stars=[], keys={left:false,right:false}, roadOffset=0;
let spawnTimer=0, invincible=0, multiplier=1, comboTimer=0;

function resize(){
  DPR=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight;
  canvas.width=W*DPR; canvas.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  car ||= {x:0,y:0,w:34,h:64}; car.y=H*.78; car.x=car.x||W/2;
}
addEventListener('resize',resize); resize();

function roadGeometry(){
  const horizon=H*.27, bottom=W*.48, top=W*.15;
  return {horizon,bottom,top,cx:W/2};
}
function roadAt(y){
  const r=roadGeometry(), t=Math.max(0,Math.min(1,(y-r.horizon)/(H-r.horizon)));
  const eased=t*t*(3-2*t); return {left:r.cx-(r.top+(r.bottom-r.top)*eased)/2,right:r.cx+(r.top+(r.bottom-r.top)*eased)/2,width:r.top+(r.bottom-r.top)*eased};
}

function makeStars(){ stars=[]; for(let i=0;i<110;i++) stars.push({x:Math.random()*W,y:Math.random()*H,z:Math.random(),a:.15+Math.random()*.5}); }
makeStars();

function resetLives(){ livesEl.innerHTML=''; for(let i=0;i<3;i++){const b=document.createElement('span');b.className='life'+(i>=lives?' empty':'');livesEl.appendChild(b);} }
resetLives();

function start(){
  running=true; score=0; lives=3; distance=0; speed=250; enemies=[]; particles=[]; spawnTimer=.7; invincible=1.5; multiplier=1; comboTimer=0;
  car.x=W/2; car.y=H*.78; startPanel.classList.add('hidden');overPanel.classList.add('hidden');resetLives();updateHud();
}

document.getElementById('play').onclick=start;
document.getElementById('retry').onclick=start;

addEventListener('keydown',e=>{ if(['ArrowLeft','a','A'].includes(e.key)){keys.left=true;e.preventDefault()} if(['ArrowRight','d','D'].includes(e.key)){keys.right=true;e.preventDefault()} if(e.key==='Enter'&&!running)start(); });
addEventListener('keyup',e=>{ if(['ArrowLeft','a','A'].includes(e.key))keys.left=false;if(['ArrowRight','d','D'].includes(e.key))keys.right=false; });
document.querySelectorAll('.pad').forEach(p=>{const k=p.dataset.key;const on=e=>{e.preventDefault();keys[k]=true};const off=e=>{e.preventDefault();keys[k]=false};p.addEventListener('pointerdown',on);p.addEventListener('pointerup',off);p.addEventListener('pointercancel',off);p.addEventListener('pointerleave',off);});

function updateHud(){scoreEl.textContent=String(Math.floor(score)).padStart(6,'0');}
function showToast(t){toast.textContent=t;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),650);}

function spawnEnemy(){
  const lane=Math.floor(Math.random()*3);
  const r=roadGeometry();
  const progress=.04+Math.random()*.08;
  const rd=roadAt(r.horizon+(H-r.horizon)*progress);
  const laneX=rd.left+(rd.width*(lane+.5)/3);
  enemies.push({x:laneX,lane,y:r.horizon-20,w:28,h:52,progress,type:Math.random()<.18?'blocker':'car',passed:false,hue:Math.random()<.5?'pink':'cyan',phase:Math.random()*6});
}

function burst(x,y,color,count=18){
  for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=60+Math.random()*260;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+Math.random()*.7,max:.9,color,size:1+Math.random()*3});}
}

function update(dt){
  if(!running)return;
  speed=Math.min(520,250+distance*.022);
  distance+=speed*dt;
  score+=dt*(speed*.08)*multiplier;
  roadOffset=(roadOffset+speed*dt)%90;
  invincible=Math.max(0,invincible-dt);
  comboTimer=Math.max(0,comboTimer-dt);if(comboTimer===0)multiplier=1;

  const steer=(keys.left?-1:0)+(keys.right?1:0);
  car.x+=steer*430*dt;
  const rd=roadAt(car.y);car.x=Math.max(rd.left+22,Math.min(rd.right-22,car.x));

  spawnTimer-=dt;if(spawnTimer<=0){spawnEnemy();spawnTimer=Math.max(.38,1.05-distance/18000)+Math.random()*.28;}

  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];e.progress+=speed*dt*.00072*(e.type==='blocker'?1.12:1);
    const horizon=roadGeometry().horizon;
    const y=e.progress*(H-horizon)+horizon;
    const rd=roadAt(y);const perspective=.42+e.progress*.58;
    e.y=y;e.w=(e.type==='blocker'?38:28)*perspective;e.h=(e.type==='blocker'?34:52)*perspective;
    e.x=rd.left+rd.width*(e.lane+.5)/3;

    if(!e.passed&&e.y>car.y+35){
      e.passed=true;
      if(Math.abs(e.x-car.x)<78){score+=100*multiplier;multiplier=Math.min(5,multiplier+1);comboTimer=1.8;showToast('NEAR MISS  +'+100*multiplier);}
      else score+=25;
    }

    const dx=Math.abs(e.x-car.x),dy=Math.abs(e.y-car.y);
    if(dx<(e.w+car.w*.55)/2&&dy<(e.h+car.h*.52)/2&&invincible<=0){
      enemies.splice(i,1);lives--;invincible=1.2;burst(car.x,car.y,'#ff3aa7',28);updateHud();
      if(lives<=0)endGame();
    }else if(e.y>H+100)enemies.splice(i,1);
  }

  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.98;p.vy*=.98;if(p.life<=0)particles.splice(i,1);}
  updateHud();
}
function endGame(){
  running=false;burst(car.x,car.y,'#65d9ff',42);
  const final=Math.floor(score),old=Number(localStorage.getItem('neonDriftBest')||0);
  if(final>old)localStorage.setItem('neonDriftBest',final);
  document.getElementById('finalScore').textContent=String(final).padStart(6,'0');
  document.getElementById('recordText').textContent=final>old?'NEW PERSONAL BEST':'BEST  '+String(Math.max(final,old)).padStart(6,'0');
  setTimeout(()=>overPanel.classList.remove('hidden'),420);
}

function drawGrid(){
  const r=roadGeometry();
  ctx.fillStyle='#090a12';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#0d1020';ctx.fillRect(0,r.horizon,W,H-r.horizon);

  for(const s of stars){ctx.globalAlpha=s.a;ctx.fillStyle='#9bcaff';ctx.fillRect(s.x,s.y,s.z*s.z*2,s.z*s.z*2);}ctx.globalAlpha=1;

  ctx.strokeStyle='rgba(87,142,199,.16)';ctx.lineWidth=1;
  for(let i=0;i<16;i++){const p=((i/16+roadOffset/1440)%1);const y=r.horizon+(H-r.horizon)*p*p;ctx.beginPath();ctx.moveTo(r.cx-r.bottom/2,y);ctx.lineTo(r.cx+r.bottom/2,y);ctx.stroke();}
  for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(r.cx+i*r.top/12,r.horizon);ctx.lineTo(r.cx+i*r.bottom/12,H);ctx.stroke();}

  ctx.strokeStyle='rgba(101,217,255,.45)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(r.cx-r.top/2,r.horizon);ctx.lineTo(r.cx-r.bottom/2,H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(r.cx+r.top/2,r.horizon);ctx.lineTo(r.cx+r.bottom/2,H);ctx.stroke();

  ctx.setLineDash([18,28]);ctx.lineDashOffset=-roadOffset;ctx.strokeStyle='rgba(255,58,167,.22)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(r.cx-r.bottom/6,H);ctx.lineTo(r.cx-r.top/6,r.horizon);ctx.stroke();ctx.beginPath();ctx.moveTo(r.cx+r.bottom/6,H);ctx.lineTo(r.cx+r.top/6,r.horizon);ctx.stroke();ctx.setLineDash([]);
}

function drawCar(x,y,w,h,color='#65d9ff',enemy=false){
  ctx.save();ctx.translate(x,y);
  ctx.shadowBlur=enemy?10:24;ctx.shadowColor=color;
  ctx.fillStyle='#10131e';ctx.strokeStyle=color;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-w*.42,h*.35);ctx.lineTo(-w*.5,-h*.18);ctx.lineTo(-w*.28,-h*.5);ctx.lineTo(w*.28,-h*.5);ctx.lineTo(w*.5,-h*.18);ctx.lineTo(w*.42,h*.35);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=color;ctx.globalAlpha=.18;ctx.fillRect(-w*.38,-h*.28,w*.76,h*.42);ctx.globalAlpha=1;
  ctx.fillStyle=enemy?'#ff6bb7':'#ff3aa7';ctx.fillRect(-w*.34,h*.22,w*.18,5);ctx.fillRect(w*.16,h*.22,w*.18,5);
  if(!enemy){ctx.fillStyle='#d9f7ff';ctx.globalAlpha=.7;ctx.fillRect(-w*.18,-h*.34,w*.36,h*.14);ctx.globalAlpha=1;}
  ctx.restore();
}

function draw(){
  drawGrid();
  for(const e of enemies){const color=e.hue==='pink'?'#ff3aa7':'#65d9ff';drawCar(e.x,e.y,e.w,e.h,color,true);}
  if(running||lives>0)drawCar(car.x,car.y,34,64,invincible>0&&Math.floor(invincible*10)%2?'#71869a':'#65d9ff');
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowBlur=8;ctx.shadowColor=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;ctx.shadowBlur=0;
}

function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);
