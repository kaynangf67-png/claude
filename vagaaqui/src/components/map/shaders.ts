import * as THREE from 'three';

/** Fachadas com janelas procedurais (sem texturas → leve em celulares). */
export function createBuildingMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aHeight;
      attribute float aLocalY;
      attribute float aWallU;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vSeed;
      varying float vLocalY;
      varying float vHeight;
      varying float vWallU;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vLocalY = aLocalY;
        vHeight = aHeight;
        vSeed = aSeed;
        vWallU = aWallU;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vSeed;
      varying float vLocalY;
      varying float vHeight;
      varying float vWallU;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vNormal);
        float roof = step(0.5, n.y);
        vec3 lightDir = normalize(vec3(-0.4, 0.8, 0.35));
        float diff = 0.55 + 0.45 * max(dot(n, lightDir), 0.0);
        float hFrac = clamp(vLocalY, 0.0, 1.0);
        vec3 base = mix(vec3(0.045, 0.06, 0.11), vec3(0.09, 0.12, 0.2), hFrac) * diff;
        float floorY = vLocalY * vHeight;
        vec2 cell = vec2(vWallU / 2.4, floorY / 3.2);
        vec2 f = fract(cell);
        float win = step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.74);
        float r = hash(floor(cell) + vSeed * 13.7);
        float lit = step(0.66, r);
        vec3 warm = vec3(1.0, 0.78, 0.48);
        vec3 cool = vec3(0.55, 0.8, 1.0);
        vec3 winColor = mix(warm, cool, step(0.82, hash(floor(cell) * 1.7 + vSeed))) * (0.55 + 0.45 * r);
        float aboveGround = step(3.6, floorY) * step(floorY, vHeight - 1.0);
        vec3 color = base + win * aboveGround * (lit * winColor * 0.55 + (1.0 - lit) * vec3(0.035, 0.055, 0.1));
        // térreo iluminado
        color += (1.0 - step(3.6, floorY)) * (1.0 - roof) * vec3(0.12, 0.2, 0.3) * 0.5;
        // aresta superior luminosa (identidade VagaAqui), só em prédios altos
        float rim = smoothstep(vHeight - 0.8, vHeight, floorY) * (1.0 - roof) * step(14.0, vHeight);
        color += rim * vec3(0.2, 0.55, 1.0) * 0.9;
        color = mix(color, vec3(0.07, 0.09, 0.15) * diff, roof);
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

/**
 * Asfalto com sinalização horizontal no padrão brasileiro (CTB/Contran):
 * amarelo separa sentidos opostos, branco separa faixas do mesmo sentido,
 * vagas demarcadas junto ao meio-fio e faixas de pedestres nos cruzamentos.
 * aRoad = (ao longo, através, meia largura) · aExtra = (faixa A, faixa B, mão única)
 * aLane = (faixas, estacionamento esquerdo, estacionamento direito) — tudo em metros.
 */
export function createRoadMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      attribute vec3 aRoad;
      attribute vec3 aExtra;
      attribute vec3 aLane;
      attribute vec2 aSlots;
      varying vec2 vSlots;
      varying vec3 vRoad;
      varying vec3 vExtra;
      varying vec3 vLane;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vRoad = aRoad;
        vExtra = aExtra;
        vLane = aLane;
        vSlots = aSlots;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vRoad;
      varying vec3 vExtra;
      varying vec3 vLane;
      varying vec2 vSlots;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      // linha de largura w (m) centrada em c, com antisserrilhado
      float stripe(float x, float c, float w, float aa) {
        return 1.0 - smoothstep(w * 0.5, w * 0.5 + aa, abs(x - c));
      }
      void main() {
        float along = vRoad.x;
        float across = vRoad.y;
        float hw = vRoad.z;
        float oneway = vExtra.z;
        float lanes = vLane.x;
        float L = -hw + vLane.y;
        float R = hw - vLane.z;
        float aa = max(fwidth(across), 0.02) * 1.2;
        float aaAlong = max(fwidth(along), 0.02) * 1.2;

        // asfalto: base + granulação + manchas + desgaste nas trilhas dos pneus
        float grain = hash(floor(vWorld.xz * 6.0));
        float patches = noise(vWorld.xz * 0.08);
        vec3 asphalt = vec3(0.155, 0.16, 0.172) * (0.88 + 0.1 * grain + 0.14 * patches);
        vec3 color = asphalt;
        float wear = 0.82 + 0.18 * noise(vWorld.xz * 0.9);
        vec3 white = vec3(0.86, 0.87, 0.85) * wear;
        vec3 yellow = vec3(0.86, 0.66, 0.16) * wear;

        float zebraA = vExtra.x >= 0.0 ? step(vExtra.x, along) * step(along, vExtra.x + 3.0) : 0.0;
        float zebraB = vExtra.y >= 0.0 ? step(vExtra.y - 3.0, along) * step(along, vExtra.y) : 0.0;
        float zebra = max(zebraA, zebraB);
        float markOn = 1.0 - zebra;
        float mid = (L + R) * 0.5;

        float whiteMask = 0.0;
        float yellowMask = 0.0;
        if (oneway < 0.5) {
          // eixo: amarelo duplo contínuo em vias largas, simples tracejado nas estreitas
          if (lanes >= 2.0) {
            yellowMask += stripe(across, mid - 0.12, 0.1, aa) + stripe(across, mid + 0.12, 0.1, aa);
          } else {
            yellowMask += stripe(across, mid, 0.12, aa) * step(fract(along / 8.0), 0.5);
          }
          // divisórias brancas tracejadas dentro de cada sentido
          for (int k = 1; k < 4; k++) {
            if (float(k) >= lanes) break;
            float t = float(k) / lanes;
            float dash = step(fract(along / 9.0), 0.33);
            whiteMask += (stripe(across, mid + (R - mid) * t, 0.1, aa) + stripe(across, mid - (mid - L) * t, 0.1, aa)) * dash;
          }
        } else {
          for (int k = 1; k < 5; k++) {
            if (float(k) >= lanes) break;
            float dash = step(fract(along / 9.0), 0.33);
            whiteMask += stripe(across, L + (R - L) * float(k) / lanes, 0.1, aa) * dash;
          }
          // setas de sentido no centro de cada faixa, a cada 40 m
          float cyc = mod(along, 40.0);
          float laneW = (R - L) / lanes;
          float inLane = mod(across - L, laneW) - laneW * 0.5;
          float shaft = step(abs(inLane), 0.12) * step(18.0, cyc) * step(cyc, 20.6);
          float headT = (cyc - 20.6) / 1.6;
          float head = step(0.0, headT) * step(headT, 1.0) * step(abs(inLane), 0.55 * (1.0 - headT));
          whiteMask += (shaft + head) * step(L + 0.3, across) * step(across, R - 0.3);
        }
        // bordas: linha contínua onde não há estacionamento
        if (vLane.y < 0.1) whiteMask += stripe(across, L + 0.3, 0.12, aa);
        if (vLane.z < 0.1) whiteMask += stripe(across, R - 0.3, 0.12, aa);
        // vagas demarcadas: limite da faixa de estacionamento + traços a cada 6 m
        float inParking = step(across, L) * step(0.1, vLane.y) + step(R, across) * step(0.1, vLane.z);
        // traços nos limites de cada vaga (mesmas posições das vagas da simulação)
        float dBay = abs(mod(along - vSlots.x + 3.0, 6.0) - 3.0);
        float inSlots = step(vSlots.x - 0.1, along) * step(along, vSlots.y + 0.1);
        float bayTick = (1.0 - smoothstep(0.05, 0.05 + aaAlong, dBay)) * inSlots;
        whiteMask += inParking * bayTick * 0.9;
        if (vLane.y > 0.1) whiteMask += stripe(across, L, 0.1, aa) * 0.8;
        if (vLane.z > 0.1) whiteMask += stripe(across, R, 0.1, aa) * 0.8;

        color = mix(color, yellow, clamp(yellowMask, 0.0, 1.0) * markOn);
        color = mix(color, white, clamp(whiteMask, 0.0, 1.0) * markOn);
        // faixa de pedestres
        float bars = step(0.5, fract(across / 1.0)) * step(abs(across), hw - 0.4);
        color = mix(color, white, zebra * bars);
        // meio-fio: leve escurecimento junto à calçada
        color *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.3, hw - abs(across)));
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

/** Calçada de concreto com juntas de dilatação. */
export function createSidewalkMaterial() {
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
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 cell = vWorld.xz / 1.5;
        vec2 g = abs(fract(cell) - 0.5);
        float joint = 1.0 - smoothstep(0.46, 0.5, max(g.x, g.y));
        float tone = hash(floor(cell));
        vec3 color = vec3(0.33, 0.335, 0.34) * (0.92 + 0.12 * tone) * (0.86 + 0.14 * joint);
        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

/** Chão (terreno entre as ruas): tom neutro com variação sutil, sem grade. */
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
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float n = noise(vWorld.xz * 0.03) * 0.6 + noise(vWorld.xz * 0.2) * 0.4;
        vec3 color = mix(vec3(0.085, 0.095, 0.09), vec3(0.11, 0.12, 0.105), n);
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
        vec3 color = vec3(0.04, 0.09, 0.14) + sparkle * vec3(0.1, 0.25, 0.35) * 0.35;
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
