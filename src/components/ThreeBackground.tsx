import { useEffect, useRef, useState } from 'react';
import type { FinanceScene } from '../lib/three/FinanceScene';

export default function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FinanceScene | null>(null);
  const [isWebGLSupported, setIsWebGLSupported] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initScene = async () => {
      const { isWebGLAvailable } = await import('../lib/three/WebGLDetector');

      if (!isWebGLAvailable()) {
        setIsWebGLSupported(false);
        return;
      }

      if (!containerRef.current || !isMounted) return;

      const { FinanceScene } = await import('../lib/three/FinanceScene');
      sceneRef.current = new FinanceScene(containerRef.current);
      sceneRef.current.animate();
    };

    initScene();

    // Handle visibility change - pause when tab not visible
    const handleVisibilityChange = () => {
      if (document.hidden && sceneRef.current) {
        // Scene will naturally pause when not rendering
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  if (!isWebGLSupported) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}
