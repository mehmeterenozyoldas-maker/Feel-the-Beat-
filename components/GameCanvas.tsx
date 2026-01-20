import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { LEVELS } from '../constants';
import { GameState, NodeType, GameSettings, HitGrade } from '../types';
import { audio } from '../services/AudioService';

// --- ADVANCED CYBER SHADER ---
const CyberShader = {
  uniforms: { 
    "tDiffuse": { value: null }, 
    "amount": { value: 0.0 }, 
    "time": { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv; 
    void main() { 
      vUv = uv; 
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); 
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; 
    uniform float amount; 
    uniform float time;
    varying vec2 vUv;
    float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
    void main() {
      vec2 uv = vUv;
      float shift = amount * 0.005;
      vec4 cr = texture2D(tDiffuse, uv + vec2(shift, 0.0));
      vec4 cga = texture2D(tDiffuse, uv);
      vec4 cb = texture2D(tDiffuse, uv - vec2(shift, 0.0));
      float scanline = sin(uv.y * 800.0 + time * 10.0) * 0.02; // Faster scanlines
      vec3 color = vec3(cr.r, cga.g, cb.b) - scanline;
      float d = length(uv - 0.5);
      color *= (1.0 - smoothstep(0.4, 1.6, d)); // Vignette
      color += random(uv + time) * 0.02; // Noise
      gl_FragColor = vec4(color, 1.0);
    }`
};

interface GameCanvasProps {
  levelIndex: number;
  gameState: GameState;
  settings: GameSettings;
  onStatsUpdate: (stats: any) => void;
  onGameEnd: (success: boolean, stats: any) => void;
  onRequestCam: (videoEl: HTMLVideoElement) => Promise<boolean>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  levelIndex, 
  gameState, 
  settings,
  onStatsUpdate, 
  onGameEnd, 
  onRequestCam 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Refs
  const gameStateRef = useRef(gameState);
  const settingsRef = useRef(settings);
  const levelDataRef = useRef(LEVELS[levelIndex]);
  const statsRef = useRef({ hp: 100, score: 0, combo: 0, maxCombo: 0, accuracy: 100, hits: 0, totalNotes: 0 });
  
  // Sync Refs
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { levelDataRef.current = LEVELS[levelIndex]; }, [levelIndex]);

  // Three.js State
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const handPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const reqIdRef = useRef<number>(0);
  
  // Rhythm Refs
  const nextSpawnIndexRef = useRef(0);
  const activeNodesRef = useRef<THREE.Group[]>([]);
  const gameStartTimeRef = useRef(0);
  
  // Visual Refs
  const cyberPassRef = useRef<any>(null);
  const particlesRef = useRef<any[]>([]);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const cursorRef = useRef<THREE.Group | null>(null);
  const tunnelRef = useRef<THREE.Group | null>(null);
  const floatersRef = useRef<THREE.Sprite[]>([]); 
  const timeRef = useRef(0);
  const shakeIntensityRef = useRef(0);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.025);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    containerRef.current.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
    bloom.strength = 1.2; bloom.radius = 0.6; bloom.threshold = 0.15;
    bloomRef.current = bloom;
    composer.addPass(bloom);

    const cyberPass = new ShaderPass(CyberShader);
    cyberPassRef.current = cyberPass;
    composer.addPass(cyberPass);
    composer.addPass(new OutputPass());

    // --- ENVIRONMENT ---
    const tunnelGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(9, 9.1, 6); // Thinner, larger rings
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
    for(let i=0; i<40; i++) {
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = -i * 2.5;
        tunnelGroup.add(ring);
    }
    scene.add(tunnelGroup);
    tunnelRef.current = tunnelGroup;

    // Cursor (Drone)
    const cursor = new THREE.Group();
    // Core
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    // Outer Shell
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshBasicMaterial({ color: 0x00ff9d, wireframe: true, transparent:true, opacity:0.6 }));
    cursor.add(core, shell);
    
    // Trail
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(40*3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trailMat = new THREE.PointsMaterial({ color: 0x00ff9d, size:0.15, transparent:true, opacity:0.4, blending: THREE.AdditiveBlending });
    const trail = new THREE.Points(trailGeo, trailMat);
    cursor.userData = { trail: [], trailMesh: trail, shell: shell };
    scene.add(cursor);
    scene.add(trail);
    cursorRef.current = cursor;

    // ANIMATION LOOP
    const clock = new THREE.Clock();
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      timeRef.current += dt;
      
      // Accessibility Check
      if (cyberPassRef.current) {
        cyberPassRef.current.uniforms.time.value = timeRef.current;
        if(settingsRef.current.reduceMotion) cyberPassRef.current.uniforms.amount.value = 0;
      }
      
      if (gameStateRef.current === GameState.PLAYING) {
         updateGameLogic(timeRef.current);
      }
      
      updateVisuals(timeRef.current, dt);
      composer.render();
    };
    animate();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const handlePointer = (e: PointerEvent) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        updateCursorPos(x, y);
    };
    window.addEventListener('pointermove', handlePointer);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointer);
      cancelAnimationFrame(reqIdRef.current);
      if (containerRef.current && renderer.domElement) containerRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []); 

  const updateCursorPos = (ndcX: number, ndcY: number) => {
     if(!cameraRef.current) return;
     const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
     vec.unproject(cameraRef.current);
     const dir = vec.sub(cameraRef.current.position).normalize();
     const dist = (0 - cameraRef.current.position.z) / dir.z; 
     const pos = cameraRef.current.position.clone().add(dir.multiplyScalar(dist));
     handPosRef.current.lerp(pos, 0.4); 
  };

  // --- GAMEPLAY LOGIC ---

  const spawnNode = (pt: any) => {
      if(!sceneRef.current) return;
      const group = new THREE.Group();
      
      let geo: THREE.BufferGeometry = new THREE.OctahedronGeometry(0.4, 0); 
      let col = levelDataRef.current.color;
      let em = 0.5;

      if(pt.t === NodeType.GOLD) { col = 0xffea00; geo = new THREE.IcosahedronGeometry(0.45, 1); em = 1.0; }
      if(pt.t === NodeType.HAZARD) { 
        col = settingsRef.current.colorblindMode ? 0xffffff : 0xff0055; 
        geo = new THREE.TetrahedronGeometry(0.5, 0); 
        em = 2.0; 
      }
      if(pt.t === NodeType.HOLD) {
        col = 0x00eaff;
        geo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
        (geo as any).rotateX(Math.PI/2);
      }

      const mat = new THREE.MeshStandardMaterial({
          color: 0x000000, emissive: col, emissiveIntensity: em,
          metalness: 0.9, roughness: 0.1
      });
      const core = new THREE.Mesh(geo, mat);
      
      // Approach Indicator
      const ringGeo = new THREE.RingGeometry(0.55, 0.6, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.name = 'approach';
      ring.scale.set(3,3,3); 

      group.add(core, ring);

      if(pt.t === NodeType.HOLD) {
          const progGeo = new THREE.RingGeometry(0.3, 0.4, 32);
          const progMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side:THREE.DoubleSide });
          const prog = new THREE.Mesh(progGeo, progMat);
          prog.name = 'holdProg';
          prog.scale.set(0,0,0);
          group.add(prog);
      }

      group.position.set(pt.x, pt.y, 0);
      group.userData = { 
          pt, 
          spawnTime: pt.time, 
          hit: false,
          holding: 0
      };
      group.scale.set(0,0,0);
      sceneRef.current.add(group);
      activeNodesRef.current.push(group);
  };

  const createFloater = (pos: THREE.Vector3, text: string, color: string, scale = 1.0) => {
    if(!sceneRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128; // Taller for better text
    const ctx = canvas.getContext('2d');
    if(ctx) {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.font = '900 60px "Rajdhani"';
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 80);
        // Add stroke
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(text, 128, 80);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.position.z += 1.5;
    sprite.scale.set(4 * scale, 2 * scale, 1);
    sprite.userData = { life: 0.8, velY: 0.08 };
    sceneRef.current.add(sprite);
    floatersRef.current.push(sprite);
  };

  const updateGameLogic = (t: number) => {
    if (!levelDataRef.current) return;

    // Synced Time
    const audioTime = audio.getCurrentTime();
    const mapTime = audioTime - gameStartTimeRef.current - (settingsRef.current.audioLatency / 1000);

    // 1. Spawning
    const lookahead = 1.5; 
    while(nextSpawnIndexRef.current < levelDataRef.current.pts.length) {
        const pt = levelDataRef.current.pts[nextSpawnIndexRef.current];
        if (pt.time <= mapTime + lookahead) {
            spawnNode(pt);
            nextSpawnIndexRef.current++;
            // Don't count hazards in total notes for accuracy
            if(pt.t !== NodeType.HAZARD) statsRef.current.totalNotes++;
        } else {
            break;
        }
    }

    // 2. Active Nodes
    const cursorRadius = 0.7;
    // Strictness: 0.08s Perfect, 0.2s Good
    const hitWindowPerfect = 0.08; 
    const hitWindowGood = 0.22;

    for (let i = activeNodesRef.current.length - 1; i >= 0; i--) {
        const group = activeNodesRef.current[i];
        const data = group.userData;
        const timeDiff = data.pt.time - mapTime;
        
        // Approach
        const approachFac = 1.0 - (timeDiff / lookahead);
        group.scale.setScalar(Math.max(0, Math.min(1.2, approachFac))); // Grow in
        
        const ring = group.getObjectByName('approach');
        if(ring) {
            const rScale = 1.0 + Math.max(0, timeDiff * 2);
            ring.scale.setScalar(rScale);
            (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - Math.abs(timeDiff));
        }

        const dist = handPosRef.current.distanceTo(group.position);
        const isHover = dist < cursorRadius;

        if (!data.hit) {
            // --- HAZARD ---
            if (data.pt.t === NodeType.HAZARD) {
                if (isHover && Math.abs(timeDiff) < 0.8) { 
                    audio.miss();
                    statsRef.current.hp -= 20;
                    statsRef.current.combo = 0;
                    createFloater(group.position, "AVOID!", "#ff0055", 1.2);
                    if(!settingsRef.current.reduceMotion && cyberPassRef.current) cyberPassRef.current.uniforms.amount.value = 2.0;
                    data.hit = true; 
                    group.visible = false;
                }
            } 
            // --- TAP NODES ---
            else if (data.pt.t !== NodeType.HOLD) {
                if (isHover && Math.abs(timeDiff) <= hitWindowGood) {
                    const isGold = data.pt.t === NodeType.GOLD;
                    const absDiff = Math.abs(timeDiff);
                    let grade: HitGrade = 'GOOD';
                    let points = 50;
                    
                    if (absDiff <= hitWindowPerfect) {
                        grade = 'PERFECT';
                        points = 150;
                        statsRef.current.hp = Math.min(100, statsRef.current.hp + 4);
                    } else {
                        statsRef.current.hp = Math.min(100, statsRef.current.hp + 2);
                    }

                    audio.hit(isGold);
                    
                    statsRef.current.score += (points * (1 + statsRef.current.combo * 0.1)) + (isGold ? 500 : 0);
                    statsRef.current.combo++;
                    if(statsRef.current.combo > statsRef.current.maxCombo) statsRef.current.maxCombo = statsRef.current.combo;
                    statsRef.current.hits++;

                    // Impact FX
                    if (cursorRef.current && cursorRef.current.userData.shell) {
                        cursorRef.current.userData.shell.scale.set(1.5,1.5,1.5);
                    }
                    
                    // Trigger Camera Shake
                    if ((grade === 'PERFECT' || isGold) && !settingsRef.current.reduceMotion) {
                        shakeIntensityRef.current = 0.3;
                    }

                    const colorHex = isGold ? "#ffea00" : (grade === 'PERFECT' ? "#00ff9d" : "#00eaff");
                    createFloater(group.position, isGold ? "GOLD!" : grade, colorHex, grade === 'PERFECT' ? 1.2 : 0.9);
                    spawnExplosion(group.position, isGold ? 0xffea00 : levelDataRef.current.color);
                    
                    data.hit = true;
                    group.visible = false;
                }
            }
            // --- HOLD ---
            else if (data.pt.t === NodeType.HOLD) {
                 if (timeDiff <= hitWindowGood && timeDiff >= -data.pt.duration - hitWindowGood) {
                     if (isHover) {
                         data.holding += 0.016; 
                         audio.hitHold();
                         const prog = group.getObjectByName('holdProg');
                         if(prog) {
                             prog.scale.setScalar(1.0 + Math.sin(t*30)*0.1);
                             // Make cursor shake a bit while holding
                             if(!settingsRef.current.reduceMotion) handPosRef.current.addScalar((Math.random()-0.5)*0.02);
                         }
                         
                         if (data.holding >= data.pt.duration * 0.9 && !data.completed) {
                             audio.hit(true);
                             statsRef.current.score += 500;
                             statsRef.current.combo++;
                             statsRef.current.hits++;
                             createFloater(group.position, "COMPLETE", "#00eaff");
                             data.hit = true;
                             data.completed = true;
                             group.visible = false;
                         }
                     }
                 }
            }

            // MISS
            if (timeDiff < -hitWindowGood - (data.pt.duration || 0)) {
                 if (data.pt.t !== NodeType.HAZARD) {
                     audio.miss();
                     statsRef.current.combo = 0;
                     statsRef.current.hp -= 12;
                     createFloater(group.position, "MISS", "#666666", 0.8);
                 }
                 data.hit = true; 
                 group.visible = false;
            }
        }
        
        if (data.hit || timeDiff < -3.0) {
            sceneRef.current?.remove(group);
            activeNodesRef.current.splice(i, 1);
        }
    }

    // Calc Accuracy
    if (statsRef.current.totalNotes > 0) {
        statsRef.current.accuracy = Math.floor((statsRef.current.hits / statsRef.current.totalNotes) * 100);
    }

    onStatsUpdate({...statsRef.current});
    
    // Level End
    if (nextSpawnIndexRef.current >= levelDataRef.current.pts.length && activeNodesRef.current.length === 0) {
        audio.win();
        onGameEnd(true, statsRef.current);
    }
    
    // Fail
    if (statsRef.current.hp <= 0) {
        audio.gameOver();
        onGameEnd(false, statsRef.current);
    }
  };

  const updateVisuals = (t: number, dt: number) => {
      const energy = audio.getEnergy();
      
      // Cursor Shell Recoil
      if (cursorRef.current && cursorRef.current.userData.shell) {
          cursorRef.current.userData.shell.scale.lerp(new THREE.Vector3(1,1,1), 0.2);
          cursorRef.current.children[0].rotation.y += 2 * dt; // Spin core
      }

      if (tunnelRef.current) {
          tunnelRef.current.children.forEach((ring, i) => {
              ring.position.z += (8 + (energy * 10)) * dt; // Speed up with music
              if (ring.position.z > 5) ring.position.z -= 100;
              
              const s = 1.0 + (energy * 0.8 * Math.sin(i*0.3 + t));
              ring.scale.set(s, s, 1);
              
              const hue = (levelDataRef.current.color / 0xffffff) + (t*0.1);
              (ring.material as THREE.MeshBasicMaterial).color.setHSL(hue % 1, 0.7, 0.2 + energy * 0.5);
          });
      }

      // Cursor Trail
      if (cursorRef.current) {
          cursorRef.current.position.lerp(handPosRef.current, 0.5); // Tighter tracking
          
          const arr = cursorRef.current.userData.trail;
          arr.unshift(cursorRef.current.position.clone());
          if(arr.length > 25) arr.pop();
          
          const posAttr = cursorRef.current.userData.trailMesh.geometry.attributes.position;
          for(let i=0; i<arr.length; i++) {
              posAttr.setXYZ(i, arr[i].x, arr[i].y, arr[i].z);
          }
          posAttr.needsUpdate = true;
      }
      
      // Floaters
      for(let i=floatersRef.current.length-1; i>=0; i--) {
          const s = floatersRef.current[i];
          s.position.y += s.userData.velY;
          s.material.opacity = s.userData.life;
          s.userData.life -= dt * 1.5;
          if(s.userData.life <= 0) {
              sceneRef.current?.remove(s);
              floatersRef.current.splice(i, 1);
          }
      }
      
      // Particles
      for(let i=particlesRef.current.length-1; i>=0; i--) {
        const p = particlesRef.current[i];
        p.userData.life -= dt;
        const pos = p.geometry.attributes.position;
        const vels = p.userData.vels;
        for(let j=0; j<pos.count; j++) {
            pos.setXYZ(j, pos.getX(j)+vels[j].x, pos.getY(j)+vels[j].y, pos.getZ(j)+vels[j].z);
        }
        pos.needsUpdate = true;
        p.material.opacity = p.userData.life;
        if(p.userData.life <= 0) { sceneRef.current?.remove(p); particlesRef.current.splice(i,1); }
      }

      // Camera Shake
      if (cameraRef.current) {
          if (shakeIntensityRef.current > 0) {
              const s = shakeIntensityRef.current;
              cameraRef.current.position.x = (Math.random() - 0.5) * s;
              cameraRef.current.position.y = (Math.random() - 0.5) * s;
              shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - dt * 3.0);
          } else {
              cameraRef.current.position.x = 0;
              cameraRef.current.position.y = 0;
          }
      }

      if (cyberPassRef.current) cyberPassRef.current.uniforms.amount.value *= 0.95;
  };
  
  const spawnExplosion = (pos: THREE.Vector3, col: number) => {
     if(!sceneRef.current) return;
     const geo = new THREE.BufferGeometry();
     const pCount = 20;
     const posArr = new Float32Array(pCount*3);
     const vels = [];
     for(let i=0;i<pCount;i++){
         posArr[i*3]=pos.x; posArr[i*3+1]=pos.y; posArr[i*3+2]=pos.z;
         const v = new THREE.Vector3((Math.random()-.5),(Math.random()-.5),(Math.random()-.5)).normalize().multiplyScalar(0.1 + Math.random()*0.2);
         vels.push(v);
     }
     geo.setAttribute('position', new THREE.BufferAttribute(posArr,3));
     const mat = new THREE.PointsMaterial({color:col, size:0.25, transparent:true, blending:THREE.AdditiveBlending});
     const pts = new THREE.Points(geo, mat);
     pts.userData = { life: 0.6, vels };
     sceneRef.current.add(pts);
     particlesRef.current.push(pts);
  };

  // --- LEVEL INIT ---
  useEffect(() => {
    if (gameState === GameState.COUNTDOWN) {
        // Prepare scene but wait
        activeNodesRef.current.forEach(n => sceneRef.current?.remove(n));
        activeNodesRef.current = [];
        statsRef.current = { hp: 100, score: 0, combo: 0, maxCombo: 0, accuracy: 100, hits: 0, totalNotes: 0 };
        nextSpawnIndexRef.current = 0;
        levelDataRef.current = LEVELS[levelIndex];
    }
    else if (gameState === GameState.PLAYING) {
        audio.init();
        audio.startMusic(levelDataRef.current.bpm);
        gameStartTimeRef.current = audio.getCurrentTime();
    } else {
        audio.stopMusic();
    }
  }, [gameState, levelIndex]);

  // --- WEBCAM ---
  useEffect(() => {
      const initCam = async () => {
        if (videoRef.current) {
            const success = await onRequestCam(videoRef.current);
            if(success) {
                try {
                    const Hands = (window as any).Hands;
                    const Camera = (window as any).Camera;
                    if(!Hands || !Camera) return;

                    const hands = new Hands({locateFile: (f:string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
                    hands.setOptions({ maxNumHands: 1, minDetectionConfidence: 0.7, modelComplexity: 1 });
                    
                    hands.onResults((res: any) => {
                         if(res.multiHandLandmarks && res.multiHandLandmarks[0]) {
                             const p = res.multiHandLandmarks[0][8]; 
                             updateCursorPos((1 - p.x) * 2 - 1, -(p.y * 2 - 1));
                         }
                    });
                    const cam = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (videoRef.current && videoRef.current.videoWidth > 0) await hands.send({image: videoRef.current});
                        },
                        width: 320, height: 240
                    });
                    cam.start();
                } catch (e) {}
            }
        }
      };
      initCam();
  }, []);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />
      <video ref={videoRef} className="fixed bottom-6 left-6 w-32 h-24 rounded border-2 border-neon-green/30 object-cover scale-x-[-1] opacity-0 z-20" playsInline autoPlay muted />
    </>
  );
};