import * as THREE from 'three';

export class FinanceScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private mouse: THREE.Vector2;
  private targetMouse: THREE.Vector2;
  private geometricMesh: THREE.Mesh | null = null;
  private geometricMesh2: THREE.Mesh | null = null;
  private particles: THREE.Points | null = null;
  private animationId: number = 0;
  private clock: THREE.Clock;
  private isDisposed: boolean = false;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.mouse = new THREE.Vector2(0, 0);
    this.targetMouse = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 50;

    // Renderer setup with transparency
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.setupScene();
    this.setupEventListeners(container);
  }

  private setupScene(): void {
    this.createGeometricMesh();
    this.createParticles();
  }

  private createGeometricMesh(): void {
    // Icosahedron wireframe - clean geometric aesthetic
    const geometry = new THREE.IcosahedronGeometry(15, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    this.geometricMesh = new THREE.Mesh(geometry, material);
    this.geometricMesh.position.set(25, 5, -30);
    this.scene.add(this.geometricMesh);

    // Second mesh for depth
    const geometry2 = new THREE.OctahedronGeometry(10, 0);
    const material2 = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    this.geometricMesh2 = new THREE.Mesh(geometry2, material2);
    this.geometricMesh2.position.set(-30, -10, -40);
    this.scene.add(this.geometricMesh2);
  }

  private createParticles(): void {
    // Reduced particle count for minimal aesthetic
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorCyan = new THREE.Color(0x0ea5e9);
    const colorBlue = new THREE.Color(0x3b82f6);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 120;
      positions[i3 + 1] = (Math.random() - 0.5) * 80;
      positions[i3 + 2] = (Math.random() - 0.5) * 60 - 30;

      const color = Math.random() > 0.5 ? colorCyan : colorBlue;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  private setupEventListeners(container: HTMLElement): void {
    let lastMove = 0;
    const throttleMs = 16;

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now();
      if (now - lastMove < throttleMs) return;
      lastMove = now;

      const rect = container.getBoundingClientRect();
      this.targetMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.targetMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleResize = () => this.handleResize(container);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize);

    // Store references for cleanup
    (this as any)._handleMouseMove = handleMouseMove;
    (this as any)._handleResize = handleResize;
  }

  private handleResize(container: HTMLElement): void {
    if (this.isDisposed) return;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  public animate(): void {
    if (this.isDisposed) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const elapsed = this.clock.getElapsedTime();

    // Smooth mouse interpolation
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.03;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.03;

    // Animate geometric meshes - very slow, subtle rotation
    if (this.geometricMesh) {
      this.geometricMesh.rotation.x = elapsed * 0.05 + this.mouse.y * 0.2;
      this.geometricMesh.rotation.y = elapsed * 0.08 + this.mouse.x * 0.2;
    }

    if (this.geometricMesh2) {
      this.geometricMesh2.rotation.x = elapsed * 0.03 - this.mouse.y * 0.15;
      this.geometricMesh2.rotation.y = elapsed * 0.05 - this.mouse.x * 0.15;
    }

    // Animate particles with subtle drift
    if (this.particles) {
      this.particles.rotation.y = elapsed * 0.01;
      this.particles.rotation.x = Math.sin(elapsed * 0.05) * 0.05;
    }

    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.animationId);

    // Remove event listeners
    if ((this as any)._handleMouseMove) {
      window.removeEventListener('mousemove', (this as any)._handleMouseMove);
    }
    if ((this as any)._handleResize) {
      window.removeEventListener('resize', (this as any)._handleResize);
    }

    // Dispose Three.js resources
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });

    this.renderer.dispose();

    // Remove canvas from DOM
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
