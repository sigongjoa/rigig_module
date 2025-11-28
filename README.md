# 3D 리깅 검증 POC - 실행 가이드

## 프로젝트 개요
메인 프로젝트(`arcade-clash`)에서 3D 캐릭터가 제대로 렌더링되지 않는 문제를 독립적으로 검증하기 위한 최소 환경입니다.

## 디렉토리 구조
```
rigging-poc/
├── public/
│   └── models/
│       └── remy.fbx          # 테스트용 3D 모델
├── src/
│   ├── 3d-rigging/           # 리깅 시스템 (arcade-clash에서 복사)
│   │   ├── CharacterLoader.ts
│   │   ├── CharacterRenderer.ts
│   │   └── BoneMapper.ts
│   ├── App.tsx               # 검증용 메인 페이지
│   └── main.tsx
└── package.json
```

## 설치 및 실행

### 1. 의존성 설치
```bash
cd rigging-poc
npm install
npm install three @types/three
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 브라우저 접속
- 터미널에 표시된 URL로 접속 (예: `http://localhost:5173`)

## 예상 결과

### 성공 시
- 화면 중앙에 3D 캐릭터 모델이 보임
- 빨간색/녹색 디버그 큐브가 보임 (CharacterRenderer에 추가된 경우)
- 애니메이션이 재생됨 (모델에 애니메이션이 포함된 경우)
- FPS가 60 근처로 표시됨
- Status: "✅ Ready! Character is rendering."

### 실패 시 확인 사항
1. **모델이 안 보이는 경우**
   - 브라우저 콘솔에서 에러 메시지 확인
   - `/models/remy.fbx` 파일이 제대로 복사되었는지 확인
   - 네트워크 탭에서 FBX 파일이 로드되는지 확인

2. **점만 보이는 경우**
   - 카메라 위치/줌 문제일 가능성
   - CharacterRenderer의 스케일 로직 확인
   - 디버그 큐브가 보이는지 확인 (씬 자체는 렌더링되는지)

3. **로딩 중 멈추는 경우**
   - FBX 파일 경로 확인
   - Three.js FBXLoader 호환성 확인

## 백엔드 관련
- 이 POC는 **백엔드 없이** 순수 프론트엔드만으로 동작합니다.
- 백엔드(`backend/`)에는 캐릭터 메타데이터 생성 로직만 있고, 3D 렌더링 로직은 없습니다.

## 다음 단계
1. POC에서 캐릭터가 정상적으로 보이면 → 메인 프로젝트의 통합 이슈 디버깅
2. POC에서도 안 보이면 → CharacterRenderer/CharacterLoader 로직 자체 수정 필요
