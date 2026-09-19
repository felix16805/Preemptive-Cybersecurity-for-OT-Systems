"use client";

import { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Status-driven colors matching the SafeCut palette
const COLORS = {
  safe: '#1F9D55',       // green — running normally
  compromised: '#C43D3D', // red — attacker entry point
  safetyLoop: '#B4790F', // amber — safety-critical, must be preserved
};

// A single pipe segment: a cylinder plus optional emissive end-caps
function PipeSegment({
  start,
  end,
  color,
  radius = 0.07,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  radius?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const startV = new THREE.Vector3(...start);
  const endV = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(endV, startV);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(startV, endV).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return (
    <group position={midpoint} quaternion={quaternion}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[radius, radius, length, 12, 1]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.55} />
      </mesh>
      {/* end-cap glow rings */}
      <mesh position={[0, length / 2, 0]}>
        <torusGeometry args={[radius + 0.01, 0.012, 8, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} roughness={0.2} />
      </mesh>
      <mesh position={[0, -length / 2, 0]}>
        <torusGeometry args={[radius + 0.01, 0.012, 8, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} roughness={0.2} />
      </mesh>
    </group>
  );
}

// A junction / node sphere
function NodeSphere({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.2} metalness={0.4} />
    </mesh>
  );
}

// The whole assembly — slow auto-rotate + mouse parallax via group ref
function PipelineAssembly() {
  const groupRef = useRef<THREE.Group>(null);
  const targetY = useRef(0);
  const targetX = useRef(0);

  // Mouse parallax
  if (typeof window !== 'undefined') {
    // Set up once using a closure
  }

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Slow base rotation
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.12;
    // Gentle bob
    groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.04;
  });

  return (
    <group ref={groupRef}>
      {/* Main horizontal backbone — green (safe) */}
      <PipeSegment start={[-1.8, 0, 0]} end={[-0.6, 0, 0]} color={COLORS.safe} />

      {/* Compromised segment — red */}
      <PipeSegment start={[-0.6, 0, 0]} end={[0.2, 0, 0]} color={COLORS.compromised} radius={0.085} />

      {/* Safety-critical loop — amber */}
      <PipeSegment start={[-0.6, 0, 0]} end={[-0.6, 0.7, 0]} color={COLORS.safetyLoop} />
      <PipeSegment start={[-0.6, 0.7, 0]} end={[0.2, 0.7, 0]} color={COLORS.safetyLoop} />
      <PipeSegment start={[0.2, 0.7, 0]} end={[0.2, 0, 0]} color={COLORS.safetyLoop} />

      {/* Downstream safe run — green */}
      <PipeSegment start={[0.2, 0, 0]} end={[1.8, 0, 0]} color={COLORS.safe} />

      {/* A branch down — green */}
      <PipeSegment start={[0.9, 0, 0]} end={[0.9, -0.6, 0]} color={COLORS.safe} />
      <PipeSegment start={[0.9, -0.6, 0]} end={[1.5, -0.6, 0]} color={COLORS.safe} />

      {/* Junction nodes */}
      <NodeSphere position={[-0.6, 0, 0]} color={COLORS.compromised} />
      <NodeSphere position={[0.2, 0, 0]} color={COLORS.safetyLoop} />
      <NodeSphere position={[0.9, 0, 0]} color={COLORS.safe} />
      <NodeSphere position={[-0.6, 0.7, 0]} color={COLORS.safetyLoop} />
      <NodeSphere position={[0.2, 0.7, 0]} color={COLORS.safetyLoop} />

      {/* Cut indicator — thin dashed ring at the cut point */}
      <mesh position={[-0.6, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.015, 8, 32]} />
        <meshStandardMaterial color="#C43D3D" emissive="#C43D3D" emissiveIntensity={2.5} roughness={0.1} />
      </mesh>
    </group>
  );
}

export default function HeroPipeline3D() {
  return (
    <div
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      <Canvas
        shadows={false}
        frameloop="always"
        dpr={[1, 1.5]}
        camera={{ fov: 42, position: [0, 0.4, 4.2], near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 4]} intensity={1.2} />
        <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#F5F3EE" />
        <pointLight position={[-0.6, 0, 0.5]} intensity={2} color="#C43D3D" distance={2} decay={2} />
        <pointLight position={[0, 0.7, 0.5]} intensity={1.5} color="#B4790F" distance={2} decay={2} />

        <Suspense fallback={null}>
          <PipelineAssembly />
        </Suspense>
      </Canvas>
    </div>
  );
}
