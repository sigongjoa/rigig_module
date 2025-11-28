import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

/**
 * FBX 파일에서 로드된 캐릭터 자산
 */
export interface CharacterAsset {
  /** SkinnedMesh 객체 */
  mesh: THREE.SkinnedMesh;
  /** 뼈대 정보 */
  skeleton: THREE.Skeleton;
  /** 애니메이션 클립 배열 */
  animations: THREE.AnimationClip[];
  /** 애니메이션 믹서 */
  mixer: THREE.AnimationMixer;
  /** 원본 FBX 객체 (디버그용) */
  rawFbx?: THREE.Group;
}

/**
 * FBX 파일 로더 및 Three.js SkinnedMesh 변환
 *
 * Mixamo 캐릭터를 로드하고 애니메이션을 관리합니다.
 */
export class CharacterLoader {
  private fbxLoader: FBXLoader;
  private loadingManager: THREE.LoadingManager;

  constructor(onProgress?: (progress: ProgressEvent) => void) {
    this.loadingManager = new THREE.LoadingManager();
    this.fbxLoader = new FBXLoader(this.loadingManager);

    if (onProgress) {
      this.loadingManager.onProgress = onProgress;
    }
  }

  /**
   * FBX 파일 로드 및 SkinnedMesh 생성
   * @param fbxUrl FBX 파일의 URL
   * @returns CharacterAsset 객체
   * @throws Error FBX 로드 실패 또는 SkinnedMesh 없음
   */
  async loadCharacter(fbxUrl: string): Promise<CharacterAsset> {
    try {
      // 1. FBX 파일 로드
      const fbx = await this.fbxLoader.loadAsync(fbxUrl);

      // 2. SkinnedMesh 찾기 (FBX는 일반적으로 SkinnedMesh 포함)
      let mesh: THREE.SkinnedMesh | null = null;
      fbx.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.SkinnedMesh) {
          mesh = child;
        }
      });

      if (!mesh) {
        throw new Error('No SkinnedMesh found in FBX');
      }

      // 3. AnimationMixer 생성
      const mixer = new THREE.AnimationMixer(mesh);

      // 4. 뼈대 정보 추출
      const skeleton = mesh.skeleton;
      const animations = fbx.animations || [];

      return {
        mesh,
        skeleton,
        animations,
        mixer,
        rawFbx: fbx
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load character from ${fbxUrl}: ${errorMessage}`);
    }
  }

  /**
   * 캐릭터에 애니메이션 추가
   * @param character 기존 캐릭터 자산
   * @param animationUrl 애니메이션 FBX 파일 URL
   * @param animationName 애니메이션 이름 (애니메이션 클립에 부여할 이름)
   */
  async addAnimation(
    character: CharacterAsset,
    animationUrl: string,
    animationName: string
  ): Promise<void> {
    try {
      const animFbx = await this.fbxLoader.loadAsync(animationUrl);
      const animClips = animFbx.animations || [];

      // 애니메이션 클립을 기존 메시에 적용
      animClips.forEach((clip) => {
        // 애니메이션 이름 설정
        clip.name = animationName;
        character.animations.push(clip);
      });

      if (animClips.length === 0) {
        console.warn(`No animations found in ${animationUrl}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to add animation: ${errorMessage}`);
      throw new Error(`Failed to add animation from ${animationUrl}: ${errorMessage}`);
    }
  }

  /**
   * 애니메이션 재생
   * @param character 캐릭터 자산
   * @param animationName 재생할 애니메이션 이름
   * @param loop 루프 설정 (기본값: THREE.LoopRepeat)
   * @returns AnimationAction (재생 제어 가능)
   * @throws Error 애니메이션을 찾을 수 없음
   */
  playAnimation(
    character: CharacterAsset,
    animationName: string,
    loop: THREE.AnimationLoopMode = THREE.LoopRepeat
  ): THREE.AnimationAction {
    const clip = THREE.AnimationClip.findByName(
      character.animations,
      animationName
    );

    if (!clip) {
      const availableAnimations = character.animations.map(a => a.name).join(', ');
      throw new Error(
        `Animation "${animationName}" not found. Available: [${availableAnimations}]`
      );
    }

    const action = character.mixer.clipAction(clip);
    action.loop = loop;
    action.play();

    return action;
  }

  /**
   * 애니메이션 목록 조회
   * @param character 캐릭터 자산
   * @returns 애니메이션 이름 배열
   */
  getAnimationNames(character: CharacterAsset): string[] {
    return character.animations.map(clip => clip.name);
  }

  /**
   * 모든 애니메이션 중지
   * @param character 캐릭터 자산
   */
  stopAllAnimations(character: CharacterAsset): void {
    character.mixer.stopAllAction();
  }

  /**
   * 캐릭터 해제 (메모리 정리)
   * @param character 캐릭터 자산
   */
  dispose(character: CharacterAsset): void {
    character.mixer.stopAllAction();
    character.mixer.uncacheRoot(character.mixer.getRoot());

    // 메시 해제
    character.mesh.geometry.dispose();
    if (character.mesh.material instanceof THREE.Material) {
      character.mesh.material.dispose();
    }
  }

  /**
   * 본 정보 조회 (디버그용)
   * @param character 캐릭터 자산
   * @returns 본 정보 배열
   */
  getBoneInfo(character: CharacterAsset): Array<{ name: string; position: THREE.Vector3 }> {
    return character.skeleton.bones.map(bone => ({
      name: bone.name,
      position: bone.position.clone()
    }));
  }
}
