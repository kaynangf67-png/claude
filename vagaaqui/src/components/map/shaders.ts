import * as THREE from 'three';

/** Fachadas com janelas procedurais (sem texturas → leve em celulares). */
export function createBuildingMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 } },
    ]),
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vSeed;
      varying float vLocalY;
      varying float vHeight;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vLocalY = position.y;
        vHeight = length(instanceMatrix[1].xyz);
        vSeed = aSeed;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vSeed;
      varying float vLocalY;
      varying float vHeight;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vNormal);
        float roof = step(0.5, n.y);
        vec3 lightDir = normalize(vec3(-0.4, 0.8, 0.35));
        float diff = 0.55 + 0.45 * max(dot(n, lightDir), 0.0);
        float hFrac = clamp(vWorld.y / max(vHeight, 1.0), 0.0, 1.0);
        vec3 base = mix(vec3(0.045, 0.06, 0.11), vec3(0.09, 0.12, 0.2), hFrac) * diff;

        float hcoord = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
        vec2 cell = vec2(hcoord / 2.2, vWorld.y / 3.2);
        vec2 f = fract(cell);
        float win = step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.74);
        float r = hash(floor(cell) + vSeed * 13.7);
        float lit = step(0.66, r);
        vec3 warm = vec3(1.0, 0.78, 0.48);
        vec3 cool = vec3(0.55, 0.8, 1.0);
        vec3 winColor = mix(warm, cool, step(0.82, hash(floor(cell) * 1.7 + vSeed))) * (0.55 + 0.45 * r);
        float aboveGround = step(4.2, vWorld.y);
        vec3 color = base + win * aboveGround * (lit * winColor * 0.55 + (1.0 - lit) * vec3(0.035, 0.055, 0.1));
        // térreo iluminado
        color += (1.0 - aboveGround) * (1.0 - roof) * vec3(0.12, 0.2, 0.3) * 0.6;
        // aresta superior luminosa (identidade VagaAqui)
        float rim = smoothstep(0.965, 1.0, vLocalY) * (1.0 - roof);
        color += rim * vec3(0.2, 0.55, 1.0) * 0.9;
        color = mix(color, vec3(0.07, 0.09, 0.15) * diff, roof);
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

/** Asfalto com faixas: u (0..1) ao longo de 90 m, v (0..1) através de 14 m. */
export function createRoadMaterial(length: number, width: number) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uLength: { value: length }, uWidth: { value: width } },
    ]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLength;
      uniform float uWidth;
      varying vec2 vUv;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        float along = vUv.x * uLength;
        float across = (vUv.y - 0.5) * uWidth;
        vec3 asphalt = vec3(0.035, 0.045, 0.07) + hash(floor(vWorld.xz * 2.0)) * 0.012;
        // linha central tracejada
        float dash = step(0.45, fract(along / 7.0));
        float center = (1.0 - smoothstep(0.08, 0.16, abs(across))) * dash;
        // divisória da faixa de estacionamento
        float parkLine = 1.0 - smoothstep(0.05, 0.12, abs(abs(across) - 4.4));
        float parkDash = step(0.5, fract(along / 6.0));
        // meio-fio luminoso
        float edge = 1.0 - smoothstep(0.0, 0.35, uWidth * 0.5 - abs(across));
        vec3 color = asphalt;
        color += center * vec3(0.95, 0.78, 0.35) * 0.55;
        color += parkLine * parkDash * vec3(0.5, 0.6, 0.75) * 0.25;
        color += edge * vec3(0.25, 0.55, 1.0) * 0.45;
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

export function createIntersectionMaterial(size: number) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSize: { value: size } }]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSize;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = (vUv - 0.5) * uSize;
        vec3 color = vec3(0.04, 0.05, 0.08);
        float band = uSize * 0.5 - 2.6;
        float inX = step(band, abs(p.x)) * step(abs(p.y), band);
        float inY = step(band, abs(p.y)) * step(abs(p.x), band);
        float stripesX = step(0.5, fract(p.y / 1.2));
        float stripesY = step(0.5, fract(p.x / 1.2));
        float zebra = inX * stripesX + inY * stripesY;
        color += zebra * vec3(0.55, 0.6, 0.7) * 0.35;
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

/** Chão infinito com grade técnica que desaparece na distância. */
export function createGroundMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        vec2 g = abs(fract(vWorld.xz / 52.0 - 0.5) - 0.5) / fwidth(vWorld.xz / 52.0);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        vec3 color = vec3(0.018, 0.024, 0.04) + line * vec3(0.06, 0.12, 0.22) * 0.5;
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

/** Mar com brilho animado. */
export function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        float w = sin(vWorld.x * 0.05 + uTime * 0.8) * sin(vWorld.z * 0.07 - uTime * 0.6);
        float sparkle = smoothstep(0.85, 1.0, w);
        vec3 color = vec3(0.01, 0.04, 0.08) + sparkle * vec3(0.1, 0.35, 0.55) * 0.5;
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

/** Rota no chão: faixa luminosa com setas de fluxo animadas. */
export function createRouteMaterial(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uProgress: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aDist;
      varying vec2 vUv;
      varying float vDist;
      void main() {
        vUv = uv;
        vDist = aDist;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uProgress;
      varying vec2 vUv;
      varying float vDist;
      void main() {
        if (vDist < uProgress) discard;
        float across = abs(vUv.y - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.35, 0.55, across);
        float glow = (1.0 - smoothstep(0.4, 1.0, across)) * 0.45;
        // chevrons em movimento
        float t = fract((vDist - uTime * 14.0) / 9.0);
        float chevron = step(abs(t - 0.5 + (across * 0.18)), 0.07) * step(across, 0.55);
        vec3 color = uColor * (core * 0.9 + glow) + chevron * vec3(1.0);
        float alpha = clamp(core * 0.85 + glow + chevron, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}
