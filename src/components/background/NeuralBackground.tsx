"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const STAR_COUNT = 260;

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function isLowPowerDevice(): boolean {
  if (typeof window === "undefined") return false;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  
  // NOTE: Temporarily commented out for development so it renders reliably.
  // Uncomment before pushing to production if you want strict performance limits.
  // const smallScreen = window.matchMedia("(max-width: 900px)").matches;
  // const lowMemory = typeof navigator !== "undefined" && "deviceMemory" in navigator
  //   ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 4
  //   : false;
  // const lowCpu = typeof navigator !== "undefined" && navigator.hardwareConcurrency <= 4;

  return reducedMotion; // || smallScreen || lowMemory || lowCpu;
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.3, "rgba(255,255,255,0.8)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

interface CometData {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  color: number;
  trailHistory: THREE.Vector3[];
}

function Comet({ data, onDead }: { data: CometData; onDead: (id: number) => void }) {
  const headRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Line>(null);
  const cometData = useRef(data);

  useFrame(() => {
    const c = cometData.current;

    c.position.add(c.velocity);
    c.velocity.multiplyScalar(0.98);

    if (headRef.current) {
      headRef.current.position.copy(c.position);
      headRef.current.scale.setScalar(c.life);
    }

    c.trailHistory.shift();
    c.trailHistory.push(c.position.clone());

    if (trailRef.current) {
      const positions = trailRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < c.trailHistory.length; i++) {
        const p = c.trailHistory[i];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }
      trailRef.current.geometry.attributes.position.needsUpdate = true;
      (trailRef.current.material as THREE.LineBasicMaterial).opacity = c.life;
    }

    c.life -= 0.015;
    if (c.life <= 0) onDead(c.id);
  });

  const trailGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(15 * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <group>
      <mesh ref={headRef} position={data.position}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshBasicMaterial color={0xffffff} blending={THREE.AdditiveBlending} />
      </mesh>
      <primitive
        object={
          new THREE.Line(
            trailGeometry,
            new THREE.LineBasicMaterial({
              color: data.color,
              transparent: true,
              opacity: 0.8,
              blending: THREE.AdditiveBlending,
            }),
          )
        }
        ref={trailRef}
      />
    </group>
  );
}

interface NeuralCoreProps {
  starCount: number;
  connectionDistance: number;
  reducedMotion: boolean;
}

function NeuralCore({ starCount, connectionDistance, reducedMotion }: NeuralCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const [comets, setComets] = useState<CometData[]>([]);
  const cometIdRef = useRef(0);
  const currentColor = useRef(new THREE.Color(0x00d2ff));
  const { gl } = useThree();

  const glowTexture = useMemo(() => createGlowTexture(), []);

  const { starPositions, linePositions } = useMemo(() => {
    const positions: number[] = [];
    const radius = 120;

    for (let i = 0; i < starCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / starCount);
      const theta = Math.sqrt(starCount * Math.PI) * phi;
      positions.push(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi),
      );
    }

    const linePos: number[] = [];
    for (let i = 0; i < starCount; i++) {
      for (let j = i + 1; j < starCount; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < connectionDistance) {
          linePos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          linePos.push(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
        }
      }
    }

    return {
      starPositions: new Float32Array(positions),
      linePositions: new Float32Array(linePos),
    };
  }, [connectionDistance, starCount]);

  const shedSkin = () => {
    if (!starsRef.current || !groupRef.current || reducedMotion) return;

    const positions = starsRef.current.geometry.attributes.position.array;
    const worldMatrix = starsRef.current.matrixWorld;
    const count = positions.length / 3;
    const oldColorHex = currentColor.current.getHex();

    const newComets: CometData[] = [];

    for (let i = 0; i < count; i += 3) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const vector = new THREE.Vector3(x, y, z).applyMatrix4(worldMatrix);
      const direction = vector.clone().normalize().multiplyScalar(Math.random() * 10 + 5);

      const trailHistory: THREE.Vector3[] = [];
      for (let j = 0; j < 15; j++) trailHistory.push(vector.clone());

      newComets.push({
        id: cometIdRef.current++,
        position: vector.clone(),
        velocity: direction,
        life: 1,
        color: oldColorHex,
        trailHistory,
      });
    }

    setComets((prev) => [...prev, ...newComets]);

    const hue = Math.random();
    currentColor.current.setHSL(hue, 1, 0.6);
    if (starsRef.current) {
      (starsRef.current.material as THREE.PointsMaterial).color.set(currentColor.current);
    }
    if (linesRef.current) {
      (linesRef.current.material as THREE.LineBasicMaterial).color.set(currentColor.current);
    }
  };

  useEffect(() => {
    if (reducedMotion) return;

    const handleClick = () => shedSkin();
    gl.domElement.addEventListener("mousedown", handleClick);
    gl.domElement.addEventListener("touchstart", handleClick, { passive: true });

    return () => {
      gl.domElement.removeEventListener("mousedown", handleClick);
      gl.domElement.removeEventListener("touchstart", handleClick);
    };
  }, [gl, reducedMotion]);

  useFrame(() => {
    if (!groupRef.current) return;

    if (!reducedMotion) {
      const scrollY = window.pageYOffset;
      const scrollP = scrollY / (document.body.scrollHeight - window.innerHeight || 1);

      groupRef.current.rotation.y += 0.004;
      groupRef.current.rotation.x += 0.0015;

      const scale = 1 + scrollP * 3.5;
      groupRef.current.scale.set(scale, scale, scale);
    }
  });

  const removeComet = (id: number) => {
    setComets((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <>
      <group ref={groupRef}>
        <points ref={starsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={starPositions.length / 3}
              array={starPositions}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={10}
            map={glowTexture}
            transparent
            color={currentColor.current}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={linePositions.length / 3}
              array={linePositions}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={currentColor.current} transparent opacity={0.18} blending={THREE.AdditiveBlending} />
        </lineSegments>
      </group>

      {comets.map((comet) => (
        <Comet key={comet.id} data={comet} onDead={removeComet} />
      ))}
    </>
  );
}

function FallbackBackground() {
  return (
    <div
      className="fixed inset-0 z-0"
      style={{
        background: "radial-gradient(ellipse at center, #0a1628 0%, #010103 70%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, rgba(0, 210, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)",
        }}
      />
    </div>
  );
}

export function NeuralBackground() {
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [useLiteMode, setUseLiteMode] = useState(false);

  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setUseLiteMode(isLowPowerDevice());
  }, []);

  if (webGLSupported === null) {
    return <div className="fixed inset-0 z-0" style={{ background: "#010103" }} />;
  }

  if (!webGLSupported || useLiteMode) {
    return <FallbackBackground />;
  }

  return (
    <div className="fixed inset-0 z-0" style={{ background: "#010103" }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 500], fov: 60, near: 1, far: 3000 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x010103, 1);
        }}
        fallback={<FallbackBackground />}
      >
        <fog attach="fog" args={[0x010103, 0, 1000]} />
        <NeuralCore starCount={STAR_COUNT} connectionDistance={48} reducedMotion={reducedMotion} />
      </Canvas>
      <div className="absolute inset-0 pointer-events-none" />
    </div>
  );
        }
