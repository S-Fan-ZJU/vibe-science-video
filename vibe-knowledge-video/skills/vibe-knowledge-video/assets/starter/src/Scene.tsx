import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, Interactive, Track, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import audio from './audio-config.json';
import {TIMING as T, clamp, smooth, easeOut} from './timing';
import {dimensions as D} from './geometry.mjs';

const COLORS = ['#7ad9e8', '#ec99bb'];
const mat = (color: string, metalness=.6, roughness=.3) => new THREE.MeshStandardMaterial({color, metalness, roughness});
const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x=0,y=0,z=0) => {
  const m=new THREE.Mesh(geometry, material); m.position.set(x,y,z); return m;
};

const buildMachine = () => {
  const group=new THREE.Group();
  const dark=mat('#263e51',.7,.32), steel=mat('#90a8ad',.8,.25), gold=mat('#ffce79',.65,.24);
  group.add(mesh(new THREE.BoxGeometry(6.8,.20,1.25),dark,0,-1.3,-.18));
  group.add(mesh(new THREE.BoxGeometry(6.5,.035,1.14),steel,0,-1.18,-.18));
  const keys:THREE.Group[]=[]; const rings:THREE.Mesh[]=[]; const indicators:THREE.MeshStandardMaterial[]=[];
  [-1.9,1.9].forEach((x,i)=>{
    const color=COLORS[i];
    group.add(mesh(new THREE.BoxGeometry(.22,.58,.48),dark,x,-.93,-.05));
    // Torus bore is genuinely empty. No transparent disk masks a solid hole.
    const socket=mesh(new THREE.TorusGeometry(D.boreInnerRadius+.1,.1,16,64),steel,x,0,0);
    socket.scale.z=1; group.add(socket);
    const indicator=mat(color,.35,.27); indicator.emissive=new THREE.Color(color); indicator.emissiveIntensity=.05;
    indicators.push(indicator);
    group.add(mesh(new THREE.TorusGeometry(.64,.027,8,64),indicator,x,0,.01));
    group.add(mesh(new THREE.BoxGeometry(.52,.035,.08),indicator,x,-1.06,.49));
    const key=new THREE.Group();
    const keyMat=mat(color,.72,.22);
    key.add(mesh(new THREE.TorusGeometry(D.bowRadius,.065,12,48),keyMat,0,0,D.insertedBowZ));
    key.add(mesh(new THREE.BoxGeometry(.26,.14,1.36),keyMat,0,0,.32));
    key.add(mesh(new THREE.BoxGeometry(.16,.20,.16),keyMat,.21,-.03,-.20));
    key.add(mesh(new THREE.BoxGeometry(.16,.17,.12),keyMat,.21,-.03,.10));
    key.add(mesh(new THREE.BoxGeometry(.05,.025,.85),dark,0,.078,.3));
    group.add(key); keys.push(key);
    // Circuit segments have an unambiguous path toward the shared output.
    for(let n=0;n<7;n++){
      const px=x+(0-x)*(n+1)/9;
      group.add(mesh(new THREE.BoxGeometry(.14,.025,.05),indicator,px,-.82,.49));
    }
  });
  const coreMaterial=mat('#5f6260',.34,.36);
  coreMaterial.emissive=new THREE.Color('#ffbc54'); coreMaterial.emissiveIntensity=0;
  const core=mesh(new THREE.IcosahedronGeometry(.44,2),coreMaterial,0,.02,-.05); group.add(core);
  for(let i=0;i<3;i++){
    const ring=mesh(new THREE.TorusGeometry(.75+i*.17,.032,8,80),gold,0,.02,-.05);
    ring.rotation.set(i*.8,.4+i*.8,0); group.add(ring); rings.push(ring);
  }
  const outputLight=new THREE.PointLight('#ffca75',0,10); outputLight.position.set(0,.1,1.5); group.add(outputLight);
  const shards:THREE.Mesh[]=[];
  for(let i=0;i<44;i++){
    const shard=mesh(new THREE.IcosahedronGeometry(.025+(i%3)*.009,0),gold);
    group.add(shard); shards.push(shard);
  }
  const dustMaterial=mat('#76a7b9',.1,.8);
  for(let i=0;i<90;i++){
    const x=Math.sin(i*43.13)*7.9, y=Math.cos(i*17.73)*4.3, z=-2.5-(i%9)*.4;
    group.add(mesh(new THREE.SphereGeometry(.008+(i%4)*.004,5,4),dustMaterial,x,y,z));
  }
  return {group, update(t:number){
    keys.forEach((key,i)=>{
      const insert=easeOut((t-(i?T.secondInsert:T.firstInsert))/.85);
      const turn=smooth((t-(i?T.secondTurn:T.firstTurn))/.60);
      const x=i?1.9:-1.9;
      key.position.set(x+(1-insert)*(i?1.3:-1.3), .16*(1-insert), 3.1*(1-insert));
      key.rotation.set(0,0,turn*Math.PI*.5);
      indicators[i].emissiveIntensity=.05+turn*.7;
    });
    const active=t>=T.activation; // binary light response lands on the impact frame
    const progress=easeOut((t-T.activation)/.55);
    coreMaterial.color.set(active?'#ffdc91':'#5f6260');
    coreMaterial.emissiveIntensity=active?1.45+.2*Math.sin(t*5):0;
    core.scale.setScalar(active?1+.15*Math.exp(-(t-T.activation)*4):1);
    core.rotation.set(t*.12,t*.19,t*.07);
    outputLight.intensity=active?18:0;
    rings.forEach((r,i)=>{r.rotation.z=t*.1*(i%2?-1:1)+progress*.7; r.scale.setScalar(1+progress*.12);});
    shards.forEach((shard,i)=>{
      shard.visible=active&&t<T.activation+1.35;
      const p=clamp((t-T.activation)/1.35), a=i*2.399963;
      shard.position.set(Math.cos(a)*(.44+p*(2+(i%5)*.3)),Math.sin(a)*(.44+p*(1.3+(i%4)*.2)),Math.sin(i*3.13)*p*1.5);
      shard.scale.setScalar((1-p)*1.2+.1);
    });
    group.rotation.y=-.20+.06*Math.sin(t*.4);
    group.rotation.x=.07;
    group.position.y=-.15;
  }};
};

const Machine = () => {
  const frame=useCurrentFrame(), {fps}=useVideoConfig(), t=frame/fps;
  const model=useMemo(buildMachine,[]), {gl,scene,camera}=useThree();
  useLayoutEffect(()=>{
    gl.toneMapping=THREE.ACESFilmicToneMapping; gl.toneMappingExposure=1.12; gl.outputColorSpace=THREE.SRGBColorSpace;
    const room=new RoomEnvironment(), pmrem=new THREE.PMREMGenerator(gl), env=pmrem.fromScene(room,.04);
    scene.environment=env.texture; scene.environmentIntensity=.32;
    room.dispose(); pmrem.dispose();
    return ()=>{env.dispose();model.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});};
  },[gl,scene,model]);
  useLayoutEffect(()=>{
    model.update(t);
    const zoom=smooth((t-T.anticipation)/.4)*(1-smooth((t-7.7)/.6));
    const transition=smooth((t-T.transition)/.65);
    camera.position.set(.55,.55,13.5-zoom*.6-transition*9.5);
    camera.lookAt(0,-.08,0);
  },[model,t,camera]);
  return <>
    <hemisphereLight args={['#b9dcf3','#140e29',.65]}/>
    <directionalLight position={[-4,6,6]} color="#fff0ce" intensity={3.2}/>
    <directionalLight position={[5,1,-3]} color="#41d4df" intensity={4.2}/>
    <directionalLight position={[-5,-1,-2]} color="#e76eaf" intensity={2.1}/>
    <primitive object={model.group}/>
  </>;
};

const Overlay:React.FC<{title:string;subtitle:string}>=({title,subtitle})=>{
  const f=useCurrentFrame(), {fps,width}=useVideoConfig(), t=f/fps;
  const final=t>=T.title, fade=1-smooth((t-8.85)/.3);
  const reveal=clamp((t-T.title)/.35);
  const headline=t<3.6?'一个条件，为什么还不够？':t<T.activation?'如果两个条件，同时满足？':'两把钥匙，一个答案。';
  const opacityIn=easeOut(t/.45);
  const flash=t>=T.activation?Math.exp(-(t-T.activation)*14)*.18:0;
  const wipe=smooth((t-T.transition)/.30)*(1-smooth((t-T.title)/.35));
  return <div style={{width:1920,height:1080,scale:width/1920,transformOrigin:'top left',position:'absolute',inset:0,fontFamily:'"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif'}}>
    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 42%,transparent 38%,#020813aa 100%)'}}/>
    <Interactive.Div name="Opening question" style={{position:'absolute',left:150,top:110,fontSize:72,lineHeight:1.2,fontWeight:800,letterSpacing:1,color:'#eef5f0',opacity:opacityIn*fade,translate:`0px ${(1-opacityIn)*25}px`}}>{headline}</Interactive.Div>
    <Interactive.Div name="Chapter label" style={{position:'absolute',left:153,top:65,fontSize:20,letterSpacing:5,color:'#78b9cc',opacity:fade}}>MOTION LAB / 01</Interactive.Div>
    <div style={{position:'absolute',left:155,right:155,bottom:125,display:'flex',alignItems:'center',justifyContent:'space-between',opacity:fade}}>
      <div style={{fontSize:29,color:'#85d7e4'}}>条件 A <span style={{color:t>=3?'#a2e6ec':'#647985'}}>●</span></div>
      <div style={{fontSize:32,letterSpacing:4,color:t>=T.activation?'#ffd398':'#8da3ac'}}>{t>=T.activation?'输出已开启':'两项都满足，才触发输出'}</div>
      <div style={{fontSize:29,color:'#eaa3bd'}}>条件 B <span style={{color:t>=6?'#f3b7d0':'#647985'}}>●</span></div>
    </div>
    <div style={{position:'absolute',inset:0,background:'#ffedc6',opacity:flash}}/>
    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse,#f7d69e,#c98b42)',opacity:wipe}}/>
    {final&&<>
      <div style={{position:'absolute',inset:0,background:'#07121e',opacity:reveal}}/>
      <Interactive.Div name="Final title" style={{position:'absolute',top:365,left:150,right:150,fontSize:88,lineHeight:1.25,fontWeight:900,textAlign:'center',color:'#ffda99',opacity:reveal,scale:interpolate(f,[T.title*fps,(T.title+.45)*fps],[1.12,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{title}</Interactive.Div>
      <Interactive.Div name="Final subtitle" style={{position:'absolute',top:530,width:'100%',textAlign:'center',fontSize:33,color:'#c3d3dc',opacity:easeOut((t-T.title-.1)/.4)}}>{subtitle}</Interactive.Div>
      <div style={{position:'absolute',bottom:85,width:'100%',textAlign:'center',fontSize:20,letterSpacing:3,color:'#60818e'}}>VIBE SCIENCE VIDEO · 可编辑动作实验</div>
    </>}
    {!final&&<div style={{position:'absolute',bottom:50,left:155,fontSize:19,color:'#6e8a96'}}>逻辑门的视觉比喻 · 通用动作模板</div>}
  </div>;
};

const Score=()=>{
  const {fps}=useVideoConfig();
  if(audio.silent)return null;
  return <>
    <Audio name="BGM" src={staticFile(audio.file)} trimBefore={Math.round(audio.trimStartSeconds*fps)}
      volume={(f)=>audio.volume*Math.min(1,f/(.12*fps),(12-f/fps)/.45)}/>
    <Audio name="Activation bell" src={staticFile('audio/activation.wav')} from={Math.round(T.activation*fps)} volume={.7}/>
  </>;
};

export const MotionLab:React.FC<{title:string;subtitle:string}>=(props)=>{
  const {width,height}=useVideoConfig();
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 42%,#183346,#071521 58%,#040914)',overflow:'hidden'}}>
    <Track name="Three-dimensional mechanism"><ThreeCanvas width={width} height={height} dpr={1} camera={{fov:40,near:.1,far:100,position:[.55,.55,13.5]}} gl={{antialias:true,alpha:true}}><Machine/></ThreeCanvas></Track>
    <Overlay {...props}/>
    <Score/>
  </AbsoluteFill>;
};
