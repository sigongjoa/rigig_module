import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CharacterLoader } from './3d-rigging/CharacterLoader';
import { CharacterRenderer } from './3d-rigging/CharacterRenderer';
import { BoneMapper } from './3d-rigging/BoneMapper';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let renderer: CharacterRenderer | null = null;
    let loader: CharacterLoader | null = null;

    const init = async () => {
      try {
        setStatus('Creating renderer...');

        // 1. Create renderer
        renderer = new CharacterRenderer(containerRef.current!, {
          width: 800,
          height: 600,
          backgroundColor: 0x2a2a3e,
          antialias: true
        });

        setStatus('Loading character model...');

        // 2. Create loader and load character
        loader = new CharacterLoader((progress) => {
          console.log(`Loading: ${progress.loaded}/${progress.total}`);
        });

        const character = await loader.loadCharacter('/models/remy.fbx');
        setStatus('Character loaded! Applying bone mapping...');

        // 3. Auto-map bones
        const boneMapping = BoneMapper.autoMapBones(character.skeleton.bones);
        BoneMapper.applyMapping(character.mesh, boneMapping);

        // 4. Validate bones
        const validation = BoneMapper.validateBones(character.mesh);
        if (!validation.isValid) {
          console.warn('Bone validation failed:', validation.missingBones);
        }

        setStatus('Adding character to scene...');

        // 5. Add character mesh to renderer
        renderer.addCharacterMesh(character.mesh);

        // 6. Play animation if available
        if (character.animations.length > 0) {
          const animName = character.animations[0].name;
          setStatus(`Playing animation: ${animName}`);
          loader.playAnimation(character, animName);
        }

        setStatus('Starting animation loop...');

        // 7. Start animation loop
        renderer.startAnimationLoop([character.mixer], (deltaTime, currentFps) => {
          setFps(Math.round(currentFps));
        });

        setStatus('✅ Ready! Character is rendering.');

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error:', errorMessage);
        setError(errorMessage);
        setStatus('❌ Failed to load character');
      }
    };

    init();

    // Cleanup
    return () => {
      if (renderer) {
        renderer.dispose();
      }
    };
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a2e',
      color: '#ffffff',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ marginBottom: '20px' }}>3D Rigging Verification POC</h1>

      <div
        ref={containerRef}
        style={{
          width: '800px',
          height: '600px',
          border: '2px solid #4a4a6a',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      />

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#2a2a3e',
        borderRadius: '8px',
        minWidth: '400px'
      }}>
        <p><strong>Status:</strong> {status}</p>
        <p><strong>FPS:</strong> {fps}</p>
        {error && (
          <p style={{ color: '#ff6b6b' }}><strong>Error:</strong> {error}</p>
        )}
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#2a2a3e',
        borderRadius: '8px',
        fontSize: '12px',
        maxWidth: '600px'
      }}>
        <p><strong>Expected Result:</strong></p>
        <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
          <li>Character model should be visible in the center</li>
          <li>Red and green debug cubes should be visible</li>
          <li>Animation should be playing (if available)</li>
          <li>FPS should be around 60</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
