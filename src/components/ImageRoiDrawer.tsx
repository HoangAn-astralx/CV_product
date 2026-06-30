import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageRoiDrawerProps {
  imgSrc: string;
  rois: BoundingBox[];
  onChange: (rois: BoundingBox[]) => void;
  onRemove: () => void;
}

const ImageRoiDrawer: React.FC<ImageRoiDrawerProps> = ({ imgSrc, rois, onChange, onRemove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);

  const getPos = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    setStartPos(pos);
    setIsDrawing(true);
    setCurrentBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing) return;
    const currentPos = getPos(e);
    
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);
    
    setCurrentBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentBox && currentBox.w > 1 && currentBox.h > 1) {
      onChange([...rois, currentBox]);
    }
    setCurrentBox(null);
  };

  useEffect(() => {
    if (isDrawing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDrawing, currentBox, startPos, rois, onChange]);

  const removeBox = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    onChange(rois.filter((_, i) => i !== idx));
  };

  return (
    <div className="relative group block w-full border border-slate-200 rounded-xl overflow-hidden bg-slate-50 select-none text-center">
      <div 
        ref={containerRef}
        className="relative cursor-crosshair inline-block max-w-full"
        onMouseDown={handleMouseDown}
      >
        <img 
          src={imgSrc} 
          alt="Golden Sample" 
          className="w-full h-auto max-h-[600px] object-contain pointer-events-none" 
        />
        
        {/* Render saved ROIs */}
        {rois.map((box, idx) => (
          <div 
            key={idx}
            className="absolute border-2 border-emerald-500 bg-emerald-500/20 pointer-events-auto"
            style={{ 
              left: `${box.x}%`, 
              top: `${box.y}%`, 
              width: `${box.w}%`, 
              height: `${box.h}%` 
            }}
          >
            <button 
              onClick={(e) => removeBox(e, idx)}
              className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 transition-colors"
              title="Xóa vùng"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Render drawing ROI */}
        {isDrawing && currentBox && (
          <div 
            className="absolute border-2 border-emerald-500 border-dashed bg-emerald-500/10 pointer-events-none"
            style={{ 
              left: `${currentBox.x}%`, 
              top: `${currentBox.y}%`, 
              width: `${currentBox.w}%`, 
              height: `${currentBox.h}%` 
            }}
          />
        )}
      </div>

      <button
        onClick={onRemove}
        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-slate-600 hover:text-rose-500 hover:bg-white transition-all shadow-sm z-10 opacity-0 group-hover:opacity-100"
        title="Xóa ảnh"
      >
        <X size={16} />
      </button>

      <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
        <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-md shadow-sm">
          Click & Kéo để vẽ vùng kiểm tra
        </span>
      </div>
    </div>
  );
};

export default ImageRoiDrawer;
