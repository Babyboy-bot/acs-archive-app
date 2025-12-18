import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise4D } from 'simplex-noise';
import { EffectComposer, Bloom } from '@react-three/postprocessing'; // Importation des effets

const noise4D = createNoise4D();

function BlobMesh() {
  const mesh = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const original = useRef<Float32Array | null>(null);

  useEffect(() => {
    const geom = mesh.current.geometry as THREE.SphereGeometry;
    original.current = geom.attributes.position.array.slice() as Float32Array;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.8;

    // Vérification pour s'assurer que original.current est bien défini
    if (!original.current) return;

    const geom = mesh.current.geometry as THREE.SphereGeometry;
    const pos = geom.attributes.position;
    const orig = original.current;

    for (let i = 0; i < pos.count; i++) {
      const ox = orig[i * 3];
      const oy = orig[i * 3 + 1];
      const oz = orig[i * 3 + 2];

      // Siri-like noise deformation
      const n = noise4D(ox * 1.4, oy * 1.4, oz * 1.4, t);
      const offset = n * 0.25;

      pos.setXYZ(i, ox + ox * offset, oy + oy * offset, oz + oz * offset);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();

    // Animate the color based on time for the gradient effect
    if (materialRef.current) {
      const time = clock.getElapsedTime();
      materialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 90, 90]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
        }}
      />
    </mesh>
  );
}

export default function Blob3D() {
  return (
    <Canvas camera={{ position: [0, 0, 3.5], fov: 55 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 2, 3]} intensity={1.3} />

      {/* Postprocessing effect */}
      <EffectComposer>
        <Bloom
          intensity={1.5} // Luminosité de l'effet
          radius={0.4}   // Taille de la lueur
          threshold={0.5} // Seuil de luminosité avant l'application du bloom
        />
      </EffectComposer>

      <BlobMesh />
    </Canvas>
  );
}

// Vertex Shader
const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normal;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment Shader (Dégradé dynamique)
const fragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;

  vec3 gradientColor(float p) {
    // Dégradé cyan -> purple
    vec3 cyan = vec3(0.0, 1.0, 1.0);  // cyan-500
    vec3 purple = vec3(0.5, 0.0, 0.5);  // purple-500
    return mix(cyan, purple, p);
  }

  void main() {
    float timeFactor = (sin(uTime) + 1.0) * 0.5; // Normalized between 0.0 and 1.0
    vec3 color = gradientColor(timeFactor);

    // Basic lighting effect
    float light = dot(normalize(vNormal), vec3(0.0, 1.0, 0.0));
    gl_FragColor = vec4(color * light, 1.0);
  }
`;
