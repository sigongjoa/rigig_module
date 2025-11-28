import * as THREE from 'three';

/**
 * 자동 본 매핑을 위한 패턴 정의
 */
interface BonePattern {
  pattern: RegExp;
  target: string;
}

/**
 * 다양한 캐릭터 모델(Mixamo, CMU 등)의 본을 표준 본으로 자동 매핑하는 유틸리티
 *
 * 이름 기반 정규식 매칭으로 본을 표준화하여 다양한 소스의 캐릭터 지원을 가능하게 합니다.
 */
export class BoneMapper {
  /**
   * 표준 본 이름 (우리 프로젝트 표준)
   * CMU Mocap 표준을 기반으로 함
   */
  static readonly STANDARD_BONES = {
    // 척추
    ROOT: 'Hips',
    SPINE: 'Spine',
    SPINE1: 'Spine1',
    SPINE2: 'Spine2',
    CHEST: 'Chest',
    NECK: 'Neck',
    HEAD: 'Head',

    // 왼쪽 팔
    LEFT_SHOULDER: 'LeftShoulder',
    LEFT_ARM: 'LeftArm',
    LEFT_FOREARM: 'LeftForeArm',
    LEFT_HAND: 'LeftHand',

    // 오른쪽 팔
    RIGHT_SHOULDER: 'RightShoulder',
    RIGHT_ARM: 'RightArm',
    RIGHT_FOREARM: 'RightForeArm',
    RIGHT_HAND: 'RightHand',

    // 왼쪽 다리
    LEFT_HIP: 'LeftHip',
    LEFT_LEG: 'LeftLeg',
    LEFT_FOOT: 'LeftFoot',
    LEFT_TOE: 'LeftToe',

    // 오른쪽 다리
    RIGHT_HIP: 'RightHip',
    RIGHT_LEG: 'RightLeg',
    RIGHT_FOOT: 'RightFoot',
    RIGHT_TOE: 'RightToe'
  };

  /**
   * 본 이름 매칭 규칙 (정규식)
   * 우선순위 순으로 정렬 (위에 있을수록 먼저 매칭)
   */
  private static readonly BONE_PATTERNS: BonePattern[] = [
    // ========== 루트 ==========
    { pattern: /^(armature|root|hips|mixamorig[:_]?hips)$/i, target: 'Hips' },
    { pattern: /(hips|root|armature)/i, target: 'Hips' },

    // ========== 척추 ==========
    // 정확한 매칭
    { pattern: /^(spine2|mixamorig:spine2)$/i, target: 'Spine2' },
    { pattern: /^(spine1|mixamorig:spine1)$/i, target: 'Spine1' },
    { pattern: /^(spine|mixamorig:spine)$/i, target: 'Spine' },

    // 유연한 매칭
    { pattern: /(spine2|torso2|chest2)/i, target: 'Spine2' },
    { pattern: /(spine1|torso1|chest1)/i, target: 'Spine1' },
    { pattern: /(spine|chest|torso|upperback|lowerback)/i, target: 'Spine' },

    // 목과 머리
    { pattern: /(neck|mixamorig:neck)/i, target: 'Neck' },
    { pattern: /(head|mixamorig:head)/i, target: 'Head' },

    // ========== 왼쪽 팔 ==========
    { pattern: /(left.*shoulder|leftshoulder|l_shoulder|mixamorig:leftshoulder)/i, target: 'LeftShoulder' },
    { pattern: /(left.*arm(?!fur)|leftarm|l_arm|mixamorig:leftarm)(?!forearm)/i, target: 'LeftArm' },
    { pattern: /(left.*forearm|leftforearm|l_forearm|mixamorig:leftforearm)/i, target: 'LeftForeArm' },
    { pattern: /(left.*hand|lefthand|l_hand|mixamorig:lefthand)/i, target: 'LeftHand' },

    // ========== 오른쪽 팔 ==========
    { pattern: /(right.*shoulder|rightshoulder|r_shoulder|mixamorig:rightshoulder)/i, target: 'RightShoulder' },
    { pattern: /(right.*arm(?!fur)|rightarm|r_arm|mixamorig:rightarm)(?!forearm)/i, target: 'RightArm' },
    { pattern: /(right.*forearm|rightforearm|r_forearm|mixamorig:rightforearm)/i, target: 'RightForeArm' },
    { pattern: /(right.*hand|righthand|r_hand|mixamorig:righthand)/i, target: 'RightHand' },

    // ========== 왼쪽 다리 ==========
    { pattern: /(left.*hip|lefthip|leftupleg|l_hip|l_upleg|mixamorig:leftupleg)/i, target: 'LeftHip' },
    { pattern: /(left.*leg(?!upleg)|leftleg|l_leg|mixamorig:leftleg)(?!upleg)/i, target: 'LeftLeg' },
    { pattern: /(left.*foot|leftfoot|l_foot|mixamorig:leftfoot)/i, target: 'LeftFoot' },
    { pattern: /(left.*toe|lefttoe|l_toe|mixamorig:lefttoe)/i, target: 'LeftToe' },

    // ========== 오른쪽 다리 ==========
    { pattern: /(right.*hip|righthip|rightupleg|r_hip|r_upleg|mixamorig:rightupleg)/i, target: 'RightHip' },
    { pattern: /(right.*leg(?!upleg)|rightleg|r_leg|mixamorig:rightleg)(?!upleg)/i, target: 'RightLeg' },
    { pattern: /(right.*foot|rightfoot|r_foot|mixamorig:rightfoot)/i, target: 'RightFoot' },
    { pattern: /(right.*toe|righttoe|r_toe|mixamorig:righttoe)/i, target: 'RightToe' }
  ];

  /**
   * 본 배열에서 자동 매핑 생성
   *
   * @param bones Three.js Bone 배열
   * @returns 원본 본 이름 → 표준 본 이름의 매핑 Map
   */
  static autoMapBones(bones: THREE.Bone[]): Map<string, string> {
    const mapping = new Map<string, string>();
    const mappedCount = { success: 0, failed: 0 };

    bones.forEach((bone) => {
      const boneName = bone.name;

      // 각 패턴 확인 (우선순위 순)
      for (const { pattern, target } of this.BONE_PATTERNS) {
        if (pattern.test(boneName)) {
          mapping.set(boneName, target);
          mappedCount.success++;
          console.log(`[BoneMapper] Mapped: ${boneName} → ${target}`);
          break; // 첫 번째 매칭 사용
        }
      }

      // 매핑 실패한 본
      if (!mapping.has(boneName)) {
        mappedCount.failed++;
        console.warn(`[BoneMapper] Failed to auto-map bone: ${boneName}`);
      }
    });

    const successRate = ((mappedCount.success / bones.length) * 100).toFixed(1);
    console.log(`[BoneMapper] Mapping complete: ${mappedCount.success}/${bones.length} (${successRate}%)`);

    return mapping;
  }

  /**
   * 본 이름 변경 적용
   *
   * @param mesh SkinnedMesh 객체
   * @param mapping 본 이름 매핑
   */
  static applyMapping(
    mesh: THREE.SkinnedMesh,
    mapping: Map<string, string>
  ): void {
    let appliedCount = 0;

    mapping.forEach((standardName, originalName) => {
      // 뼈 찾기
      const bone = this.findBoneByName(mesh.skeleton.bones, originalName);
      if (bone) {
        bone.name = standardName;
        appliedCount++;
      } else {
        console.warn(`[BoneMapper] Could not find bone to apply mapping: ${originalName}`);
      }
    });

    console.log(`[BoneMapper] Applied ${appliedCount}/${mapping.size} bone name mappings`);
  }

  /**
   * 애니메이션 클립의 트랙 이름을 매핑된 본 이름으로 변경
   *
   * @param animations AnimationClip 배열
   * @param mapping 본 이름 매핑
   */
  static applyMappingToAnimations(
    animations: THREE.AnimationClip[],
    mapping: Map<string, string>
  ): void {
    let updatedTracks = 0;

    animations.forEach(clip => {
      clip.tracks.forEach(track => {
        // 트랙 이름 형식: "BoneName.property" (예: "mixamorigHips.position")
        // 특수 문자(.)로 분리하여 본 이름 추출
        // 주의: 본 이름 자체에 .이 포함된 경우는 드물지만 고려 필요할 수 있음 (현재는 단순 분리)
        const dotIndex = track.name.indexOf('.');
        if (dotIndex === -1) return;

        const boneName = track.name.substring(0, dotIndex);
        const property = track.name.substring(dotIndex); // .position, .quaternion 등

        if (mapping.has(boneName)) {
          const newBoneName = mapping.get(boneName)!;
          track.name = `${newBoneName}${property}`;
          updatedTracks++;
        }
      });
    });

    console.log(`[BoneMapper] Updated ${updatedTracks} animation tracks with new bone names`);
  }

  /**
   * 본 찾기 (이름으로)
   *
   * @param bones 본 배열
   * @param name 찾을 본의 이름
   * @returns 찾은 본, 또는 null
   */
  private static findBoneByName(bones: THREE.Bone[], name: string): THREE.Bone | null {
    for (const bone of bones) {
      if (bone.name === name) {
        return bone;
      }
    }
    return null;
  }

  /**
   * 표준 본 이름 여부 확인
   *
   * @param boneName 본 이름
   * @returns 표준 본이면 true
   */
  static isStandardBone(boneName: string): boolean {
    return Object.values(this.STANDARD_BONES).includes(boneName);
  }

  /**
   * 본 검증 (주요 본이 있는지 확인)
   *
   * @param mesh SkinnedMesh 객체
   * @returns 검증 결과 객체
   */
  static validateBones(
    mesh: THREE.SkinnedMesh
  ): {
    isValid: boolean;
    missingBones: string[];
    foundBones: string[];
  } {
    const requiredBones = [
      'Hips',
      'Spine',
      'Head',
      'LeftArm',
      'RightArm',
      'LeftLeg',
      'RightLeg'
    ];

    const foundBones = mesh.skeleton.bones
      .map(b => b.name)
      .filter(name => requiredBones.includes(name));

    const missingBones = requiredBones.filter(name => !foundBones.includes(name));

    const isValid = missingBones.length === 0;

    if (!isValid) {
      console.warn(
        `[BoneMapper] Validation failed. Missing bones: ${missingBones.join(', ')}`
      );
    } else {
      console.log(`[BoneMapper] Validation passed. Found all required bones.`);
    }

    return {
      isValid,
      missingBones,
      foundBones
    };
  }

  /**
   * 본 정보 출력 (디버그용)
   *
   * @param mesh SkinnedMesh 객체
   */
  static printBoneHierarchy(mesh: THREE.SkinnedMesh): void {
    console.log('[BoneMapper] Bone Hierarchy:');
    const bones = mesh.skeleton.bones;
    bones.forEach((bone, index) => {
      console.log(`  [${index}] ${bone.name}`);
    });
  }

  /**
   * 본 통계 조회
   *
   * @param mesh SkinnedMesh 객체
   * @returns 통계 객체
   */
  static getBoneStatistics(
    mesh: THREE.SkinnedMesh
  ): {
    totalBones: number;
    standardBones: number;
    nonStandardBones: number;
    standardPercentage: number;
  } {
    const bones = mesh.skeleton.bones;
    const standardBones = bones.filter(b => this.isStandardBone(b.name));

    return {
      totalBones: bones.length,
      standardBones: standardBones.length,
      nonStandardBones: bones.length - standardBones.length,
      standardPercentage: ((standardBones.length / bones.length) * 100).toFixed(1) as any
    };
  }
}
