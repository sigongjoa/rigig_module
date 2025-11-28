import * as THREE from 'three';

/**
 * FBX 모델 검증 결과
 */
export interface FBXValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: {
        hasMesh: boolean;
        meshType: string | null;
        boneCount: number;
        animationCount: number;
        hasTextures: boolean;
        meshSize: { x: number; y: number; z: number } | null;
        meshBounds: { min: THREE.Vector3; max: THREE.Vector3 } | null;
    };
}

/**
 * FBX 모델 검증기
 * 
 * 로드된 FBX 파일이 리깅 시스템에서 사용 가능한지 검증합니다.
 */
export class FBXValidator {
    /**
     * 필수 본 목록 (최소한 이 본들은 있어야 함)
     */
    private static readonly REQUIRED_BONES = [
        'Hips',
        'Spine',
        'Head',
        'LeftArm',
        'RightArm',
        'LeftLeg',
        'RightLeg'
    ];

    /**
     * 최소 본 개수 (Mixamo 캐릭터는 보통 65개 이상)
     */
    private static readonly MIN_BONE_COUNT = 20;

    /**
     * FBX 그룹 객체 검증
     */
    static validateFBXGroup(fbx: THREE.Group): FBXValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const info: FBXValidationResult['info'] = {
            hasMesh: false,
            meshType: null,
            boneCount: 0,
            animationCount: 0,
            hasTextures: false,
            meshSize: null,
            meshBounds: null
        };

        // 1. SkinnedMesh 찾기
        let mesh: THREE.SkinnedMesh | null = null;
        fbx.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.SkinnedMesh) {
                mesh = child;
                info.hasMesh = true;
                info.meshType = 'SkinnedMesh';
            }
        });

        if (!mesh) {
            errors.push('❌ CRITICAL: No SkinnedMesh found in FBX file');
            errors.push('   → This file cannot be used for character rigging');
            return { isValid: false, errors, warnings, info };
        }

        // 2. 메시 크기 검증
        const bbox = new THREE.Box3().setFromObject(mesh);
        const size = bbox.getSize(new THREE.Vector3());
        info.meshSize = { x: size.x, y: size.y, z: size.z };
        info.meshBounds = { min: bbox.min.clone(), max: bbox.max.clone() };

        if (size.x === 0 || size.y === 0 || size.z === 0) {
            errors.push('❌ CRITICAL: Mesh has zero size in one or more dimensions');
            errors.push(`   → Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
        }

        if (size.y < 0.1) {
            warnings.push('⚠️  Mesh is very small (height < 0.1 units)');
            warnings.push(`   → Current size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
            warnings.push('   → Will be scaled up automatically');
        }

        // 3. Skeleton 검증
        if (!mesh.skeleton) {
            errors.push('❌ CRITICAL: Mesh has no skeleton');
            errors.push('   → This is not a rigged character');
            return { isValid: false, errors, warnings, info };
        }

        const bones = mesh.skeleton.bones;
        info.boneCount = bones.length;

        if (bones.length === 0) {
            errors.push('❌ CRITICAL: Skeleton has no bones');
            return { isValid: false, errors, warnings, info };
        }

        if (bones.length < this.MIN_BONE_COUNT) {
            errors.push(`❌ CRITICAL: Too few bones (${bones.length} < ${this.MIN_BONE_COUNT})`);
            errors.push('   → This model appears to be incomplete or corrupted');
            errors.push(`   → Expected at least ${this.MIN_BONE_COUNT} bones for a full character`);
        }

        // 4. 본 이름 검증
        const boneNames = bones.map(b => b.name);
        const missingBones: string[] = [];

        // Mixamo 본 이름 패턴 확인
        const hasMixamoPrefix = boneNames.some(name => name.toLowerCase().includes('mixamorig'));

        if (hasMixamoPrefix) {
            // Mixamo 본 검증
            const mixamoBones = ['mixamorigHips', 'mixamorigSpine', 'mixamorigHead',
                'mixamorigLeftArm', 'mixamorigRightArm',
                'mixamorigLeftUpLeg', 'mixamorigRightUpLeg'];

            mixamoBones.forEach(boneName => {
                if (!boneNames.includes(boneName)) {
                    missingBones.push(boneName);
                }
            });
        } else {
            // 표준 본 검증
            this.REQUIRED_BONES.forEach(boneName => {
                if (!boneNames.includes(boneName)) {
                    missingBones.push(boneName);
                }
            });
        }

        if (missingBones.length > 0) {
            warnings.push(`⚠️  Missing some expected bones: ${missingBones.slice(0, 3).join(', ')}${missingBones.length > 3 ? '...' : ''}`);
            warnings.push('   → Animation may not work correctly');
        }

        // 5. 애니메이션 검증
        info.animationCount = fbx.animations?.length || 0;

        if (info.animationCount === 0) {
            warnings.push('⚠️  No animations found in FBX file');
            warnings.push('   → Character will be static (T-pose)');
        }

        // 6. 텍스처 검증
        if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            info.hasTextures = materials.some(mat => {
                if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
                    return mat.map !== null;
                }
                return false;
            });

            if (!info.hasTextures) {
                warnings.push('⚠️  No textures found');
                warnings.push('   → Character will use default material colors');
            }
        }

        // 최종 판정
        const isValid = errors.length === 0;

        return { isValid, errors, warnings, info };
    }

    /**
     * 검증 결과를 콘솔에 출력
     */
    static printValidationResult(result: FBXValidationResult, modelName: string): void {
        console.log('\n' + '='.repeat(60));
        console.log(`📦 FBX Validation Report: ${modelName}`);
        console.log('='.repeat(60));

        // 정보 출력
        console.log('\n📊 Model Information:');
        console.log(`   Mesh Type: ${result.info.meshType || 'None'}`);
        console.log(`   Bone Count: ${result.info.boneCount}`);
        console.log(`   Animation Count: ${result.info.animationCount}`);
        console.log(`   Has Textures: ${result.info.hasTextures ? 'Yes' : 'No'}`);

        if (result.info.meshSize) {
            const s = result.info.meshSize;
            console.log(`   Mesh Size: ${s.x.toFixed(2)} x ${s.y.toFixed(2)} x ${s.z.toFixed(2)} units`);
        }

        // 에러 출력
        if (result.errors.length > 0) {
            console.log('\n🚨 ERRORS:');
            result.errors.forEach(err => console.log(`   ${err}`));
        }

        // 경고 출력
        if (result.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            result.warnings.forEach(warn => console.log(`   ${warn}`));
        }

        // 최종 결과
        console.log('\n' + '='.repeat(60));
        if (result.isValid) {
            console.log('✅ VALIDATION PASSED - Model is ready to use');
        } else {
            console.log('❌ VALIDATION FAILED - Model cannot be used');
        }
        console.log('='.repeat(60) + '\n');
    }

    /**
     * 검증 결과를 HTML 형식으로 반환
     */
    static formatValidationHTML(result: FBXValidationResult): string {
        let html = '<div style="font-family: monospace; padding: 10px; background: #1a1a2e; color: #fff; border-radius: 5px;">';

        html += '<h3 style="margin: 0 0 10px 0;">📦 FBX Validation Report</h3>';

        // Info
        html += '<div style="margin-bottom: 10px;">';
        html += `<div>Bones: <strong>${result.info.boneCount}</strong></div>`;
        html += `<div>Animations: <strong>${result.info.animationCount}</strong></div>`;
        if (result.info.meshSize) {
            const s = result.info.meshSize;
            html += `<div>Size: <strong>${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)}</strong></div>`;
        }
        html += '</div>';

        // Errors
        if (result.errors.length > 0) {
            html += '<div style="color: #ff6b6b; margin-bottom: 10px;">';
            html += '<strong>🚨 ERRORS:</strong><br>';
            result.errors.forEach(err => {
                html += `<div style="margin-left: 10px;">${err}</div>`;
            });
            html += '</div>';
        }

        // Warnings
        if (result.warnings.length > 0) {
            html += '<div style="color: #ffd93d; margin-bottom: 10px;">';
            html += '<strong>⚠️ WARNINGS:</strong><br>';
            result.warnings.forEach(warn => {
                html += `<div style="margin-left: 10px;">${warn}</div>`;
            });
            html += '</div>';
        }

        // Result
        if (result.isValid) {
            html += '<div style="color: #6bcf7f; font-weight: bold;">✅ VALIDATION PASSED</div>';
        } else {
            html += '<div style="color: #ff6b6b; font-weight: bold;">❌ VALIDATION FAILED</div>';
        }

        html += '</div>';
        return html;
    }
}
