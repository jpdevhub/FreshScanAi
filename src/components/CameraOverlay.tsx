import { useRef, useEffect } from 'react';

interface Props {
  active: boolean;
}

export default function CameraOverlay({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!active) return;

    const w = canvas.width;
    const h = canvas.height;
    const x = w * 0.1;
    const y = h * 0.15;
    const bw = w * 0.8;
    const bh = h * 0.7;

    ctx.strokeStyle = 'rgba(0, 255, 180, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(x, y, bw, bh);

    ctx.fillStyle = 'rgba(0, 255, 180, 0.15)';
    ctx.fillRect(x, y, bw, bh);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      className="absolute inset-0 w-full h-full z-30 pointer-events-none"
    />
  );
}
