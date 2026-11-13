'use strict';

document.documentElement.classList.add('js');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const header = document.querySelector('.site-header');
const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 16);
window.addEventListener('scroll', updateHeader, {passive:true});
updateHeader();

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), {threshold:.06, rootMargin:'0px 0px -24px 0px'});
  revealItems.forEach((item) => observer.observe(item));
} else { revealItems.forEach((item) => item.classList.add('is-visible')); }

const videos = [...document.querySelectorAll('video')];
const synchronizePlayButton = (video) => {
  const button = video.closest('.film-card')?.querySelector('[data-play]');
  if (!button) return;
  const playing = !video.paused && !video.ended;
  button.textContent = playing ? '暂停播放' : '播放短片';
  button.setAttribute('aria-pressed', String(playing));
};
videos.forEach((video) => {
  video.addEventListener('play', () => {
    const card = video.closest('.film-card');
    if (card && !card.classList.contains('is-active')) { video.pause(); return; }
    videos.forEach((other) => { if (other !== video && !other.paused) other.pause(); });
    synchronizePlayButton(video);
  });
  ['pause','ended'].forEach((event) => video.addEventListener(event, () => synchronizePlayButton(video)));
});
document.addEventListener('visibilitychange', () => { if (document.hidden) videos.forEach((video) => video.pause()); });

document.querySelectorAll('[data-gallery]').forEach((gallery) => {
  const tabs = [...gallery.querySelectorAll('[role="tab"]')];
  const cards = [...gallery.querySelectorAll('.film-card')];
  const status = gallery.querySelector('.play-status');
  const choose = (index, focus = false) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    cards.forEach((card, i) => {
      const active = i === index;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-hidden', String(!active));
      card.inert = !active;
      card.dataset.rank = String((i - index + cards.length) % cards.length);
      if (!active) card.querySelector('video')?.pause();
    });
    gallery.querySelector('.deck-count').textContent = `${String(index + 1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
    if (status) status.textContent = '';
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => choose(index));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) {event.preventDefault(); choose(next, true);}
    });
  });
  gallery.querySelectorAll('[data-play]').forEach((button) => {
    const video = button.closest('.film-card').querySelector('video');
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', async () => {
      if (!video.paused && !video.ended) {video.pause(); return;}
      if (video.ended) video.currentTime = 0;
      try {await video.play(); if (status) status.textContent = '';}
      catch (error) {if (error.name !== 'AbortError' && status) status.textContent = '视频暂时无法播放，请稍后重试，或使用视频原生控件。';}
      synchronizePlayButton(video);
    });
  });
  choose(0);
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy)?.textContent;
    const status = button.parentElement.querySelector('.copy-status');
    try {
      if (!text || !navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      status.textContent = '已复制，可以粘贴给你的制作代理。';
    } catch {status.textContent = '请选中上面的指令文字，手动复制。';}
  });
});

/* A small, self-contained motion study. No video downloads or animation libraries. */
document.querySelectorAll('.art-canvas').forEach((canvas) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const holder = canvas.parentElement;
  const toggle = holder.querySelector('.motion-toggle');
  const knowledge = canvas.dataset.art === 'knowledge';
  let width = 1, height = 1, ratio = 1, paused = reducedMotion.matches, visible = true, frame = 0;
  let time = 0, previous = 0, pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  const colors = ['#684ef4','#3a75ee','#38bcd4','#73ce98','#f5d35f','#ff9b62','#f16a6b'];
  const path = (points) => {ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1])); ctx.closePath();};
  const rounded = (x,y,w,h,r) => {ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
  const project = (x,y,z,yaw,pitch) => {
    const x1=x*Math.cos(yaw)+z*Math.sin(yaw), z1=-x*Math.sin(yaw)+z*Math.cos(yaw);
    const y1=y*Math.cos(pitch)-z1*Math.sin(pitch), z2=y*Math.sin(pitch)+z1*Math.cos(pitch);
    const perspective=720/(720-z2);
    return [x1*perspective,y1*perspective,z2];
  };
  const science = (t) => {
    const yaw = -.34 + Math.sin(t*.24)*.13 + pointerX*.12;
    const pitch = -.09 + Math.cos(t*.2)*.04 + pointerY*.07;
    ctx.save();ctx.translate(0,16);
    ctx.save();ctx.translate(0,175);ctx.scale(1,.15);
    const shadow=ctx.createRadialGradient(0,0,5,0,0,190);shadow.addColorStop(0,'rgba(40,89,146,.18)');shadow.addColorStop(1,'rgba(40,89,146,0)');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,190,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.rotate(-.32);
    for(let ring=0;ring<3;ring++){
      ctx.beginPath();ctx.ellipse(0,5,228+ring*23,139+ring*15,0,0,Math.PI*2);ctx.strokeStyle=`rgba(88,139,184,${.12-ring*.025})`;ctx.lineWidth=1;ctx.stroke();
      const a=t*(.10+ring*.035)+ring*2.1;ctx.beginPath();ctx.arc(Math.cos(a)*(228+ring*23),5+Math.sin(a)*(139+ring*15),ring===0?4:2.8,0,Math.PI*2);ctx.fillStyle=ring===1?'#4175bb':'#7eb5d2';ctx.fill();
    }ctx.restore();
    const entry=[-62,14],exit=[60,4];
    const beam=ctx.createLinearGradient(-420,-44,entry[0],entry[1]);beam.addColorStop(0,'rgba(93,156,229,0)');beam.addColorStop(.45,'rgba(114,177,237,.12)');beam.addColorStop(1,'rgba(94,160,233,.5)');
    path([[-420,-69],[-420,-46],entry]);ctx.fillStyle=beam;ctx.fill();
    ctx.beginPath();ctx.moveTo(-390,-48);ctx.lineTo(...entry);ctx.strokeStyle='#9dc3ef';ctx.lineWidth=2.2;ctx.stroke();
    colors.forEach((color,i)=>{
      const endY=-90+i*39;
      const xEnd=395,shift=Math.sin(t*.45+i)*2;
      const grad=ctx.createLinearGradient(exit[0],exit[1],xEnd,endY);grad.addColorStop(0,color+'b8');grad.addColorStop(.7,color+'8e');grad.addColorStop(1,color+'00');
      path([[exit[0],exit[1]-3],[xEnd,endY-10+shift],[xEnd,endY+10+shift],[exit[0],exit[1]+3]]);ctx.fillStyle=grad;ctx.fill();
      ctx.beginPath();ctx.moveTo(...exit);ctx.lineTo(xEnd,endY+shift);ctx.strokeStyle=grad;ctx.lineWidth=2.3;ctx.stroke();
      const p=(t*.16+i*.11)%1;ctx.beginPath();ctx.arc(exit[0]+(xEnd-exit[0])*p,exit[1]+(endY-exit[1])*p,2.3,0,Math.PI*2);ctx.fillStyle=color;ctx.globalAlpha=1-p;ctx.fill();ctx.globalAlpha=1;
    });
    const verts=[[-125,115,-48],[0,-142,-48],[125,115,-48],[-125,115,74],[0,-142,74],[125,115,74]].map(p=>project(...p,yaw,pitch));
    const faces=[[0,1,2],[0,3,4,1],[1,4,5,2],[0,2,5,3],[3,5,4]].sort((a,b)=>a.reduce((s,i)=>s+verts[i][2],0)/a.length-b.reduce((s,i)=>s+verts[i][2],0)/b.length);
    faces.forEach((face,index)=>{
      path(face.map(i=>verts[i]));
      const glass=ctx.createLinearGradient(-130,-120,145,155);
      glass.addColorStop(0,index%2?'rgba(255,255,255,.84)':'rgba(156,206,249,.62)');glass.addColorStop(.5,'rgba(191,224,248,.3)');glass.addColorStop(1,index%2?'rgba(83,135,207,.55)':'rgba(225,243,255,.7)');ctx.fillStyle=glass;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=1.8;ctx.stroke();
    });
    ctx.beginPath();ctx.moveTo(...entry);ctx.lineTo(...exit);ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=4;ctx.stroke();
    const bloom=ctx.createRadialGradient(exit[0],exit[1],0,exit[0],exit[1],34);bloom.addColorStop(0,'rgba(255,255,255,.72)');bloom.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(...exit,34,0,Math.PI*2);ctx.fill();
    ctx.restore();
  };
  const tile = (x,y,w,h,rotation,color,depth,glyph,fontSize,ink='#242026') => {
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.shadowColor='rgba(72,43,36,.13)';ctx.shadowBlur=28;ctx.shadowOffsetY=20;
    rounded(-w/2+7,-h/2+depth,w,h,29);ctx.fillStyle=color;ctx.fill();ctx.shadowColor='transparent';
    rounded(-w/2,-h/2,w,h,29);ctx.fillStyle=color;ctx.fill();
    const gloss=ctx.createLinearGradient(0,-h/2,0,h/2);gloss.addColorStop(0,'rgba(255,255,255,.2)');gloss.addColorStop(.8,'rgba(255,255,255,0)');ctx.fillStyle=gloss;ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle=ink;ctx.font=`700 ${fontSize}px "Segoe UI","Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph,0,3);ctx.restore();
  };
  const knowledgeArt = (t) => {
    ctx.save();ctx.translate(pointerX*10,pointerY*6);
    ctx.save();ctx.translate(0,190);ctx.scale(1,.20);const shadow=ctx.createRadialGradient(0,0,20,0,0,225);shadow.addColorStop(0,'rgba(117,78,46,.12)');shadow.addColorStop(1,'rgba(117,78,46,0)');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,225,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.rotate(-.24);ctx.beginPath();ctx.ellipse(0,8,258,180,0,0,Math.PI*2);ctx.strokeStyle='rgba(127,105,91,.17)';ctx.lineWidth=1.2;ctx.stroke();
    for(let i=0;i<5;i++){const a=t*.12+i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*258,8+Math.sin(a)*180,4.3,0,Math.PI*2);ctx.fillStyle=['#e76343','#b295f3','#d3ab48','#94b0a4','#e76343'][i];ctx.fill();}ctx.restore();
    const lift=Math.sin(t*.7)*7;
    tile(-120,-68+lift,183,194,-.18+Math.sin(t*.25)*.025,'#b4a0f0',15,'文',93,'#38205e');
    ctx.save();ctx.translate(104,-65-Math.sin(t*.65)*9);ctx.rotate(.12+Math.sin(t*.3)*.03);ctx.shadowColor='rgba(173,77,46,.18)';ctx.shadowBlur=35;ctx.shadowOffsetY=20;
    const ball=ctx.createRadialGradient(-39,-42,7,12,23,127);ball.addColorStop(0,'#ffae83');ball.addColorStop(.45,'#ff8862');ball.addColorStop(1,'#dc4e32');ctx.fillStyle=ball;ctx.beginPath();ctx.arc(0,0,116,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';
    ctx.strokeStyle='#ffe5cd';ctx.lineWidth=9;ctx.beginPath();ctx.arc(-32,-8,29,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(36,13,29,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-7,3);ctx.lineTo(10,9);ctx.stroke();ctx.restore();
    tile(-15,112+Math.cos(t*.65)*7,220,157,.10+Math.sin(t*.22)*.024,'#f3cd53',15,'23',105,'#49350a');
    ctx.save();ctx.translate(183,126+Math.sin(t*.8)*5);ctx.rotate(t*.12);ctx.fillStyle='#7960c5';rounded(-24,-24,48,48,12);ctx.fill();ctx.restore();ctx.restore();
  };
  const draw = () => {
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    const unit=Math.min(width/650,height/555);
    ctx.translate(width*.51,height*.46);ctx.scale(unit,unit);
    if (knowledge) knowledgeArt(time);else science(time);
  };
  const tick = (stamp) => {
    frame=0;
    if (paused || !visible || document.hidden) {previous=0;return;}
    if(previous) time+=Math.min(stamp-previous,50)/1000;
    previous=stamp;pointerX+=(targetX-pointerX)*.04;pointerY+=(targetY-pointerY)*.04;draw();frame=requestAnimationFrame(tick);
  };
  const resume = () => {if (!frame && !paused && visible && !document.hidden) frame=requestAnimationFrame(tick);};
  const syncToggle = () => {toggle.textContent=paused?'播放动效':'暂停动效';toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'播放背景动效':'暂停背景动效');};
  const resize = () => {const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));draw();};
  holder.addEventListener('pointermove',event=>{const rect=holder.getBoundingClientRect();targetX=(event.clientX-rect.left)/rect.width*2-1;targetY=(event.clientY-rect.top)/rect.height*2-1;},{passive:true});
  holder.addEventListener('pointerleave',()=>{targetX=0;targetY=0;});
  toggle.addEventListener('click',()=>{paused=!paused;syncToggle();resume();});
  reducedMotion.addEventListener('change',()=>{paused=reducedMotion.matches;syncToggle();draw();resume();});
  document.addEventListener('visibilitychange',resume);
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume();},{rootMargin:'80px'}).observe(canvas);}
  if('ResizeObserver' in window){new ResizeObserver(resize).observe(canvas);}else window.addEventListener('resize',resize,{passive:true});
  resize();syncToggle();resume();
});

/* The method rows share one demand-driven loop. Exponential response gives both
   entry and exit a soft ~0.7 s settle, without shifting layout or restarting phases. */
const methodStates = [...document.querySelectorAll('.method-row')].map((row) => ({
  row,
  icon: row.querySelector('[data-icon-motion]'),
  hovered: false,
  focused: false,
  visible: !('IntersectionObserver' in window),
  weight: 0,
  phase: 0,
}));
let methodRequest = 0;
let methodPrevious = 0;
const drawMethod = (state) => {
  const {row, icon, weight: w, phase: phase} = state;
  row.style.setProperty('--method-active', w.toFixed(5));
  row.classList.toggle('is-motion-active', w > .001);
  if (!icon) return; // The audio bars retain their CSS keyframes, with weighted amplitude.
  const type = icon.dataset.iconMotion;
  if (type === 'question') {
    const angle = Math.sin(phase * Math.PI * 2 / 3.5) * 6 * w;
    const drift = Math.sin(phase * Math.PI * 2 / 3.5) * 2.5 * w;
    icon.style.transform = `translateX(${drift.toFixed(3)}px) rotate(${angle.toFixed(3)}deg)`;
  }
  if (type === 'atom') {
    const tilts = [-32, 32, 90];
    icon.querySelectorAll('[data-electron]').forEach((electron, i) => {
      const angle = phase * Math.PI * 2 / (4.9 + i * .45) + i * Math.PI * 2 / 3;
      const tilt = tilts[i] * Math.PI / 180;
      const x = 65 * Math.cos(angle), y = 25 * Math.sin(angle);
      electron.setAttribute('cx', (80 + x * Math.cos(tilt) - y * Math.sin(tilt)).toFixed(3));
      electron.setAttribute('cy', (65 + x * Math.sin(tilt) + y * Math.cos(tilt)).toFixed(3));
    });
  }
  if (type === 'color') {
    const directions = [[-1, 0], [.2, -1], [.85, .85]];
    icon.querySelectorAll('i').forEach((circle, i) => {
      const breath = Math.sin(phase * Math.PI * 2 / 4.2 + i * .38);
      const expansion = (9 + breath * 3) * w;
      const scale = 1 + (.025 + breath * .025) * w;
      circle.style.transform = `translate(${(directions[i][0] * expansion).toFixed(3)}px,${(directions[i][1] * expansion).toFixed(3)}px) scale(${scale.toFixed(4)})`;
    });
  }
  if (type === 'relation') {
    const points = [[29,29], [128,34], [78,105]];
    icon.querySelectorAll('[data-flow]').forEach((dot, i) => {
      // A continuous closed path: each particle travels through each relationship,
      // instead of teleporting from the far end of one edge back to its start.
      const travel = (phase / 5.7 + i / 3) % 1 * 3;
      const edge = Math.floor(travel), amount = travel - edge;
      const from = points[edge], to = points[(edge + 1) % 3];
      dot.setAttribute('cx', (from[0] + (to[0] - from[0]) * amount).toFixed(3));
      dot.setAttribute('cy', (from[1] + (to[1] - from[1]) * amount).toFixed(3));
      dot.setAttribute('opacity', (.94 * w).toFixed(4));
    });
  }
};
const methodTick = (stamp) => {
  methodRequest = 0;
  if (document.hidden || reducedMotion.matches) {methodPrevious = 0; return;}
  const dt = methodPrevious ? Math.min((stamp - methodPrevious) / 1000, .05) : 0;
  methodPrevious = stamp;
  let moving = false;
  methodStates.forEach((state) => {
    if (!state.visible) return;
    const target = state.hovered || state.focused ? 1 : 0;
    state.weight += (target - state.weight) * (1 - Math.exp(-dt / .22));
    if (target === 0 && state.weight < .001) state.weight = 0;
    if (target === 1 && state.weight > .999) state.weight = 1;
    // Velocity also eases. Atom electrons coast to their resting positions.
    state.phase += dt * state.weight;
    drawMethod(state);
    if (target || state.weight > 0) moving = true;
  });
  if (moving) methodRequest = requestAnimationFrame(methodTick);
  else methodPrevious = 0;
};
const wakeMethods = () => {
  if (!methodRequest && !reducedMotion.matches && !document.hidden && methodStates.some(s => s.visible && (s.hovered || s.focused || s.weight > 0))) {
    methodPrevious = 0;
    methodRequest = requestAnimationFrame(methodTick);
  }
};
methodStates.forEach((state) => {
  state.row.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    state.hovered = true;
    wakeMethods();
  });
  state.row.addEventListener('pointerleave', () => {state.hovered = false; wakeMethods();});
  state.row.addEventListener('focus', () => {state.focused = state.row.matches(':focus-visible'); wakeMethods();});
  state.row.addEventListener('blur', () => {state.focused = false; wakeMethods();});
  drawMethod(state);
});
if ('IntersectionObserver' in window) {
  const methodObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const state = methodStates.find(s => s.row === entry.target);
      if (!state) return;
      state.visible = entry.isIntersecting;
      state.row.classList.toggle('is-motion-visible', state.visible);
    });
    wakeMethods();
  }, {threshold:.05});
  methodStates.forEach(state => methodObserver.observe(state.row));
} else {methodStates.forEach(state => state.row.classList.add('is-motion-visible'));}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    cancelAnimationFrame(methodRequest); methodRequest = 0; methodPrevious = 0;
    methodStates.forEach(state => {state.weight = 0; drawMethod(state);});
  } else wakeMethods();
});
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('document-hidden', document.hidden);
  if (document.hidden) {cancelAnimationFrame(methodRequest); methodRequest = 0; methodPrevious = 0;}
  else wakeMethods();
});
