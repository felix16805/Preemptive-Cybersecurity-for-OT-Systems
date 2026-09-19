"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows, OrbitControls, PerspectiveCamera, Bounds, Center } from "@react-three/drei";
import * as THREE from "three";

interface ModelProps {
  url: string;
  modelXOffset: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableMouseParallax: boolean;
  enableHoverRotation: boolean;
  defaultRotationX: number;
  defaultRotationY: number;
  defaultRotationZ: number;
}

function Model({ url, modelXOffset, autoRotate, autoRotateSpeed, enableMouseParallax, enableHoverRotation, defaultRotationX, defaultRotationY, defaultRotationZ }: ModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.order = 'YXZ';
      // NOTE: previously this was (15.8 + 90) degrees, which produced a steep
      // diagonal tilt. The +90 was removed in the last fix; defaultRotationZ
      // now defaults to 0 so the model sits flat unless you deliberately tilt it.
      groupRef.current.rotation.z = (defaultRotationZ * Math.PI) / 180;
      groupRef.current.rotation.x = (defaultRotationX * Math.PI) / 180;
      groupRef.current.rotation.y = ((defaultRotationY - 90) * Math.PI) / 180;
    }
  }, [defaultRotationX, defaultRotationY, defaultRotationZ]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Auto rotation
    if (autoRotate) {
      groupRef.current.rotation.y += autoRotateSpeed * delta * 50;
    }

    // Hover rotation (additional local rotation if needed)
    if (enableHoverRotation && hovered) {
      groupRef.current.rotation.y += 0.5 * delta;
    }

    // Mouse parallax
    if (enableMouseParallax) {
      const targetX = (state.pointer.x * 0.1);
      const targetY = (state.pointer.y * 0.1);
      groupRef.current.position.x += (targetX - groupRef.current.position.x) * 0.05;
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.05;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[modelXOffset, 0, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Scale normalized so it fits perfectly in the camera view */}
      <Center scale={0.05}>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

// Preload the models
useGLTF.preload("/safecut_ot_pipeline_graph_v4.glb");

export interface ModelViewerProps {
  url: string;
  width?: string | number;
  height?: string | number;
  enableMouseParallax?: boolean;
  enableHoverRotation?: boolean;
  enableManualZoom?: boolean;
  enableManualRotation?: boolean;
  showScreenshotButton?: boolean;
  ambientIntensity?: number;
  keyLightIntensity?: number;
  rimLightIntensity?: number;
  environmentPreset?: string;
  defaultZoom?: number;
  modelXOffset?: number;
  defaultRotationX?: number;
  defaultRotationY?: number;
  defaultRotationZ?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  pulseZoom?: boolean;
  autoFrame?: boolean;
}

export default function ModelViewer({
  url,
  width = "100%",
  height = "100%",
  enableMouseParallax = false,
  enableHoverRotation = false,
  enableManualZoom = false,
  enableManualRotation = false,
  ambientIntensity = 0.85,
  keyLightIntensity = 2.2,
  rimLightIntensity = 1.2,
  environmentPreset = "city",
  defaultZoom = 2.0,
  modelXOffset = 0,
  defaultRotationX = 35,
  defaultRotationY = 10,
  defaultRotationZ = 0,
  autoRotate = true,
  autoRotateSpeed = -0.01,
  autoFrame = false,
}: ModelViewerProps) {

  return (
    <div style={{ width, height, position: 'relative' }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        gl={{ powerPreference: "high-performance", antialias: false }}
      >
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 10 / defaultZoom]}
          fov={45}
        />

        <ambientLight intensity={ambientIntensity} />
        <directionalLight position={[10, 10, 5]} intensity={keyLightIntensity} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={rimLightIntensity} />

        {/* Environment map to give the PBR materials rich realistic reflections */}
        {environmentPreset && <Environment preset={environmentPreset as any} />}

        <Bounds fit={autoFrame} clip observe margin={1.2}>
          <Model
            url={url}
            modelXOffset={modelXOffset}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            enableMouseParallax={enableMouseParallax}
            enableHoverRotation={enableHoverRotation}
            defaultRotationX={defaultRotationX}
            defaultRotationY={defaultRotationY}
            defaultRotationZ={defaultRotationZ}
          />
        </Bounds>

        <ContactShadows
          position={[0, -2, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
          frames={1}
        />
      </Canvas>
    </div>
  );
}