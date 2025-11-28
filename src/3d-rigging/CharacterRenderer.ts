import * as THREE from 'three';

/**
 * 렌더러 설정 옵션
 */
export interface RendererOptions {
  width?: number;
  height?: number;
  backgroundColor?: number;
  pixelRatio?: number;
  antialias?: boolean;
  alpha?: boolean;
}

/**
 * 3D 캐릭터를 정면 2D 뷰로 렌더링하는 Three.js 기반 렌더러
 *
 * OrthographicCamera를 사용하여 철권(Tekken) 스타일의 정면 뷰를 구현합니다.
 */
export class CharacterRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  private container: HTMLElement;

  // 성능 측정용
  private frameCount: number = 0;
  private fps: number = 0;
  private lastFpsTime: number = 0;

  constructor(container: HTMLElement, options: RendererOptions = {}) {
    const {
      width = 800,
      height = 600,
      backgroundColor = 0x1a1a1a,
      pixelRatio = window.devicePixelRatio,
      antialias = true,
      alpha = false
    } = options;

    this.container = container;

    // Scene 생성
    this.scene = new THREE.Scene();
    // 배경을 밝은 색으로 설정하여 플레이스홀더가 보이도록 함
    const bgColor = backgroundColor === 0x1a1a1a ? 0x0a1929 : backgroundColor;
    this.scene.background = new THREE.Color(bgColor);
    console.log(`[CharacterRenderer] Constructor started, container:`, container);
    console.log(`[CharacterRenderer] Container dimensions: ${container.clientWidth}x${container.clientHeight}`);
    console.log(`[CharacterRenderer] Scene background color: 0x${bgColor.toString(16)}`);

    // OrthographicCamera 설정 (정면 2D 뷰 -> 쿼터뷰로 변경)
    // Frustum을 크게 설정하여 캐릭터가 확실히 보이도록 함
    const aspect = width / height;
    const frustumSize = 800; // 좀 더 넓게 봄
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,   // left
      frustumSize * aspect / 2,    // right
      frustumSize / 2,              // top
      -frustumSize / 2,             // bottom
      0.1,                          // near
      2000                          // far
    );

    // Default to Isometric View so floor is visible
    this.camera.position.set(300, 300, 300);
    this.camera.lookAt(0, 100, 0);

    console.log(`[CharacterRenderer] Camera frustum: ${-frustumSize * aspect / 2} ~ ${frustumSize * aspect / 2} (X), ${-frustumSize / 2} ~ ${frustumSize / 2} (Y)`);

    // Renderer 설정
    this.renderer = new THREE.WebGLRenderer({ antialias, alpha });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(this.renderer.domElement);

    // 조명 설정
    this.setupLighting();

    // 윈도우 리사이즈 이벤트 리스너
    this.handleWindowResize = this.handleWindowResize.bind(this);
  }

  /**
   * 조명 설정
   * 정면, 배경, 환경광을 조합하여 균형잡힌 조명 구현
   */
  private setupLighting(): void {
    // 전면 조명 (주광)
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2); // 밝기 증가
    frontLight.position.set(100, 200, 100); // 위에서 비추도록 변경
    frontLight.castShadow = true;
    frontLight.shadow.mapSize.width = 2048;
    frontLight.shadow.mapSize.height = 2048;
    frontLight.shadow.camera.left = -500;
    frontLight.shadow.camera.right = 500;
    frontLight.shadow.camera.top = 500;
    frontLight.shadow.camera.bottom = -500;
    this.scene.add(frontLight);

    // 배경 조명 (그림자 방지, 역광 효과)
    const backLight = new THREE.DirectionalLight(0x8888ff, 0.5);
    backLight.position.set(-100, 50, -100);
    this.scene.add(backLight);

    // 환경광 (전반적인 밝기)
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
  }

  /**
   * 캐릭터 메시를 씬에 추가
   * @param mesh SkinnedMesh 객체
   */
  addCharacterMesh(mesh: THREE.SkinnedMesh): void {
    // 메시 크기 확인 (디버그용)
    const bbox = new THREE.Box3().setFromObject(mesh);
    const size = bbox.getSize(new THREE.Vector3());
    console.log(`[CharacterRenderer] Mesh size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
    console.log(`[CharacterRenderer] Mesh bounds: ${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}, ${bbox.min.z.toFixed(2)} ~ ${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)}, ${bbox.max.z.toFixed(2)}`);

    // STEP 1: 원래 중심 Y 계산 (스케일 하기 전)
    const originalCenterY = (bbox.min.y + bbox.max.y) / 2;
    console.log(`[CharacterRenderer] Original center Y: ${originalCenterY.toFixed(2)}`);

    // STEP 2: 메시를 보이는 크기로 스케일 조정 (FBX가 너무 작을 수 있음)
    const targetHeight = 350; // 350 단위 높이로 설정 (화면의 약 60%)
    const scale = targetHeight / size.y;
    mesh.scale.multiplyScalar(scale);
    console.log(`[CharacterRenderer] Applied scale: ${scale.toFixed(2)}x`);

    // STEP 3: 메시 지오메트리의 중심을 mesh.position의 원점으로 이동
    mesh.geometry.translate(0, -originalCenterY, 0);
    console.log(`[CharacterRenderer] Translated geometry by Y offset: ${-originalCenterY.toFixed(2)}`);

    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.scene.add(mesh);

    // --- DEBUG: Add reference cubes to verify scene scale and visibility ---
    // Red Cube at (0,0,0) - Center
    const debugGeo = new THREE.BoxGeometry(50, 50, 50);
    const debugMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const debugCube = new THREE.Mesh(debugGeo, debugMat);
    debugCube.position.set(0, 0, 0);
    this.scene.add(debugCube);
    console.log('[CharacterRenderer] Added DEBUG RED CUBE at (0,0,0) size 50');

    // Green Cube at (0, 100, 0) - Height reference
    const debugGeo2 = new THREE.BoxGeometry(20, 20, 20);
    const debugMat2 = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const debugCube2 = new THREE.Mesh(debugGeo2, debugMat2);
    debugCube2.position.set(0, 100, 0);
    this.scene.add(debugCube2);
    console.log('[CharacterRenderer] Added DEBUG GREEN CUBE at (0,100,0) size 20');

    // --- High-Contrast Floor for Visibility ---
    // 1. Clear Background
    this.scene.background = new THREE.Color(0x333333); // Dark Grey

    // 2. Dense, High-Contrast Grid
    // Size 1000, 50 divisions = 20 unit squares
    const gridHelper = new THREE.GridHelper(1000, 50, 0xff0000, 0x888888);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

    // 3. Target Circle under character (to show position clearly)
    const circleGeo = new THREE.CircleGeometry(30, 32);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.5; // Slightly above grid
    this.scene.add(circle);

    const axesHelper = new THREE.AxesHelper(200);
    this.scene.add(axesHelper);

    console.log('[CharacterRenderer] Added High-Contrast Grid and Target Circle');
    // ---------------------------------------------------------------------
    // ---------------------------------------------------------------------

    // 뼈 위치 확인 (디버그용)
    if (mesh.skeleton && mesh.skeleton.bones) {
      console.log(`[CharacterRenderer] Loaded ${mesh.skeleton.bones.length} bones`);
      const boneNames = mesh.skeleton.bones.slice(0, 5).map(b => b.name);
      console.log(`[CharacterRenderer] Sample bones: ${boneNames.join(', ')}`);
    }
  }

  /**
   * 애니메이션 업데이트 루프 시작
   * @param mixer AnimationMixer 객체
   * @param onFrame 각 프레임마다 실행할 콜백 함수
   */
  /**
   * 애니메이션 업데이트 루프 시작
   * @param mixers AnimationMixer 객체 또는 객체 배열
   * @param onFrame 각 프레임마다 실행할 콜백 함수
   */
  startAnimationLoop(
    mixers: THREE.AnimationMixer | THREE.AnimationMixer[],
    onFrame?: (deltaTime: number, fps: number) => void
  ): void {
    // 시작 전 진단
    console.log(`[CharacterRenderer] startAnimationLoop called`);
    console.log(`[CharacterRenderer] Scene children count: ${this.scene.children.length}`);

    const mixerArray = Array.isArray(mixers) ? mixers : [mixers];
    console.log(`[CharacterRenderer] Managing ${mixerArray.length} mixers`);

    let renderCount = 0;
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      const deltaTime = this.clock.getDelta();

      // 모든 믹서 업데이트
      mixerArray.forEach(mixer => mixer.update(deltaTime));

      // FPS 계산
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsTime = now;
      }

      // 프레임 콜백 실행
      if (onFrame) {
        onFrame(deltaTime, this.fps);
      }

      // 렌더링 진행
      renderCount++;
      if (renderCount === 1 || renderCount % 300 === 0) {
        console.log(`[CharacterRenderer] Rendering frame ${renderCount}, objects in scene: ${this.scene.children.length}`);
      }
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  /**
   * 현재 FPS 값 조회
   * @returns 초당 프레임 수
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * 렌더링 멈추기
   */
  stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 장면에 객체 추가 (커스텀 디버그 객체 등)
   * @param object THREE.Object3D
   */
  addToScene(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  /**
   * 정리 및 메모리 해제
   */
  dispose(): void {
    this.stopAnimationLoop();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /**
   * 뷰포트 크기 조정
   * @param width 새로운 너비
   * @param height 새로운 높이
   */
  handleWindowResize(width?: number, height?: number): void {
    const w = width || this.container.clientWidth;
    const h = height || this.container.clientHeight;

    const aspect = w / h;

    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
  }

  /**
   * 스크린샷 캡처
   * @param fileName 저장할 파일명
   */
  captureScreenshot(fileName: string = 'screenshot.png'): void {
    const link = document.createElement('a');
    link.href = this.renderer.domElement.toDataURL('image/png');
    link.download = fileName;
    link.click();
  }

  /**
   * 현재 씬 객체 조회
   * @returns Three.js Scene 객체
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * WebGL 렌더러 HTML 엘리먼트 조회
   * @returns Canvas 엘리먼트
   */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * 씬의 배경색 변경
   * @param color 색상 (16진수)
   */
  setBackgroundColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  /**
   * 카메라 줌 조정
   * @param zoomFactor 줌 배수 (> 1 = 확대, < 1 = 축소)
   */
  setZoom(zoomFactor: number): void {
    this.camera.zoom = zoomFactor;
    this.camera.updateProjectionMatrix();
  }

  /**
   * 디버그 정보 조회
   * @returns 렌더러 정보 객체
   */
  getDebugInfo(): {
    fps: number;
    meshCount: number;
    lightCount: number;
    cameraType: string;
  } {
    return {
      fps: this.fps,
      meshCount: this.scene.children.filter(
        child => child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh
      ).length,
      lightCount: this.scene.children.filter(child => child instanceof THREE.Light).length,
      cameraType: this.camera.type
    };
  }
}
