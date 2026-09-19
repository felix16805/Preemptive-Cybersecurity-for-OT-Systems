"use client";

import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import './GhostFibers.css';

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.trim().replace(/^#/, '');
  const norm = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(norm);
  if (!m) return [1, 1, 1];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
};

const setColor = (uniform: { value: Float32Array }, hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  uniform.value[0] = r; uniform.value[1] = g; uniform.value[2] = b;
};

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 uResolution; uniform float uTime; uniform float uSpeed; uniform float uScale;
uniform float uRotation; uniform float uLayers; uniform float uWaveAmplitude; uniform float uWaveFrequency;
uniform float uWaveSpeed; uniform float uLayerSpeed; uniform float uTwist; uniform float uTwistFrequency;
uniform float uTwistSpeed; uniform float uLineFrequency; uniform float uLineSpacing; uniform float uLineSharpness;
uniform float uGlowFalloff; uniform float uGlowIntensity; uniform float uBrightness; uniform float uBlueBoost;
uniform float uVignette; uniform float uGrain; uniform float uRotationSpeed; uniform float uLightMode;
uniform vec3 uLineColor; uniform vec3 uGlowColor;
out vec4 fragColor;
#define MAX_LAYERS 10
mat2 rotate2d(float a){ float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
float grainHash(vec2 p){ p=floor(p); return fract(52.9829189*fract(dot(p,vec2(0.065,0.005)))); }
float layeredGrain(vec2 fp){
  vec2 pt=mod(fp+vec2(uTime*30.,-uTime*21.),1024.);
  vec2 r=mat2(0.8,-0.5,0.5,0.8)*pt; float g=0.;
  g+=0.40*grainHash(r); g+=0.25*grainHash(r*2.+17.); g+=0.20*grainHash(r*4.+47.);
  g+=0.10*grainHash(r*8.+113.); g+=0.05*grainHash(r*16.+191.); return g;
}
void main(){
  vec2 res=max(uResolution,vec2(1.)); vec2 uv=(2.*gl_FragCoord.xy-res)/res.y;
  float time=uTime*uSpeed;
  vec3 backdrop=mix(vec3(0.0706,0.0588,0.0902),vec3(1.),step(0.5,uLightMode));
  vec3 centerTone=max(uLineColor*0.85567-uGlowColor*0.06186,vec3(0.));
  vec3 cloudTone=uLineColor*0.19588+uGlowColor*0.2268;
  vec2 p=uv/max(uScale,0.05);
  p=rotate2d(radians(uRotation)+time*uRotationSpeed)*p;
  vec3 color=vec3(0.); float fiberField=0.;
  for(int i=0;i<MAX_LAYERS;i++){
    float fi=float(i)+1.; if(fi>uLayers)break;
    p+=uWaveAmplitude*sin(p.yx*fi*uWaveFrequency+time*(uWaveSpeed+fi*uLayerSpeed));
    float rad=length(p); float pa=atan(p.y,p.x);
    pa+=sin(rad*uTwistFrequency-time*uTwistSpeed+fi)*uTwist;
    p=vec2(cos(pa),sin(pa))*rad;
    float lines=abs(sin(p.x*(uLineFrequency+fi*uLineSpacing)+sin(p.y*3.+time)));
    lines=pow(max(0.,1.-lines),uLineSharpness); fiberField+=lines/fi;
    color+=uLineColor*lines/fi;
    float glow=exp(-uGlowFalloff*abs(sin(p.x*3.+time+fi)));
    color+=uGlowColor*glow*uGlowIntensity/(fi*2.);
  }
  float center=exp(-2.2*dot(uv,uv)); color+=centerTone*center;
  float cloud=exp(-1.5*length(uv+vec2(sin(time*.3)*.25,cos(time*.25)*.18)));
  color+=cloudTone*cloud;
  float vig=1.-smoothstep(0.35,1.45,length(uv));
  color*=mix(1.-uVignette,1.,vig);
  color=1.-exp(-color*uBrightness); color.b*=uBlueBoost;
  vec3 out_color;
  if(uLightMode>0.5){
    float ef=mix(1.-uVignette,1.,vig);
    float fibers=pow(smoothstep(0.12,1.05,fiberField)*ef,1.5);
    float atm=(center*.025+cloud*.015)*ef;
    vec3 fiberInk=mix(backdrop,uLineColor,0.52); vec3 airColor=mix(backdrop,uGlowColor,0.16);
    out_color=mix(backdrop,airColor,atm); out_color=mix(out_color,fiberInk,fibers*.3);
  } else { out_color=backdrop+color; }
  float noise=(layeredGrain(gl_FragCoord.xy)-.5)*uGrain;
  out_color=clamp(out_color+noise,0.,1.); fragColor=vec4(out_color,1.);
}`;

const contexts = new WeakMap<Element, any>();

interface GhostFibersProps {
  lineColor?: string;
  glowColor?: string;
  speed?: number;
  scale?: number;
  rotation?: number;
  rotationSpeed?: number;
  layers?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  waveSpeed?: number;
  layerSpeed?: number;
  twist?: number;
  twistFrequency?: number;
  twistSpeed?: number;
  lineFrequency?: number;
  lineSpacing?: number;
  lineSharpness?: number;
  glowFalloff?: number;
  glowIntensity?: number;
  brightness?: number;
  blueBoost?: number;
  vignette?: number;
  grain?: number;
  lightMode?: boolean;
  dpr?: number;
  fps?: number;
  paused?: boolean;
  className?: string;
}

const GhostFibers = ({
  lineColor = '#111318', glowColor = '#C8862B',
  speed = 0.08, scale = 3, rotation = 0, rotationSpeed = 0.1,
  layers = 2, waveAmplitude = 0.015, waveFrequency = 3,
  waveSpeed = 0.15, layerSpeed = 0.08, twist = 0.1,
  twistFrequency = 5, twistSpeed = 1.2, lineFrequency = 5,
  lineSpacing = 2, lineSharpness = 16, glowFalloff = 10,
  glowIntensity = 0.6, brightness = 1, blueBoost = 1.0,
  vignette = 0.5, grain = 0.02,
  lightMode = true, dpr = 1, fps = 60, paused = false, className = '',
}: GhostFibersProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ webgl: 2, alpha: false, antialias: false, dpr: Math.min(Math.max(dpr, 0.5), 2) });
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex, fragment,
      uniforms: {
        uResolution: { value: new Float32Array([1, 1]) },
        uTime: { value: 0 }, uSpeed: { value: 0.08 }, uScale: { value: 3 },
        uRotation: { value: 0 }, uRotationSpeed: { value: 0.1 }, uLayers: { value: 2 },
        uWaveAmplitude: { value: 0.015 }, uWaveFrequency: { value: 3 },
        uWaveSpeed: { value: 0.15 }, uLayerSpeed: { value: 0.08 }, uTwist: { value: 0.1 },
        uTwistFrequency: { value: 5 }, uTwistSpeed: { value: 1.2 },
        uLineFrequency: { value: 5 }, uLineSpacing: { value: 2 }, uLineSharpness: { value: 16 },
        uGlowFalloff: { value: 10 }, uGlowIntensity: { value: 0.6 }, uBrightness: { value: 1 },
        uBlueBoost: { value: 1.0 }, uVignette: { value: 0.5 }, uGrain: { value: 0.02 },
        uLightMode: { value: 1 },
        uLineColor: { value: new Float32Array(hexToRgb('#111318')) },
        uGlowColor: { value: new Float32Array(hexToRgb('#C8862B')) },
      }
    });
    const mesh = new Mesh(gl, { geometry, program });

    let frameId = 0, elapsed = 0, previousTime = performance.now(), lastRenderTime = 0;
    let frameRate = 60, isPaused = false, isVisible = true, isPageVisible = !document.hidden;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const render = () => renderer.render({ scene: mesh });
    const stop = () => { if (frameId !== 0) cancelAnimationFrame(frameId); frameId = 0; };
    const canAnimate = () => isVisible && isPageVisible && !isPaused && !reducedMotion.matches;

    const loop = (now: number) => {
      frameId = 0;
      if (!canAnimate()) return;
      const delta = Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now; elapsed += delta;
      if (now - lastRenderTime >= 1000 / frameRate - 0.5) {
        program.uniforms.uTime.value = elapsed;
        render(); lastRenderTime = now;
      }
      frameId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!canAnimate() || frameId !== 0) return;
      previousTime = performance.now();
      frameId = requestAnimationFrame(loop);
    };

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      program.uniforms.uResolution.value[0] = gl.drawingBufferWidth;
      program.uniforms.uResolution.value[1] = gl.drawingBufferHeight;
      render();
    };

    const handleVisibility = () => { isPageVisible = !document.hidden; if (canAnimate()) start(); else stop(); };
    const handleReducedMotion = () => { if (canAnimate()) start(); else { stop(); render(); } };

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (canAnimate()) start(); else stop();
    }, { threshold: 0 });
    intersectionObserver.observe(container);
    document.addEventListener('visibilitychange', handleVisibility);
    reducedMotion.addEventListener('change', handleReducedMotion);

    contexts.set(container, {
      renderer, program, mesh, render,
      setPaused(v: boolean) { isPaused = v; if (canAnimate()) start(); else { stop(); render(); } },
      setFps(v: number) { frameRate = Math.min(Math.max(v, 1), 120); }
    });

    setSize(); start();

    return () => {
      stop(); resizeObserver.disconnect(); intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener('change', handleReducedMotion);
      contexts.delete(container);
      if (canvas.parentNode === container) container.removeChild(canvas);
      (gl.getExtension('WEBGL_lose_context') as any)?.loseContext();
    };
  }, [dpr]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ctx = contexts.get(container);
    if (!ctx) return;
    const u = ctx.program.uniforms;
    setColor(u.uLineColor, lineColor); setColor(u.uGlowColor, glowColor);
    u.uSpeed.value = speed; u.uScale.value = scale; u.uRotation.value = rotation;
    u.uRotationSpeed.value = rotationSpeed; u.uLayers.value = Math.min(Math.max(Math.round(layers), 1), 10);
    u.uWaveAmplitude.value = waveAmplitude; u.uWaveFrequency.value = waveFrequency;
    u.uWaveSpeed.value = waveSpeed; u.uLayerSpeed.value = layerSpeed;
    u.uTwist.value = twist; u.uTwistFrequency.value = twistFrequency; u.uTwistSpeed.value = twistSpeed;
    u.uLineFrequency.value = lineFrequency; u.uLineSpacing.value = lineSpacing; u.uLineSharpness.value = lineSharpness;
    u.uGlowFalloff.value = glowFalloff; u.uGlowIntensity.value = glowIntensity;
    u.uBrightness.value = brightness; u.uBlueBoost.value = blueBoost;
    u.uVignette.value = vignette; u.uGrain.value = grain;
    u.uLightMode.value = lightMode ? 1 : 0;
    ctx.setFps(fps); ctx.setPaused(paused); ctx.render();
  }, [lineColor, glowColor, speed, scale, rotation, rotationSpeed, layers, waveAmplitude,
      waveFrequency, waveSpeed, layerSpeed, twist, twistFrequency, twistSpeed, lineFrequency,
      lineSpacing, lineSharpness, glowFalloff, glowIntensity, brightness, blueBoost, vignette,
      grain, lightMode, fps, paused, dpr]);

  return <div ref={containerRef} className={`ghost-fibers-container ${className}`.trim()} />;
};

export default GhostFibers;
