import { useEffect, useRef } from 'react';
import { useStore, type ReactFlowState } from '@xyflow/react';

const storeSelector = (state: ReactFlowState) => ({
  width: state.width,
  height: state.height,
  transform: state.transform,
});

interface HelperLinesProps {
  horizontal?: number;
  vertical?: number;
}

export function HelperLines({ horizontal, vertical }: HelperLinesProps) {
  const { width, height, transform } = useStore(storeSelector);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    const dpi = window.devicePixelRatio || 1;
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpi, dpi);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = '#3b82f6';
    context.lineWidth = 1;

    if (typeof vertical === 'number') {
      const x = vertical * transform[2] + transform[0];
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    if (typeof horizontal === 'number') {
      const y = horizontal * transform[2] + transform[1];
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }, [height, horizontal, transform, vertical, width]);

  return (
    <canvas
      ref={canvasRef}
      className="react-flow__canvas pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}
