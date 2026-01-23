import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const STAR_COUNT = 300;

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'transparent');
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
    
    // Physics
    c.position.add(c.velocity);
    c.velocity.multiplyScalar(0.98);
    
    // Update head
    if (headRef.current) {
      headRef.current.position.copy(c.position);
      headRef.current.scale.setScalar(c.life);
    }
    
    // Update trail
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
    if (c.life <= 0) {
      onDead(c.id);
    }
  });

  const trailGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(15 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <group>
      <mesh ref={headRef} position={data.position}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshBasicMaterial color={0xffffff} blending={THREE.AdditiveBlending} />
      </mesh>
      <primitive object={new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({
        color: data.color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      }))} ref={trailRef} />
    </group>
  );
}

function NeuralCore() {
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

    // Fibonacci sphere distribution
    for (let i = 0; i < STAR_COUNT; i++) {
      const phi = Math.acos(-1 + (2 * i) / STAR_COUNT);
      const theta = Math.sqrt(STAR_COUNT * Math.PI) * phi;
      positions.push(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      );
    }

    // Connect nearby stars
    const linePos: number[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      for (let j = i + 1; j < STAR_COUNT; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 50) {
          linePos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          linePos.push(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
        }
      }
    }

    return {
      starPositions: new Float32Array(positions),
      linePositions: new Float32Array(linePos),
    };
  }, []);

  const shedSkin = () => {
    if (!starsRef.current || !groupRef.current) return;

    const positions = starsRef.current.geometry.attributes.position.array;
    const worldMatrix = starsRef.current.matrixWorld;
    const count = positions.length / 3;
    const oldColorHex = currentColor.current.getHex();

    const newComets: CometData[] = [];

    for (let i = 0; i < count; i += 2) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const vector = new THREE.Vector3(x, y, z);
      vector.applyMatrix4(worldMatrix);

      const direction = vector.clone().normalize().multiplyScalar(Math.random() * 10 + 5);

      const trailHistory: THREE.Vector3[] = [];
      for (let j = 0; j < 15; j++) {
        trailHistory.push(vector.clone());
      }

      newComets.push({
        id: cometIdRef.current++,
        position: vector.clone(),
        velocity: direction,
        life: 1.0,
        color: oldColorHex,
        trailHistory,
      });
    }

    setComets((prev) => [...prev, ...newComets]);

    // Change color
    const hue = Math.random();
    currentColor.current.setHSL(hue, 1.0, 0.6);
    if (starsRef.current) {
      (starsRef.current.material as THREE.PointsMaterial).color.set(currentColor.current);
    }
    if (linesRef.current) {
      (linesRef.current.material as THREE.LineBasicMaterial).color.set(currentColor.current);
    }
  };

  useEffect(() => {
    const handleClick = () => shedSkin();
    gl.domElement.addEventListener('mousedown', handleClick);
    gl.domElement.addEventListener('touchstart', handleClick);
    return () => {
      gl.domElement.removeEventListener('mousedown', handleClick);
      gl.domElement.removeEventListener('touchstart', handleClick);
    };
  }, [gl]);

  useFrame(() => {
    if (!groupRef.current) return;

    const scrollY = window.pageYOffset;
    const scrollP = scrollY / (document.body.scrollHeight - window.innerHeight || 1);

    groupRef.current.rotation.y += 0.005;
    groupRef.current.rotation.x += 0.002;

    const scale = 1 + scrollP * 5;
    groupRef.current.scale.set(scale, scale, scale);
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
            size={12}
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
          <lineBasicMaterial
            color={currentColor.current}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      </group>
      {comets.map((comet) => (
        <Comet key={comet.id} data={comet} onDead={removeComet} />
      ))}
    </>
  );
}

export function NeuralBackground() {
  return (
    <div className="fixed inset-0 -z-10" style={{ background: '#010103' }}>
      <Canvas
        camera={{ position: [0, 0, 500], fov: 60, near: 1, far: 3000 }}
        gl={{ antialias: true, alpha: true }}
      >
        <fog attach="fog" args={[0x010103, 0, 1000]} />
        <NeuralCore />
      </Canvas>
      <div className="absolute inset-0 pointer-events-none">
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 uppercase tracking-widest">
          
        </p>
      </div>
    </div>
  );
}
