import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// Final grading pass: vignette, gentle teal/orange split toning, film grain,
// plus a desaturated "instinct" look toggled at runtime.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.32 },
    instinct: { value: 0 },
    damage: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignette;
    uniform float instinct;
    uniform float damage;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      // split toning: cool shadows, warm highlights
      vec3 shadows = vec3(0.92, 0.98, 1.06);
      vec3 highs = vec3(1.05, 1.0, 0.93);
      c.rgb *= mix(shadows, highs, smoothstep(0.1, 0.8, l));
      // slight contrast
      c.rgb = mix(vec3(l), c.rgb, 1.06);
      c.rgb = (c.rgb - 0.5) * 1.04 + 0.5;
      // instinct: desaturate and darken, tint blue-grey
      vec3 inst = vec3(l) * vec3(0.55, 0.62, 0.72);
      c.rgb = mix(c.rgb, inst, instinct * 0.85);
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * (vignette + instinct * 0.9) * 2.2;
      c.rgb *= clamp(v, 0.0, 1.0);
      // damage: red edges
      float edge = smoothstep(0.2, 0.75, length(d) * 1.4);
      c.rgb = mix(c.rgb, vec3(0.55, 0.02, 0.02), edge * damage * 0.8);
      c.rgb += (rand(vUv * 731.0 + time) - 0.5) * 0.025;
      gl_FragColor = c;
    }
  `,
};

export class Renderer {
  constructor(container, quality = 'high') {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    const pr = quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : quality === 'medium' ? 1 : 0.8;
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.78;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.domElement = this.renderer.domElement;
    this.quality = quality;
    this.composer = null;
    window.addEventListener('resize', () => this.resize());
  }

  setup(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(scene, camera));

    if (this.quality === 'high') {
      this.gtao = new GTAOPass(scene, camera, w, h);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.blendIntensity = 0.85;
      this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0 });
      composer.addPass(this.gtao);
    }

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.22, 0.5, 0.95);
    if (this.quality !== 'low') composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    if (this.quality !== 'low') {
      this.smaa = new SMAAPass(w, h);
      composer.addPass(this.smaa);
    }
    this.composer = composer;
    this.resize();
  }

  // Drop the most expensive effects at runtime (used by auto-quality).
  degrade() {
    if (this.gtao) this.gtao.enabled = false;
    this.renderer.setPixelRatio(1);
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.composer) this.composer.setSize(w, h);
  }

  render(time, instinct = 0, damage = 0) {
    if (this.grade) {
      this.grade.uniforms.time.value = time % 100;
      this.grade.uniforms.instinct.value = instinct;
      this.grade.uniforms.damage.value = damage;
    }
    this.composer.render();
  }
}
