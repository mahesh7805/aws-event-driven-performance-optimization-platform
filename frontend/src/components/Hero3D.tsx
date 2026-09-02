import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';
import * as THREE from 'three';

interface NodeProps {
  position: [number, number, number];
  color: string;
  label: string;
}

const FloatingNode: React.FC<NodeProps> = ({ position, color, label }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.getElapsedTime() * 1.5 + position[0]) * 0.15;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <Text
        position={[0, 0.7, 0]}
        fontSize={0.25}
        color="#334155"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff"
      >
        {label}
      </Text>
    </group>
  );
};

const NetworkTopologyScene: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  const apiPos: [number, number, number] = [-4, 1.2, 0];
  const sqsPos: [number, number, number] = [-1.5, 0, 0];
  const worker1Pos: [number, number, number] = [1.5, 1.5, 0];
  const worker2Pos: [number, number, number] = [1.5, 0, 0];
  const worker3Pos: [number, number, number] = [1.5, -1.5, 0];
  const ddbPos: [number, number, number] = [4.2, 0, 0];

  return (
    <group ref={groupRef}>
      <FloatingNode position={apiPos} color="#38bdf8" label="API Gateway" />
      <FloatingNode position={sqsPos} color="#818cf8" label="SQS Queue" />
      <FloatingNode position={worker1Pos} color="#2dd4bf" label="Lambda Worker 1" />
      <FloatingNode position={worker2Pos} color="#2dd4bf" label="Lambda Worker 2" />
      <FloatingNode position={worker3Pos} color="#2dd4bf" label="Lambda Worker 3" />
      <FloatingNode position={ddbPos} color="#a78bfa" label="DynamoDB" />

      {/* Connection Lines */}
      <Line points={[apiPos, sqsPos]} color="#94a3b8" lineWidth={1.5} opacity={0.6} transparent />
      <Line points={[sqsPos, worker1Pos]} color="#94a3b8" lineWidth={1.5} opacity={0.6} transparent />
      <Line points={[sqsPos, worker2Pos]} color="#94a3b8" lineWidth={1.5} opacity={0.6} transparent />
      <Line points={[sqsPos, worker3Pos]} color="#94a3b8" lineWidth={1.5} opacity={0.6} transparent />
      <Line points={[worker1Pos, ddbPos]} color="#94a3b8" lineWidth={1.5} opacity={0.6} transparent />
      <Line points={[worker2Pos, ddbPos]} color="#94a3b8" lineWidth={1.5} opacity={0.6} transparent />
      <Line points={[worker3Pos, ddbPos]} color="#94a3b8" lineWidth={1.5} opacity={0.6} transparent />
    </group>
  );
};

export const Hero3D: React.FC = () => {
  return (
    <div className="relative w-full h-72 sm:h-80 bg-gradient-to-b from-sky-50/60 via-slate-50 to-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mb-8">
      <div className="absolute top-4 left-6 z-10">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200">
          3D System Topology
        </span>
        <h2 className="text-xl font-semibold text-slate-900 mt-1">AWS Event-Driven Topology</h2>
        <p className="text-xs text-slate-500 max-w-md mt-0.5">
          Asynchronous message fan-out from SQS queue to concurrent Lambda workers writing to DynamoDB.
        </p>
      </div>

      <Canvas camera={{ position: [0, 0, 8.5], fov: 45 }}>
        <ambientLight intensity={0.9} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <NetworkTopologyScene />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 3} />
      </Canvas>
    </div>
  );
};
