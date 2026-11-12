import React, {useLayoutEffect,useMemo} from 'react';
import {AbsoluteFill,Interactive,Track,useCurrentFrame,useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const CUE=8.4, H=2.25, D=.24, SPACING=1.40;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const p=clamp(x);return p*p*(3-2*p);};
const out=(x:number)=>1-Math.pow(1-clamp(x),3);
const GOLD='#e8b962', CYAN='#61d7d0';

const makeWorld=()=>{
  const world=new THREE.Group(),chain=new THREE.Group(),energy=new THREE.Group();
  world.add(chain,energy);
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const ownGeometry=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
  const ownMaterial=<T extends THREE.Material>(m:T)=>{materials.push(m);return m;};
  const bodyGeometry=ownGeometry(new RoundedBoxGeometry(D,H,1.12,3,.055));
  const gold=ownMaterial(new THREE.MeshStandardMaterial({color:GOLD,metalness:.9,roughness:.23}));
  const ink=ownMaterial(new THREE.MeshStandardMaterial({color:'#0a2633',metalness:.4,roughness:.2}));
  const ceramic=[
    ownMaterial(new THREE.MeshPhysicalMaterial({color:'#dbe6db',roughness:.20,metalness:.04,clearcoat:1,clearcoatRoughness:.13})),
    ownMaterial(new THREE.MeshPhysicalMaterial({color:'#4aafaf',roughness:.25,metalness:.20,clearcoat:1,clearcoatRoughness:.10})),
    ownMaterial(new THREE.MeshPhysicalMaterial({color:'#214851',roughness:.21,metalness:.27,clearcoat:1,clearcoatRoughness:.12})),
  ];
  const pipGeometry=ownGeometry(new THREE.CylinderGeometry(.063,.063,.012,20));
  const dividerGeometry=ownGeometry(new THREE.BoxGeometry(.014,.014,.89));
  const borderHorizontal=ownGeometry(new THREE.BoxGeometry(.012,.018,.91));
  const borderVertical=ownGeometry(new THREE.BoxGeometry(.012,1.98,.018));
  const pipSets=[[[0,0]], [[-.23,-.23],[.23,.23]], [[-.23,-.23],[0,0],[.23,.23]], [[-.23,-.23],[-.23,.23],[.23,-.23],[.23,.23]], [[-.23,-.23],[-.23,.23],[0,0],[.23,-.23],[.23,.23]], [[-.23,-.27],[-.23,0],[-.23,.27],[.23,-.27],[.23,0],[.23,.27]]];
  const tile=(index:number,material:THREE.Material)=>{
    const pivot=new THREE.Group();
    // Pivot is the bottom forward edge. The body extends backwards from it.
    const body=new THREE.Mesh(bodyGeometry,material);body.position.set(-D/2,H/2,0);pivot.add(body);
    const divider=new THREE.Mesh(dividerGeometry,gold);divider.position.set(.007,H/2,0);pivot.add(divider);
    for(const y of [.14,H-.14]){const line=new THREE.Mesh(borderHorizontal,gold);line.position.set(.007,y,0);pivot.add(line);}
    for(const z of [-.46,.46]){const line=new THREE.Mesh(borderVertical,gold);line.position.set(.007,H/2,z);pivot.add(line);}
    for(let half=0;half<2;half++){
      pipSets[(index+half+1)%6].forEach(([z,y])=>{
        const pip=new THREE.Mesh(pipGeometry,index%3===2?gold:ink);pip.rotation.z=Math.PI/2;pip.position.set(.012,half===0?H*.735+y:H*.265+y,z);pivot.add(pip);
      });
    }
    return pivot;
  };
  const stageMaterial=ownMaterial(new THREE.MeshStandardMaterial({color:'#0c2632',roughness:.33,metalness:.65,envMapIntensity:.28}));
  const stage=new THREE.Mesh(ownGeometry(new RoundedBoxGeometry(15.4,.37,3.28,3,.13)),stageMaterial);stage.position.set(.45,-.21,0);chain.add(stage);
  const railMaterial=ownMaterial(new THREE.MeshBasicMaterial({color:CYAN,transparent:true,opacity:.55}));
  const railGeometry=ownGeometry(new THREE.BoxGeometry(14.65,.022,.025));
  for(const z of [-1.40,1.40]){const rail=new THREE.Mesh(railGeometry,railMaterial);rail.position.set(.40,-.01,z);chain.add(rail);}
  const tiles=Array.from({length:9},(_,i)=>{
    const pivot=tile(i,ceramic[i%3]);pivot.position.set(-5.6+i*SPACING,0,0);chain.add(pivot);
    const slot=new THREE.Mesh(ownGeometry(new RoundedBoxGeometry(.32,.014,1.35,2,.03)),gold);slot.position.set(pivot.position.x-D/2,.002,0);chain.add(slot);
    const numberDots=new THREE.Group();
    for(let j=0;j<=i;j++){
      const bead=new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(.022,8,6)),gold);bead.position.set(pivot.position.x-.30+j*.075,.017,-1.12);numberDots.add(bead);
    }
    chain.add(numberDots);
    return pivot;
  });
  // A tangible metal striker approaches the first tile and withdraws.
  const striker=new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(.16,24,16)),gold);chain.add(striker);
  const strikerStem=new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(.046,.046,1.8,16)),gold);strikerStem.rotation.z=Math.PI/2;chain.add(strikerStem);
  const contactGlowMaterial=ownMaterial(new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  const contactGlow=new THREE.Mesh(ownGeometry(new THREE.TorusGeometry(.38,.018,8,64)),contactGlowMaterial);contactGlow.rotation.y=Math.PI/2;chain.add(contactGlow);

  const pedestal=new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(2.72,2.85,.30,96)),stageMaterial);pedestal.position.set(.45,-.18,0);energy.add(pedestal);
  const haloMaterial=ownMaterial(new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.7,depthWrite:false}));
  const halo=new THREE.Mesh(ownGeometry(new THREE.TorusGeometry(2.67,.016,8,96)),haloMaterial);halo.rotation.x=Math.PI/2;halo.position.set(.45,-.02,0);energy.add(halo);
  for(let i=0;i<48;i++){
    const a=i/48*Math.PI*2,mark=new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(.014,.006,i%4===0?.15:.06)),gold);
    mark.position.set(.45+Math.sin(a)*2.52,-.02,Math.cos(a)*2.52);mark.rotation.y=a;energy.add(mark);
  }
  const hero=tile(4,ceramic[0]);hero.position.set(-.72,0,0);energy.add(hero);
  const ghostMaterial=ownMaterial(new THREE.MeshBasicMaterial({color:CYAN,transparent:true,opacity:.10,depthWrite:false}));
  const ghost=new THREE.Mesh(bodyGeometry,ghostMaterial);ghost.position.set(-.72-D/2,H/2,0);energy.add(ghost);
  const ghostEdges=new THREE.LineSegments(ownGeometry(new THREE.EdgesGeometry(new THREE.BoxGeometry(D,H,1.12))),ownMaterial(new THREE.LineBasicMaterial({color:CYAN,transparent:true,opacity:.35})));ghostEdges.position.copy(ghost.position);energy.add(ghostEdges);
  const cmDot=new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(.086,20,16)),ownMaterial(new THREE.MeshBasicMaterial({color:GOLD})));energy.add(cmDot);
  const cmHalo=new THREE.Mesh(ownGeometry(new THREE.TorusGeometry(.21,.018,8,64)),haloMaterial);cmHalo.rotation.y=Math.PI/2;energy.add(cmHalo);
  const heightLine=new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(.018,.018,1,12)),haloMaterial);energy.add(heightLine);
  const crossBars=[0,1].map(()=>{const b=new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(.34,.017,.017)),haloMaterial);energy.add(b);return b;});
  const dashedHeight=new THREE.Group();
  for(let i=0;i<15;i++){const dash=new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(.010,.040,.010)),haloMaterial);dash.position.set(-1.48,.05+i*.077,.88);dashedHeight.add(dash);}energy.add(dashedHeight);
  const arrow=new THREE.Mesh(ownGeometry(new THREE.ConeGeometry(.065,.16,16)),haloMaterial);arrow.rotation.z=Math.PI;energy.add(arrow);
  const energyPackets=Array.from({length:28},(_,i)=>{
    const m=ownMaterial(new THREE.MeshBasicMaterial({color:i%3===0?CYAN:GOLD,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    const p=new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(.025+(i%3)*.006,8,6)),m);energy.add(p);return {p,m};
  });
  const floor=new THREE.Mesh(ownGeometry(new THREE.CircleGeometry(250,96)),ownMaterial(new THREE.MeshBasicMaterial({color:'#050c12'})));floor.rotation.x=-Math.PI/2;floor.position.y=-.42;world.add(floor);
  const dustPositions=new Float32Array(150*3);
  for(let i=0;i<150;i++){dustPositions[i*3]=Math.sin(i*31.41)*13;dustPositions[i*3+1]=1+Math.abs(Math.cos(i*14.17))*7;dustPositions[i*3+2]=-7+Math.sin(i*7.53)*5;}
  const dustGeo=ownGeometry(new THREE.BufferGeometry());dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
  const dust=new THREE.Points(dustGeo,ownMaterial(new THREE.PointsMaterial({color:'#9dbabf',size:.018,transparent:true,opacity:.30})));world.add(dust);
  const impactLight=new THREE.PointLight(GOLD,0,10);impactLight.position.set(-1,3,3);world.add(impactLight);
  const target=new THREE.Vector3();
  return {world,update(t:number){
    chain.visible=t<CUE;energy.visible=t>=CUE;
    // At the contact angle, the preceding top corner meets the next back face.
    // Work backward to prevent overlap throughout the prescribed chain motion.
    const angles=tiles.map((_,i)=>Math.PI/2*Math.pow(clamp((t-4.85-i*.34)/.58),2));
    for(let i=angles.length-2;i>=0;i--){
      const next=angles[i+1];
      const topContact=next+Math.asin((SPACING*Math.cos(next)-D)/H);
      const bottomContact=Math.atan2(SPACING-D*Math.cos(next),D*Math.sin(next));
      const limit=Math.min(topContact,bottomContact);
      angles[i]=Math.max(0,Math.min(angles[i],limit));
    }
    tiles.forEach((p,i)=>{p.rotation.z=-angles[i];});
    const touch=smooth((t-4.25)/.60),retreat=smooth((t-4.91)/.43);
    striker.position.set(-6.70+touch*.70-retreat*1.25,1.70,0);
    strikerStem.position.copy(striker.position).add(new THREE.Vector3(-1.01,0,0));
    striker.visible=t<5.4;strikerStem.visible=t<5.4;
    const pulse=Math.exp(-Math.max(0,t-4.85)*10)*(t>=4.85?1:0);
    contactGlow.position.set(-5.79,1.7,0);contactGlow.scale.setScalar(1+(1-pulse)*1.6);contactGlowMaterial.opacity=pulse*.9;
    const tilt=Math.PI/2*smooth((t-10.6)/1.85);
    hero.rotation.z=-tilt;
    ghost.visible=t>=10.6;ghostEdges.visible=t>=10.6;
    const cmx=-.72-D/2*Math.cos(tilt)+H/2*Math.sin(tilt),cmy=D/2*Math.sin(tilt)+H/2*Math.cos(tilt);
    cmDot.position.set(cmx,cmy,.60);cmHalo.position.copy(cmDot.position);
    cmHalo.rotation.set(0,0,0);cmHalo.scale.setScalar(1+.06*Math.sin(t*3));
    heightLine.position.set(-1.48,cmy/2,.88);heightLine.scale.y=Math.max(.001,cmy);
    crossBars[0].position.set(-1.48,.02,.88);crossBars[1].position.set(-1.48,cmy,.88);
    arrow.position.set(-1.48,Math.max(.19,cmy-.22),.88);arrow.visible=t>10.65&&t<12.3;
    energyPackets.forEach(({p,m},i)=>{
      const u=clamp((t-10.65-i*.022)/1.9),a=i*2.399;
      target.set(cmx+Math.cos(a)*u*2.8,Math.max(.05,cmy+Math.sin(a)*u*.65),.6+Math.sin(a)*u*1.9);
      p.position.copy(target);m.opacity=t>=10.65&&u<1?Math.sin(u*Math.PI)*.65:0;
    });
    impactLight.intensity=t>=CUE?4*Math.exp(-(t-CUE)*3):0;
    dust.rotation.y=t*.007;
  },dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
};

const World:React.FC=()=>{
  const t=useCurrentFrame()/useVideoConfig().fps,model=useMemo(makeWorld,[]),{gl,scene,camera}=useThree();
  useLayoutEffect(()=>{
    gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=.92;gl.outputColorSpace=THREE.SRGBColorSpace;
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(gl),env=pmrem.fromScene(room,.04);
    scene.environment=env.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
    return()=>{scene.environment=null;env.dispose();model.dispose();};
  },[gl,scene,model]);
  useLayoutEffect(()=>{
    model.update(t);
    if(t<CUE){
      const pull=smooth((t-2.8)/2.05);
      camera.position.set(THREE.MathUtils.lerp(-.40,7.4,pull),THREE.MathUtils.lerp(3.2,7.3,pull),THREE.MathUtils.lerp(6.3,13.4,pull));
      camera.lookAt(THREE.MathUtils.lerp(-5.1,.1,pull),THREE.MathUtils.lerp(1.05,.55,pull),0);
    }else{
      const orbit=smooth((t-CUE)/4);
      camera.position.set(7.2-orbit*.65,4.15,9.8);camera.lookAt(.15,.8,0);
    }
  },[t,model,camera]);
  return <><hemisphereLight args={['#c1e8e8','#071620',1.0]}/><directionalLight position={[2,7,6]} intensity={4.3} color="#f9e5bb"/><directionalLight position={[-4,3,-5]} intensity={4.2} color="#68d6db"/><directionalLight position={[7,1,-3]} intensity={2.6} color="#f0bd68"/><primitive object={model.world}/></>;
};

const Captions:React.FC=()=>{
  const t=useCurrentFrame()/useVideoConfig().fps,{width}=useVideoConfig();
  const phase=t<3?0:t<4.85?1:t<CUE?2:t<10.6?3:t<13.55?4:5;
  const starts=[0,3,4.85,CUE,10.6,13.55],arrival=out((t-starts[phase])/.22),fade=1-smooth((t-14.05)/.40);
  const heads=['轻轻一推，为什么能一路倒下？','这一推，真的提供了全部能量？','触发，在一张张牌之间传递。','每一张牌，都藏着重力势能。','倒下，把储存的能量释放出来。','能量，从来没有凭空增加。'];
  const subs=['一根手指，能启动一整排多米诺。','先看清：推动它的，究竟是什么？','碰撞触发下一张；重力让它继续倒下。','竖起牌时，我们已经抬高了它的重心。','重心降低：势能转为运动，也有声音与热。','最初的小动作，只是打开了释放能量的开关。'];
  const final=smooth((t-14.65)/.5),flash=t>=CUE?Math.exp(-(t-CUE)*17)*.17:0;
  return <div style={{position:'absolute',inset:0,width:1920,height:1080,scale:width/1920,transformOrigin:'top left',fontFamily:'"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif'}}>
    <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,#041018ab,transparent 32%,transparent 70%,#041018e8)'}}/>
    <Interactive.Div name="Domino chapter" style={{position:'absolute',left:112,top:62,fontSize:21,letterSpacing:5,fontWeight:600,color:'#87a6b0',opacity:fade}}>ENERGY / 多米诺</Interactive.Div>
    <Interactive.Div name="Domino headline" style={{position:'absolute',left:108,right:90,top:112,fontSize:76,lineHeight:1.2,fontWeight:850,color:phase>=3?'#f3d99b':'#e9f2ef',opacity:arrival*fade,translate:`0px ${(1-arrival)*20}px`}}>{heads[phase]}</Interactive.Div>
    <Interactive.Div name="Domino explanation" style={{position:'absolute',left:112,right:90,top:935,fontSize:42,lineHeight:1.25,fontWeight:500,color:'#c9dde0',opacity:arrival*fade}}>{subs[phase]}</Interactive.Div>
    {t>=CUE&&t<14.4&&<div style={{position:'absolute',right:140,top:355,width:430,color:GOLD,opacity:fade}}>
      <Interactive.Div name="Potential energy formula" style={{fontSize:77,fontWeight:700,letterSpacing:3}}>E = mgh</Interactive.Div>
      <div style={{height:1,background:'#c8a45c77',margin:'23px 0'}}/>
      <Interactive.Div name="Energy height annotation" style={{fontSize:33,color:'#bed4d8',lineHeight:1.55}}>高度下降<br/><span style={{color:GOLD}}>重力势能减少</span></Interactive.Div>
      <div style={{marginTop:27,fontSize:22,letterSpacing:3,color:'#718e99'}}>质心高度 · 相对底面</div>
    </div>}
    <div style={{position:'absolute',right:110,top:68,fontSize:19,letterSpacing:2,color:'#6d8f9c',opacity:fade}}>接触与能量转换示意</div>
    <div style={{position:'absolute',inset:0,background:'#ffecc3',opacity:flash}}/>
    {/* The falling diagonal carries the cut into a gold/cyan wipe. */}
    {t>=14.05&&t<15.35&&[0,1,2].map(i=>{const q=smooth((t-14.05-i*.07)/.72);return <div key={i} style={{position:'absolute',left:-2100+q*5900,top:-800,width:750,height:2800,rotate:'-31deg',background:i===1?'#d7b369':i===0?'#29656c':'#0e3541',boxShadow:'0 0 90px #bde0d922'}}/>;})}
    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 48% 46%,#16343e,#041018 73%)',opacity:final*.99}}/>
    {t>=14.65&&<>
      <div style={{position:'absolute',left:112,right:112,top:375,height:2,background:'linear-gradient(90deg,transparent,#e9ba63,#5fc8c9,transparent)',opacity:final}}/>
      <Interactive.Div name="Domino final title" style={{position:'absolute',left:100,right:100,top:420,textAlign:'center',fontSize:91,lineHeight:1.28,fontWeight:900,color:'#f2dfae',opacity:final,scale:1.05-.05*final}}>被放大的，是触发。</Interactive.Div>
      <Interactive.Div name="Domino final answer" style={{position:'absolute',left:100,right:100,top:572,textAlign:'center',fontSize:63,lineHeight:1.35,fontWeight:650,color:'#d2e4e3',opacity:smooth((t-14.85)/.45)}}>能量早已储存。</Interactive.Div>
      <div style={{position:'absolute',left:0,right:0,bottom:108,textAlign:'center',fontSize:23,letterSpacing:7,color:'#72949d',opacity:final}}>POTENTIAL ENERGY · VIBE SCIENCE VIDEO</div>
    </>}
  </div>;
};

export const Domino:React.FC=()=>{
  const {width,height}=useVideoConfig();
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 48%,#173743,#06121c 75%)',overflow:'hidden'}}><Track name="Domino energy mechanism"><ThreeCanvas width={width} height={height} dpr={1} camera={{fov:38,near:.1,far:100,position:[-.4,3.2,6.3]}} gl={{antialias:true,alpha:true}}><World/></ThreeCanvas></Track><Captions/></AbsoluteFill>;
};
