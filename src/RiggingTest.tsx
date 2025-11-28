import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CharacterLoader } from './3d-rigging/CharacterLoader';
import { CharacterRenderer } from './3d-rigging/CharacterRenderer';
import { BoneMapper } from './3d-rigging/BoneMapper';
import { FBXValidator } from './3d-rigging/FBXValidator';

function RiggingTest() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<string>('Initializing...');
    const [error, setError] = useState<string | null>(null);
    const [fps, setFps] = useState<number>(0);
    const [boneInfo, setBoneInfo] = useState<string[]>([]);
    const [cameraAngle, setCameraAngle] = useState<number>(0);
    const rendererRef = useRef<CharacterRenderer | null>(null);
    const characterRef = useRef<any>(null);
    const [currentAction, setCurrentAction] = useState<string>('Idle');
    const [charPos, setCharPos] = useState<{ x: number, y: number, z: number }>({ x: 0, y: 0, z: 0 });

    // Input state
    const keysPressed = useRef<{ [key: string]: boolean }>({});
    const isAttacking = useRef<boolean>(false);
    const loaderRef = useRef<CharacterLoader | null>(null);
    const frameCounter = useRef<number>(0);

    useEffect(() => {
        if (!containerRef.current) return;

        let renderer: CharacterRenderer | null = null;
        let loader: CharacterLoader | null = null;

        const init = async () => {
            setStatus('Creating renderer...');

            // 1. Create renderer
            renderer = new CharacterRenderer(containerRef.current!, {
                width: 800,
                height: 600,
                backgroundColor: 0x2a2a3e,
                antialias: true
            });
            rendererRef.current = renderer;

            setStatus('Loading character model...');

            // 2. Create loader and load character
            loader = new CharacterLoader((progress) => {
                console.log(`Loading: ${progress.loaded}/${progress.total}`);
            });
            loaderRef.current = loader;

            const character = await loader.loadCharacter('/models/Ch24_nonPBR.fbx');
            characterRef.current = character;

            // ===== FBX VALIDATION =====
            setStatus('Validating FBX model...');
            const validationResult = FBXValidator.validateFBXGroup(character.rawFbx!);

            // Print validation report to console
            FBXValidator.printValidationResult(validationResult, 'Ch24_nonPBR.fbx');

            // Check if validation failed
            if (!validationResult.isValid) {
                const errorMsg = validationResult.errors.join('\n');
                setError(errorMsg);
                setStatus('❌ FBX Validation Failed');
                console.error('[RiggingTest] FBX validation failed:', validationResult.errors);
                return; // Stop execution if validation fails
            }

            if (validationResult.warnings.length > 0) {
                console.warn('[RiggingTest] FBX validation warnings:', validationResult.warnings);
            }

            setStatus('Analyzing bones...');

            // 3. Get bone information BEFORE mapping
            const originalBones = character.skeleton.bones.map((b: any) => b.name);
            console.log('[RiggingTest] Original bones:', originalBones);
            setBoneInfo(originalBones);

            // 4. Auto-map bones
            const boneMapping = BoneMapper.autoMapBones(character.skeleton.bones);
            BoneMapper.applyMapping(character.mesh, boneMapping);
            BoneMapper.applyMappingToAnimations(character.animations, boneMapping);

            // 5. Validate bones
            const validation = BoneMapper.validateBones(character.mesh);
            console.log('[RiggingTest] Validation:', validation);

            // 6. Get bone statistics
            const stats = BoneMapper.getBoneStatistics(character.mesh);
            console.log('[RiggingTest] Bone statistics:', stats);

            setStatus(`Bones: ${stats.totalBones} total, ${stats.standardBones} standard`);

            // 7. Add character mesh to renderer
            renderer.addCharacterMesh(character.mesh);

            // 8. Play animation if available
            if (character.animations.length > 0) {
                const animName = character.animations[0].name;
                setStatus(`Playing animation: ${animName}`);
                loader.playAnimation(character, animName);
            }

            setStatus('Starting animation loop...');

            // 9. Start animation loop with game logic
            renderer.startAnimationLoop([character.mixer], (deltaTime, currentFps) => {
                setFps(Math.round(currentFps));

                // Game Logic: Movement
                if (characterRef.current && !isAttacking.current) {
                    const speed = 300 * deltaTime; // Increased speed for visibility
                    const mesh = characterRef.current.mesh;

                    // Forward/Backward (Z-axis)
                    if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
                        mesh.position.z += speed;
                    }
                    if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
                        mesh.position.z -= speed;
                    }
                    // Left/Right (X-axis)
                    if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
                        mesh.position.x += speed;
                    }
                    if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
                        mesh.position.x -= speed;
                    }

                    // Update debug position (throttled)
                    frameCounter.current++;
                    if (frameCounter.current % 5 === 0) { // Update faster (every 5 frames)
                        setCharPos({
                            x: parseFloat(mesh.position.x.toFixed(1)),
                            y: parseFloat(mesh.position.y.toFixed(1)),
                            z: parseFloat(mesh.position.z.toFixed(1))
                        });
                    }
                }
            });

            setStatus('✅ Ready! Character is rendering.');
        };

        init().catch(err => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error:', errorMessage);
            setError(errorMessage);
            setStatus('❌ Failed to load character');
        });

        // Helper functions for input handling
        const triggerAttack = (attackName: string) => {
            if (!characterRef.current || isAttacking.current) return;

            isAttacking.current = true;
            setCurrentAction(attackName);
            console.log(`[Game] Attack triggered: ${attackName}`);

            // Try to find an attack animation
            const animations = characterRef.current.animations;
            let attackAnim = animations.find((a: any) =>
                a.name.toLowerCase().includes('jab') ||
                a.name.toLowerCase().includes('punch') ||
                a.name.toLowerCase().includes('attack')
            );

            // Fallback: Use 2nd animation if available
            if (!attackAnim && animations.length > 1) {
                attackAnim = animations[1];
            }

            if (attackAnim && loaderRef.current) {
                loaderRef.current.playAnimation(characterRef.current, attackAnim.name, THREE.LoopOnce);
            } else {
                console.warn('[Game] No attack animation found');
            }

            // Reset after delay
            setTimeout(() => {
                isAttacking.current = false;
                updateMovementState();
            }, 500);
        };

        const updateMovementState = () => {
            if (isAttacking.current || !characterRef.current) return;

            const forward = keysPressed.current['w'] || keysPressed.current['arrowup'];
            const backward = keysPressed.current['s'] || keysPressed.current['arrowdown'];
            const left = keysPressed.current['a'] || keysPressed.current['arrowleft'];
            const right = keysPressed.current['d'] || keysPressed.current['arrowright'];

            const isMoving = forward || backward || left || right;
            const targetAction = isMoving ? 'Walk' : 'Idle';

            setCurrentAction(targetAction);

            // Find animations
            const animations = characterRef.current.animations;
            let animToPlay = null;

            if (isMoving) {
                animToPlay = animations.find((a: any) =>
                    a.name.toLowerCase().includes('walk') ||
                    a.name.toLowerCase().includes('run')
                );
                // Fallback to 2nd animation if no "Walk" found
                if (!animToPlay && animations.length > 1) animToPlay = animations[1];
            } else {
                animToPlay = animations.find((a: any) =>
                    a.name.toLowerCase().includes('idle') ||
                    a.name.toLowerCase().includes('wait')
                );
                // Fallback to 1st animation
                if (!animToPlay && animations.length > 0) animToPlay = animations[0];
            }

            if (animToPlay && loaderRef.current) {
                loaderRef.current.playAnimation(characterRef.current, animToPlay.name);
            }
        };

        // 10. Input Event Listeners
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            console.log(`[Input] Key Down: ${key}`); // Debug log
            keysPressed.current[key] = true;

            // Combat Inputs
            if (!isAttacking.current) {
                if (key === 'j' || key === 'z') {
                    triggerAttack('Jab');
                } else if (key === 'k' || key === 'x') {
                    triggerAttack('Straight');
                }
            }

            updateMovementState();
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            console.log(`[Input] Key Up: ${key}`); // Debug log
            keysPressed.current[key] = false;
            updateMovementState();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (renderer) {
                renderer.dispose();
            }
        };
    }, []);

    // Camera rotation control
    const rotateCamera = (angle: number) => {
        if (!rendererRef.current) return;

        const camera = (rendererRef.current as any).camera;
        const radius = 400;
        const angleRad = (angle * Math.PI) / 180;

        camera.position.x = Math.sin(angleRad) * radius;
        camera.position.z = Math.cos(angleRad) * radius;
        camera.position.y = 300; // Elevated view to see the floor
        camera.lookAt(0, 100, 0); // Look at character center

        setCameraAngle(angle);
    };

    // Capture screenshot
    const captureScreenshot = () => {
        if (!rendererRef.current) return;
        rendererRef.current.captureScreenshot(`rigging_test_angle_${cameraAngle}.png`);
    };

    // Auto-rotate and capture
    const autoCapture = async () => {
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        for (const angle of angles) {
            rotateCamera(angle);
            await new Promise(resolve => setTimeout(resolve, 500));
            captureScreenshot();
        }
    };

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
            fontFamily: 'monospace',
            padding: '20px'
        }}>
            <h1 style={{ marginBottom: '20px' }}>3D Rigging Test - Multi-Angle Verification</h1>

            <div
                ref={containerRef}
                style={{
                    width: '800px',
                    height: '600px',
                    minHeight: '600px', // Prevent squashing
                    flexShrink: 0,      // Prevent flexbox shrinking
                    border: '2px solid #4a4a6a',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '20px'
                }}
            />

            <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }}>
                <button onClick={() => rotateCamera(0)} style={buttonStyle}>Front (0°)</button>
                <button onClick={() => rotateCamera(45)} style={buttonStyle}>45°</button>
                <button onClick={() => rotateCamera(90)} style={buttonStyle}>Side (90°)</button>
                <button onClick={() => rotateCamera(135)} style={buttonStyle}>135°</button>
                <button onClick={() => rotateCamera(180)} style={buttonStyle}>Back (180°)</button>
                <button onClick={() => rotateCamera(225)} style={buttonStyle}>225°</button>
                <button onClick={() => rotateCamera(270)} style={buttonStyle}>Side (270°)</button>
                <button onClick={() => rotateCamera(315)} style={buttonStyle}>315°</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button onClick={captureScreenshot} style={{ ...buttonStyle, backgroundColor: '#4CAF50' }}>
                    📸 Capture Screenshot
                </button>
                <button onClick={autoCapture} style={{ ...buttonStyle, backgroundColor: '#2196F3' }}>
                    🎬 Auto-Capture All Angles
                </button>
                <button onClick={() => {
                    if (characterRef.current) {
                        characterRef.current.mesh.position.z += 50;
                        console.log('Forced Move Forward');
                    }
                }} style={{ ...buttonStyle, backgroundColor: '#ff9800' }}>
                    ⏩ Force Move Z+50
                </button>
            </div>

            {/* Controls Guide */}
            <div style={{
                padding: '15px',
                backgroundColor: '#2a2a3e',
                borderRadius: '8px',
                minWidth: '600px',
                marginBottom: '20px'
            }}>
                <p><strong>🎮 Controls:</strong></p>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                    <li>⬆️ <strong>W / ArrowUp</strong>: Move Forward (Z+)</li>
                    <li>⬇️ <strong>S / ArrowDown</strong>: Move Backward (Z-)</li>
                    <li>⬅️ <strong>A / ArrowLeft</strong>: Move Left (X-)</li>
                    <li>➡️ <strong>D / ArrowRight</strong>: Move Right (X+)</li>
                    <li>👊 <strong>J / Z</strong>: Jab Attack</li>
                    <li>🤜 <strong>K / X</strong>: Straight Attack</li>
                </ul>
                <p style={{ marginTop: '10px', color: '#4CAF50', fontSize: '18px' }}>
                    <strong>Current Action: {currentAction}</strong>
                </p>
                <p style={{ marginTop: '5px', color: '#ffeb3b' }}>
                    <strong>Keys Pressed: {Object.entries(keysPressed.current).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'None'}</strong>
                </p>
            </div>

            <div style={{
                padding: '15px',
                backgroundColor: '#2a2a3e',
                borderRadius: '8px',
                minWidth: '600px',
                marginBottom: '20px'
            }}>
                <p><strong>Status:</strong> {status}</p>
                <p><strong>FPS:</strong> {fps}</p>
                <p><strong>Camera Angle:</strong> {cameraAngle}°</p>
                <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: '#000',
                    border: '1px solid #4CAF50',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    color: '#4CAF50'
                }}>
                    <strong>📍 Position Debug:</strong><br />
                    X: {charPos.x.toFixed(2)}<br />
                    Y: {charPos.y.toFixed(2)}<br />
                    Z: {charPos.z.toFixed(2)}
                </div>
                {error && (
                    <p style={{ color: '#ff6b6b', whiteSpace: 'pre-wrap' }}><strong>Error:</strong><br />{error}</p>
                )}
            </div>

            {boneInfo.length > 0 && (
                <div style={{
                    padding: '15px',
                    backgroundColor: '#2a2a3e',
                    borderRadius: '8px',
                    maxWidth: '800px',
                    maxHeight: '200px',
                    overflow: 'auto'
                }}>
                    <p><strong>Detected Bones ({boneInfo.length}):</strong></p>
                    <div style={{
                        fontSize: '11px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '5px',
                        marginTop: '10px'
                    }}>
                        {boneInfo.map((bone, i) => (
                            <div key={i}>{bone}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* Animation List Display */}
            <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#2a2a3e',
                borderRadius: '8px',
                minWidth: '600px'
            }}>
                <p><strong>Available Animations:</strong></p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {characterRef.current?.animations.map((anim: any, i: number) => (
                        <li key={i}>- {anim.name}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: '#4a4a6a',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'monospace'
};

export default RiggingTest;
