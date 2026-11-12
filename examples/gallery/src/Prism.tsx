import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, Interactive, Track, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

// The visible spectral reveal is a binary state at 8.4 s / frame 504 at 60 fps.
const REVEAL = 8.4;
const PALETTE = ['#ff566b', '#ff9545', '#ffe86a', '#65efae', '#55c7ff', '#9c82ff'];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {const x=clamp(v);return x*x*(3-2*x);};
const out = (v: number) => 1-Math.pow(1-clamp(v),3);
type Beam = {group:THREE.Group;set:(progress:number, opacity?:number)=>void};

const makeBeam=(start:THREE.Vector3,end:THREE.Vector3,color:string,radius=.025):Beam=>{
  const group=new THREE.Group(), delta=end.clone().sub(start), direction=delta.clone().normalize();
  const length=delta.length();
  const layers=[{r:radius,a:1},{r:radius*3.4,a:.22},{r:radius*8,a:.045}].map(({r,a})=>{
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:a,depthWrite:false,blending:THREE.AdditiveBlending});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,9,1,true),material);
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    body.renderOrder=12;group.add(body);return {body,material,a};
  });
  return {group,set(progress,opacity=1){
    const p=clamp(progress);group.visible=p>0&&opacity>0;
    layers.forEach(({body,material,a})=>{
      body.position.copy(start).addScaledVector(delta,p*.5);
      body.scale.y=Math.max(.0001,length*p);material.opacity=a*opacity;
    });
  }};
};

const makeModel=()=>{
  const group=new THREE.Group();
  const prismGroup=new THREE.Group();group.add(prismGroup);
  const shape=new THREE.Shape();shape.moveTo(-2,-1.464);shape.lineTo(2,-1.464);shape.lineTo(0,2);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:1.6,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.035,bevelThickness:.035});
  geometry.translate(0,0,-.8);
  const crystalMaterial=new THREE.MeshPhysicalMaterial({color:'#93c4dc',metalness:.2,roughness:.07,clearcoat:1,clearcoatRoughness:.03,transparent:true,opacity:.085,side:THREE.DoubleSide,envMapIntensity:.3,depthWrite:false});
  const crystal=new THREE.Mesh(geometry,crystalMaterial);crystal.renderOrder=3;prismGroup.add(crystal);
  const edgeMaterial=new THREE.LineBasicMaterial({color:'#c2e6ec',transparent:true,opacity:.38,depthWrite:false});
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,28),edgeMaterial);edges.renderOrder=15;prismGroup.add(edges);
  // A shaded bevel and visible rear face supply depth without remote assets.
  const face=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#86a6b4',transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false}));
  face.position.z=-.802;face.renderOrder=1;prismGroup.add(face);
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.78,.12,100),new THREE.MeshStandardMaterial({color:'#142a36',metalness:.8,roughness:.28}));
  platform.position.set(0,-1.66,0);group.add(platform);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(2.68,.018,8,100),new THREE.MeshBasicMaterial({color:'#496a77',transparent:true,opacity:.8}));
  rim.rotation.x=Math.PI/2;rim.position.set(0,-1.59,0);group.add(rim);
  for(let i=0;i<64;i++){
    const a=i/64*Math.PI*2;
    const mark=new THREE.Mesh(new THREE.BoxGeometry(.012,.006,i%8===0?.16:.07),new THREE.MeshBasicMaterial({color:i%8===0?'#9eb3bb':'#405965'}));
    mark.position.set(Math.sin(a)*2.51,-1.591,Math.cos(a)*2.51);mark.rotation.y=a;group.add(mark);
  }

  const entry=new THREE.Vector3(-(2-.27)/Math.sqrt(3),.27,.03);
  const incidentAngle=12*Math.PI/180;
  const start=new THREE.Vector3(-7.55,entry.y+Math.tan(incidentAngle)*(-7.55-entry.x),entry.z);
  const incoming=makeBeam(start,entry,'#f3f7ff',.031);group.add(incoming.group);
  // Crown-glass index order follows normal visible dispersion. External angular
  // separation is exaggerated 7x around the mean solely for a legible diagram.
  const indices=[1.512,1.514,1.518,1.519,1.524,1.530];
  const optical=indices.map(n=>{
    const alpha=-Math.PI/6+Math.asin(Math.sin(incidentAngle+Math.PI/6)/n);
    const slope=Math.tan(alpha), x=(2-entry.y+slope*entry.x)/(Math.sqrt(3)+slope);
    const exit=new THREE.Vector3(x,entry.y+slope*(x-entry.x),entry.z);
    const beta=Math.PI/6+Math.asin(n*Math.sin(alpha-Math.PI/6));return {exit,beta};
  });
  const mean=optical.reduce((s,p)=>s+p.beta,0)/optical.length;
  const paths=optical.map(({exit,beta},i)=>{
    const angle=mean+(beta-mean)*7;
    const end=new THREE.Vector3(8,exit.y+Math.tan(angle)*(8-exit.x),exit.z);
    const inner=makeBeam(entry,exit,PALETTE[i],.012);
    const outer=makeBeam(exit,end,PALETTE[i],.035);
    group.add(inner.group,outer.group);
    const beads=Array.from({length:4},()=>{
      const bead=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),new THREE.MeshBasicMaterial({color:PALETTE[i],transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false}));
      bead.renderOrder=18;group.add(bead);return bead;
    });
    return {inner,outer,exit,end,beads};
  });
  const innerWhite=makeBeam(entry,optical[2].exit,'#f5f9ff',.022);group.add(innerWhite.group);
  const glint=new THREE.Mesh(new THREE.SphereGeometry(.085,16,12),new THREE.MeshBasicMaterial({color:'#f5f7ff',transparent:true,opacity:.85,depthWrite:false}));
  glint.position.copy(optical[2].exit);glint.renderOrder=19;group.add(glint);

  const light=new THREE.PointLight('#bce9ff',3,8);light.position.set(-2,1,2);group.add(light);
  const impactLight=new THREE.PointLight('#f6d2ff',0,8);impactLight.position.copy(optical[2].exit).add(new THREE.Vector3(0,0,1.2));group.add(impactLight);
  const positions=new Float32Array(120*3);
  for(let i=0;i<120;i++){positions[i*3]=Math.sin(i*41.27)*12;positions[i*3+1]=Math.cos(i*12.61)*5;positions[i*3+2]=-2-Math.abs(Math.sin(i*27.8))*7;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#789aab',size:.021,transparent:true,opacity:.35,depthWrite:false}));group.add(dust);
  return {group,update(t:number){
    const active=t>=REVEAL, enter=out((t-.2)/2.0), through=out((t-3.15)/2.1);
    incoming.set(enter,1);
    innerWhite.set(through,active?0:1);
    paths.forEach((p,i)=>{
      p.inner.set(active?1:0,.82);
      // A complete split is visible on the exact impact frame; light packets
      // moving afterwards provide follow-through, rather than delaying the cue.
      p.outer.set(active?1:0,active?.87+.13*Math.exp(-(t-REVEAL)*6):0);
      p.beads.forEach((bead,j)=>{
        bead.visible=active;
        const q=((t-REVEAL)*.62+j*.25+i*.035)%1;
        bead.position.copy(p.exit).lerp(p.end,q);
        bead.scale.setScalar(.6+Math.sin(q*Math.PI)*.7);
      });
    });
    glint.visible=t>=5.25&&t<9;
    glint.scale.setScalar(t<REVEAL?.7+smooth((t-6.1)/2.3)*2:3.7*Math.exp(-(t-REVEAL)*6));
    impactLight.intensity=active?7*Math.exp(-(t-REVEAL)*4):0;
    crystalMaterial.opacity=.24+(active?.025:0);
    edgeMaterial.opacity=.62+Math.sin(t*.8)*.08;
    group.position.set(-.25,.65,0);
    dust.rotation.z=t*.008;
  },dispose(){group.traverse(o=>{
    if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments||o instanceof THREE.Points){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}
  });}};
};

const OpticalScene:React.FC=()=>{
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),t=frame/fps;
  const model=useMemo(makeModel,[]),{gl,scene,camera}=useThree();
  useLayoutEffect(()=>{
    gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;gl.outputColorSpace=THREE.SRGBColorSpace;
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(gl),env=pmrem.fromScene(room,.04);
    scene.environment=env.texture;scene.environmentIntensity=.7;room.dispose();pmrem.dispose();
    return()=>{scene.environment=null;env.dispose();model.dispose();};
  },[gl,scene,model]);
  useLayoutEffect(()=>{
    model.update(t);
    const approach=smooth(t/3.2),anticipate=smooth((t-7.65)/.6)*(1-smooth((t-8.6)/.6));
    camera.position.set(2.6-approach*.75+Math.sin(t*.15)*.13,1.8,16.6-approach*.7-anticipate*.35);
    camera.lookAt(.1,-.25,0);
  },[t,model,camera]);
  return <>
    <hemisphereLight args={['#bbd9e7','#071523',1.1]}/>
    <directionalLight position={[-4,5,7]} color="#d9f4ff" intensity={3.6}/>
    <directionalLight position={[4,1,-3]} color="#b4a2ff" intensity={4.5}/>
    <directionalLight position={[-3,-2,3]} color="#6de4ed" intensity={1.2}/>
    <primitive object={model.group}/>
  </>;
};

const Typography:React.FC=()=>{
  const f=useCurrentFrame(),{fps,width}=useVideoConfig(),t=f/fps;
  const final=smooth((t-14.5)/.7),sceneText=1-smooth((t-13.7)/.45);
  const phase=t<3.4?0:t<6.3?1:t<REVEAL?2:t<11.8?3:4;
  const starts=[0,3.4,6.3,REVEAL,11.8];
  const headline=['白光里，藏着多少颜色？','看起来，只有一种颜色。','直到，它穿过一块棱镜。','不同波长，分道而行。','白光，原来是一场合奏。'][phase];
  const subtitles=['先让一束白光，走进玻璃。','这些颜色，原本混在同一束光里。','同一束光，即将走向不同方向。','折射率随波长变化，偏折角度也不同。','棱镜把原本混在一起的光，按波长展开。'][phase];
  const arrival=out((t-starts[phase])/.25);
  const flash=t>=REVEAL?Math.exp(-(t-REVEAL)*16)*.13:0;
  return <div style={{width:1920,height:1080,scale:width/1920,transformOrigin:'top left',position:'absolute',inset:0,fontFamily:'"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif'}}>
    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 52%,transparent 30%,#030b17b3 95%)'}}/>
    <Interactive.Div name="Prism chapter" style={{position:'absolute',left:115,top:66,fontSize:21,fontWeight:600,letterSpacing:5,color:'#8aa5bb',opacity:sceneText}}>OPTICS / 色散</Interactive.Div>
    <Interactive.Div name="Prism question" style={{position:'absolute',left:110,top:112,fontSize:82,fontWeight:850,letterSpacing:0,lineHeight:1.2,color:phase>=3?'#f5e5bc':'#edf5fa',opacity:arrival*sceneText,translate:`0px ${(1-arrival)*21}px`}}>{headline}</Interactive.Div>
    <Interactive.Div name="Prism explanation" style={{position:'absolute',left:115,top:913,fontSize:42,fontWeight:500,letterSpacing:1,lineHeight:1.3,color:'#d2e0e9',opacity:arrival*sceneText}}>{subtitles}</Interactive.Div>
    {t>=REVEAL&&t<14.2&&<Interactive.Div name="Wavelength labels" style={{position:'absolute',left:115,top:845,fontSize:27,letterSpacing:2,opacity:sceneText}}><span style={{color:PALETTE[0]}}>红光：偏折较小</span><span style={{color:'#526979',padding:'0 28px'}}> / </span><span style={{color:PALETTE[5]}}>紫光：偏折较大</span></Interactive.Div>}
    <div style={{position:'absolute',inset:0,background:'#e8e6ff',opacity:flash}}/>
    {/* Spectrum itself becomes the wipe: the six stripes share the ray order. */}
    {t>=13.7&&t<15.45&&PALETTE.map((color,i)=>{
      const enter=smooth((t-13.7-i*.035)/.50),leave=smooth((t-14.45-i*.035)/.65);
      return <div key={color} style={{position:'absolute',left:-550+enter*2650+leave*2650,top:-500+i*150,width:560,height:2200,rotate:'-30deg',background:color,opacity:.86,boxShadow:`0 0 80px ${color}88`}}/>;
    })}
    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 55%,#14263c,#050c18 78%)',opacity:final*.96}}/>
    {t>=14.5&&<>
      <div style={{position:'absolute',left:110,right:110,top:383,height:3,display:'flex',gap:6,opacity:final*.8}}>{PALETTE.map(color=><div key={color} style={{flex:1,background:color,boxShadow:`0 0 24px ${color}`}}/>)}</div>
      <Interactive.Div name="Prism reveal title" style={{position:'absolute',left:110,right:110,top:433,fontSize:105,fontWeight:900,lineHeight:1.25,letterSpacing:1,textAlign:'center',color:'#f5ead0',opacity:final,scale:1.065-final*.065}}>白光，是一场合奏。</Interactive.Div>
      <Interactive.Div name="Prism reveal answer" style={{position:'absolute',left:115,right:115,top:595,fontSize:42,lineHeight:1.4,textAlign:'center',color:'#bfd2e0',opacity:smooth((t-14.85)/.45)}}>棱镜让不同波长，走向不同方向。</Interactive.Div>
      <div style={{position:'absolute',left:0,right:0,bottom:108,textAlign:'center',fontSize:23,letterSpacing:7,color:'#6e8ba6',opacity:final}}>DISPERSION · VIBE SCIENCE VIDEO</div>
    </>}
    <div style={{position:'absolute',right:115,top:71,fontSize:19,color:'#688397',letterSpacing:2,opacity:sceneText}}>路径与色散关系示意</div>
  </div>;
};

export const Prism:React.FC=()=>{
  const{width,height}=useVideoConfig();
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 48% 48%,#17304b,#081427 54%,#020813)',overflow:'hidden'}}>
    <Track name="Prism optical mechanism"><ThreeCanvas width={width} height={height} dpr={1} camera={{fov:38,near:.1,far:100,position:[.8,1.2,16.6]}} gl={{antialias:true,alpha:true}}><OpticalScene/></ThreeCanvas></Track>
    <Typography/>
  </AbsoluteFill>;
};
