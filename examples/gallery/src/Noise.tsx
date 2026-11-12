import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

// This is a schematic of pressure superposition at the ear, not a claim that
// headphones erase environmental sound everywhere. The idealized single tone
// is identified on screen; practical low-frequency performance is in captions.
const HIT = 8.4;
const clamp = (x:number) => Math.max(0,Math.min(1,x));
const smooth = (x:number) => {const v=clamp(x);return v*v*(3-2*v);};
const out = (x:number) => 1-Math.pow(1-clamp(x),3);
const COLORS = {cyan:'#64eee0',gold:'#efc478',purple:'#b697ff',ink:'#edf5f5'};
const FONT='"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif';

function buildHeadphones(){
  const group=new THREE.Group();
  const body=new THREE.MeshStandardMaterial({color:'#344251',metalness:.84,roughness:.28});
  const edge=new THREE.MeshStandardMaterial({color:'#b5c6c9',metalness:.96,roughness:.21});
  const cushion=new THREE.MeshStandardMaterial({color:'#182631',metalness:.12,roughness:.75});
  const leather=new THREE.MeshStandardMaterial({color:'#26323e',metalness:.08,roughness:.55});
  const gold=new THREE.MeshStandardMaterial({color:'#e5c388',metalness:.82,roughness:.23});
  const ringMat=new THREE.MeshStandardMaterial({color:COLORS.cyan,emissive:COLORS.cyan,emissiveIntensity:.3,metalness:.5,roughness:.25});
  const add=(geometry:THREE.BufferGeometry, material:THREE.Material, x=0,y=0,z=0)=>{
    const item=new THREE.Mesh(geometry,material);item.position.set(x,y,z);group.add(item);return item;
  };
  // Triple arched headband and a wider padded inner arch.
  [0,.14,-.14].forEach((z,i)=>{
    const band=add(new THREE.TorusGeometry(1.55,i? .045:.12,12,96,Math.PI),i?edge:body,0,.18,z);
    band.scale.y=1.1;
  });
  const pad=add(new THREE.TorusGeometry(1.42,.11,12,80,Math.PI),leather,0,.2,-.025);pad.scale.y=1.12;
  [-1,1].forEach(side=>{
    const x=side*1.49;
    const mount=add(new THREE.CapsuleGeometry(.10,.62,5,12),edge,x,-.13,0);mount.rotation.z=side*.11;
    const shell=add(new THREE.SphereGeometry(1,48,32),body,x,-.72,0);shell.scale.set(.59,.85,.35);
    const padShell=add(new THREE.SphereGeometry(1,40,24),cushion,x,-.72,.27);padShell.scale.set(.53,.77,.21);
    const rim=add(new THREE.TorusGeometry(.62,.052,12,80),edge,x,-.72,.385);rim.scale.set(.79,1.16,1);
    const inner=add(new THREE.TorusGeometry(.39,.105,16,72),leather,x,-.72,.415);inner.scale.set(.78,1.2,1);
    const face=add(new THREE.SphereGeometry(1,32,24),cushion,x,-.72,.37);face.scale.set(.28,.43,.045);
    const accent=add(new THREE.TorusGeometry(.66,.022,8,80),ringMat,x,-.72,.28);accent.scale.set(.79,1.16,1);
    for(let i=0;i<9;i++){
      const vent=add(new THREE.CapsuleGeometry(.012,.18,3,7),edge,x+side*.31,-.98+i*.060,.34);vent.rotation.z=side*.12;
    }
    const mic=add(new THREE.CylinderGeometry(.034,.034,.025,16),gold,x+side*.40,-.30,.25);mic.rotation.x=Math.PI/2;
    const sensor=add(new THREE.SphereGeometry(.037,12,8),ringMat,x+side*.39,-1.19,.26);sensor.scale.y=.55;
  });
  // Floating fine dust is deterministic and remains behind the product.
  const stars=new THREE.BufferGeometry();
  const positions=new Float32Array(100*3);
  for(let i=0;i<100;i++){positions[3*i]=Math.sin(i*32.32)*9;positions[3*i+1]=Math.cos(i*11.11)*5;positions[3*i+2]=-4-(i%9)*.4;}
  stars.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const dust=new THREE.Points(stars,new THREE.PointsMaterial({color:'#73abb6',size:.018,transparent:true,opacity:.45}));
  return {group,dust,ringMat};
}

const Headphones=()=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig(),t=f/fps;
  const model=useMemo(buildHeadphones,[]),{gl,scene,camera}=useThree();
  useLayoutEffect(()=>{
    gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;gl.outputColorSpace=THREE.SRGBColorSpace;
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(gl),env=pmrem.fromScene(room,.04);
    scene.environment=env.texture;scene.environmentIntensity=.65;
    room.dispose();pmrem.dispose();
    return()=>{env.dispose();model.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});model.dust.geometry.dispose();};
  },[gl,scene,model]);
  useLayoutEffect(()=>{
    const slide=smooth((t-2.6)/1.2),push=smooth((t-13.35)/1.75);
    model.group.position.set(-3.28*slide,-.04,0);
    model.group.rotation.set(.12,-.38+.14*Math.sin(t*.32),-.10+.065*slide);
    model.group.scale.setScalar(1.12+.045*Math.sin(t*.55));
    model.ringMat.emissiveIntensity=t>=HIT?1.8+.35*Math.exp(-(t-HIT)*5):.2;
    camera.position.set(-3.7*push,.35-.85*push,13.2-8.6*push);
    camera.lookAt(-3.65*push,-.18-.55*push,0);
  },[t,model,camera]);
  return <>
    <hemisphereLight args={['#dcefff','#111029',.8]}/>
    <directionalLight position={[-6,7,5]} color="#fff2d1" intensity={3.6}/>
    <directionalLight position={[5,1,-3]} color="#54e6e4" intensity={5.2}/>
    <directionalLight position={[-5,-2,-4]} color="#9674ef" intensity={4}/>
    <primitive object={model.group}/><primitive object={model.dust}/>
  </>;
};

function pressurePath(t:number,y:number,amplitude:number,phase=0){
  const pts:string[]=[];
  for(let i=0;i<=300;i++){
    const x=990+i*(740/300),window=Math.sin(Math.PI*i/300)**.35;
    const wave=Math.sin(i/300*Math.PI*9-t*3.7+phase)*amplitude*window;
    pts.push(`${i?'L':'M'}${x.toFixed(2)},${(y-wave).toFixed(2)}`);
  }
  return pts.join(' ');
}

const SignalDiagram=()=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig(),t=f/fps;
  const reveal=out((t-3.1)/.65),gone=1-smooth((t-13.3)/.5),on=t>=HIT;
  const inverse=out((t-5.1)/.75);
  const a=pressurePath(t,421,48),b=pressurePath(t,584,48*inverse,Math.PI),c=pressurePath(t,759,on?0:48);
  const impact=on?Math.exp(-(t-HIT)*7):0;
  return <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,fontFamily:FONT,opacity:reveal*gone,translate:`${(1-reveal)*55}px 0`}}>
    <defs><filter id="noise-wave-glow" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="6"/></filter><linearGradient id="noise-card" x2="1" y2="1"><stop stopColor="#182e3a" stopOpacity=".70"/><stop offset="1" stopColor="#101a2b" stopOpacity=".45"/></linearGradient></defs>
    <rect x="912" y="282" width="870" height="565" rx="26" fill="url(#noise-card)" stroke="#567680" strokeOpacity=".38"/>
    <text x="955" y="316" fill="#97b3bf" fontSize="23" letterSpacing="3">声压叠加 · 理想单频示意</text>
    <text x="1735" y="316" textAnchor="end" fill={on?COLORS.cyan:'#78939c'} fontSize="23">{on?'ANC / ON':'ANC / 待开启'}</text>
    {[421,584,759].map((y,i)=><g key={y}>
      <line x1="985" x2="1740" y1={y} y2={y} stroke="#c1e3e4" strokeOpacity=".13"/>
      {[0,1,2,3,4,5,6,7,8].map(n=><line key={n} x1={990+n*92.5} x2={990+n*92.5} y1={y-58} y2={y+58} stroke="#92bdcd" strokeOpacity=".055"/>)}
      <text x="956" y={y-68} fill={[COLORS.gold,COLORS.cyan,on?COLORS.cyan:'#d3e0e4'][i]} fontSize="27">{['环境噪声','反相信号','耳边合成'][i]}</text>
    </g>)}
    <path d={a} fill="none" stroke={COLORS.gold} strokeWidth="11" opacity=".30" filter="url(#noise-wave-glow)"/><path d={a} fill="none" stroke={COLORS.gold} strokeWidth="3.6"/>
    <g opacity={inverse}><path d={b} fill="none" stroke={COLORS.cyan} strokeWidth="12" opacity=".35" filter="url(#noise-wave-glow)"/><path d={b} fill="none" stroke={COLORS.cyan} strokeWidth="3.6"/></g>
    <path d={c} fill="none" stroke={on?COLORS.cyan:'#d8e4eb'} strokeWidth={on?6+impact*10:3.6} opacity={on?.85:1}/>
    {on&&<><circle cx="1740" cy="759" r={8+impact*16} fill={COLORS.cyan}/><text x="1735" y="818" textAnchor="end" fontSize="24" fill={COLORS.cyan}>波峰 ＋ 波谷 → 振幅减小</text></>}
    <text x="1355" y="501" textAnchor="middle" fontSize="30" fill="#526f7b">＋</text>
    <text x="1355" y="675" textAnchor="middle" fontSize="30" fill="#526f7b">＝</text>
  </svg>;
};

// Project the actual right earcup into the overlay, so the expanding ring is
// attached to the hardware throughout the camera move instead of jumping.
function projectedEarcup(t:number){
  const slide=smooth((t-2.6)/1.2),push=smooth((t-13.35)/1.75);
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.12,-.38+.14*Math.sin(t*.32),-.10+.065*slide));
  const scale=1.12+.045*Math.sin(t*.55);
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(-3.28*slide,-.04,0),rotation,new THREE.Vector3(scale,scale,scale));
  const camera=new THREE.PerspectiveCamera(40,1920/1080,.1,100);
  camera.position.set(-3.7*push,.35-.85*push,13.2-8.6*push);
  camera.lookAt(-3.65*push,-.18-.55*push,0);camera.updateMatrixWorld();
  const center=new THREE.Vector3(1.49,-.72,.28).applyMatrix4(matrix).project(camera);
  const edge=new THREE.Vector3(1.49+.66*.79,-.72,.28).applyMatrix4(matrix).project(camera);
  const top=new THREE.Vector3(1.49,-.72+.66*1.16,.28).applyMatrix4(matrix).project(camera);
  return {x:(center.x+1)*960,y:(1-center.y)*540,rx:Math.abs(edge.x-center.x)*960,ry:Math.abs(top.y-center.y)*540};
}

const NoiseOverlay=()=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig(),t=f/fps;
  const introOut=1-smooth((t-3.05)/.25),mainOut=1-smooth((t-13.2)/.4);
  const hit=t>=HIT?Math.exp(-(t-HIT)*9):0,final=out((t-15.3)/.6);
  const transition=smooth((t-14.15)/.65),transitionOut=1-smooth((t-15.3)/.3);
  const cup=projectedEarcup(t);
  const caption=t<3.2?'戴上耳机，为什么世界安静了？':t<5.4?'麦克风先捕捉耳边的环境噪声。':t<HIT?'再生成频率相同、相位相反的信号。':t<11.65?'波峰对上波谷，合成声压变小。':'主动降噪，尤其擅长持续的低频噪声。';
  return <AbsoluteFill style={{fontFamily:FONT,color:COLORS.ink}}>
    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 42% 49%,transparent 28%,#020913a3 100%)'}}/>
    <Interactive.Div name="Noise opening question" style={{position:'absolute',left:120,top:112,fontSize:78,fontWeight:850,letterSpacing:-1,lineHeight:1.22,opacity:out(t/.35)*introOut,translate:`0px ${(1-out(t/.35))*30}px`}}>声音，竟然能<span style={{color:COLORS.gold}}>抵消声音？</span></Interactive.Div>
    <Interactive.Div name="Noise mechanism heading" style={{position:'absolute',left:120,top:112,fontSize:72,fontWeight:800,lineHeight:1.22,opacity:smooth((t-3.2)/.3)*mainOut}}>{t<HIT?'把噪声，翻一个面。':<><span style={{color:COLORS.gold}}>声音</span> ＋ <span style={{color:COLORS.cyan}}>声音</span> ＝ 更安静</>}</Interactive.Div>
    <div style={{position:'absolute',left:124,top:66,fontSize:21,letterSpacing:5,color:'#80b6c4',opacity:mainOut}}>WAVE / 02 · 主动降噪</div>
    <div style={{position:'absolute',left:128,top:800,opacity:smooth((t-3.6)/.5)*mainOut}}>
      <div style={{fontSize:28,letterSpacing:3,color:'#b5c6cf'}}>捕捉 → 计算 → 发出反相信号</div>
      <div style={{marginTop:15,fontSize:24,color:t>=HIT?COLORS.cyan:'#688593'}}>{t>=HIT?'●  耳边的声压波动正在减小':'○  比较声音的振动方向'}</div>
    </div>
    <Interactive.Div name="Noise explanatory caption" style={{position:'absolute',left:120,right:120,top:936,fontSize:38,lineHeight:1.4,color:'#d4e0e6',opacity:out(t/.35)*mainOut}}>{caption}</Interactive.Div>
    <div style={{position:'absolute',inset:0,background:COLORS.cyan,opacity:.10*hit}}/>
    <svg width="1920" height="1080" style={{position:'absolute',inset:0,opacity:transitionOut}}>
      <ellipse cx={cup.x+(960-cup.x)*transition} cy={cup.y+(540-cup.y)*transition} rx={cup.rx+1500*transition} ry={cup.ry+1500*transition} fill="none" stroke="#64eee0" strokeWidth={4+240*transition} opacity={smooth((t-13.7)/.4)*.45}/>
      <ellipse cx={cup.x+(960-cup.x)*transition} cy={cup.y+(540-cup.y)*transition} rx={cup.rx*.72+1800*transition} ry={cup.ry*.72+1800*transition} fill="none" stroke="#baf4ea" strokeWidth={2+400*transition} opacity={smooth((t-13.85)/.4)*.18}/>
    </svg>
    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 46%,#153438,#07131c 70%)',opacity:smooth((t-14.95)/.4)}}/>
    <Interactive.Div name="Noise final answer" style={{position:'absolute',left:120,right:120,top:360,fontSize:96,fontWeight:850,lineHeight:1.3,textAlign:'center',letterSpacing:-2,opacity:final,scale:interpolate(f,[15.3*fps,15.9*fps],[1.08,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>安静，<span style={{color:COLORS.gold}}>也可以被制造。</span></Interactive.Div>
    <Interactive.Div name="Noise final explanation" style={{position:'absolute',left:130,right:130,top:533,textAlign:'center',fontSize:38,lineHeight:1.6,color:'#b9d1d8',opacity:out((t-15.55)/.5)}}>主动降噪：用反相信号，减弱耳边的噪声。</Interactive.Div>
    <div style={{position:'absolute',left:130,right:130,bottom:105,textAlign:'center',fontSize:21,letterSpacing:4,color:'#6c939e',opacity:final}}>VIBE SCIENCE VIDEO · 机制动画样片</div>
  </AbsoluteFill>;
};

export const Noise:React.FC=()=>{
  const {width,height}=useVideoConfig();
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 40% 44%,#17343f,#091322 55%,#030a12)',overflow:'hidden'}}>
    <ThreeCanvas width={width} height={height} dpr={1} gl={{antialias:true,alpha:true}} camera={{fov:40,near:.1,far:100,position:[0,.35,13.2]}}><Headphones/></ThreeCanvas>
    <SignalDiagram/><NoiseOverlay/>
  </AbsoluteFill>;
};
