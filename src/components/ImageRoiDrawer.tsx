import React, { useState, useRef, useEffect } from 'react';
import { X, Tag } from 'lucide-react';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

interface ImageRoiDrawerProps {
  imgSrc: string;
  rois: BoundingBox[];
  onChange: (rois: BoundingBox[]) => void;
  onRemove: () => void;
}

const BOX_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#ec4899', '#f97316', '#84cc16', '#14b8a6',
];

const ImageRoiDrawer: React.FC<ImageRoiDrawerProps> = ({ imgSrc, rois, onChange, onRemove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);
  const [labelingIdx, setLabelingIdx] = useState<number | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  const getPos = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const commitLabel = () => {
    if (labelingIdx === null) return;
    onChange(rois.map((b, i) => i === labelingIdx ? { ...b, label: labelDraft.trim() } : b));
    setLabelingIdx(null);
    setLabelDraft('');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-draw')) return;
    if (labelingIdx !== null) { commitLabel(); return; }
    e.preventDefault();
    const pos = getPos(e);
    setStartPos(pos);
    setIsDrawing(true);
    setCurrentBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing) return;
    const p = getPos(e);
    setCurrentBox({
      x: Math.min(startPos.x, p.x),
      y: Math.min(startPos.y, p.y),
      w: Math.abs(p.x - startPos.x),
      h: Math.abs(p.y - startPos.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentBox && currentBox.w > 1 && currentBox.h > 1) {
      const newIdx = rois.length;
      onChange([...rois, { ...currentBox, label: '' }]);
      setLabelingIdx(newIdx);
      setLabelDraft('');
      setTimeout(() => labelInputRef.current?.focus(), 50);
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
    if (labelingIdx === idx) { setLabelingIdx(null); setLabelDraft(''); }
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
          draggable={false}
        />

        {/* Saved ROIs */}
        {rois.map((box, idx) => {
          const color = BOX_COLORS[idx % BOX_COLORS.length];
          const isLabeling = labelingIdx === idx;
          return (
            <div
              key={idx}
              className="absolute no-draw"
              style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
            >
              {/* Box fill + border */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ border: `2px solid ${color}`, background: `${color}22` }}
              />

              {/* Index badge */}
              <div
                className="absolute -top-2 -left-1 text-white text-[9px] font-bold rounded px-1 leading-4 pointer-events-none z-20"
                style={{ background: color }}
              >
                {idx + 1}
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => removeBox(e, idx)}
                className="absolute -top-3 -right-3 text-white rounded-full p-0.5 hover:opacity-80 transition-opacity z-30"
                style={{ background: color }}
                title="Xóa vùng"
              >
                <X size={12} />
              </button>

              {/* Label area — shown above box */}
              <div className="absolute left-0 bottom-full mb-1 z-40 no-draw">
                {isLabeling ? (
                  <div className="flex items-center gap-1" style={{ minWidth: '130px' }}>
                    <input
                      ref={labelInputRef}
                      type="text"
                      value={labelDraft}
                      onChange={e => setLabelDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitLabel();
                        if (e.key === 'Escape') { setLabelingIdx(null); setLabelDraft(''); }
                      }}
                      placeholder="VD: PPE không đạt chuẩn, tư thế bất thường..."
                      className="text-[10px] border rounded-lg px-2 py-1 bg-white shadow-lg outline-none w-28"
                      style={{ borderColor: color }}
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); commitLabel(); }}
                      className="text-white text-[9px] font-bold rounded-lg px-2 py-1 whitespace-nowrap shadow"
                      style={{ background: color }}
                    >
                      OK
                    </button>
                  </div>
                ) : box.label ? (
                  <span
                    className="text-white text-[9px] font-semibold rounded-full px-2 py-0.5 cursor-pointer hover:opacity-80 flex items-center gap-1 shadow"
                    style={{ background: color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLabelingIdx(idx);
                      setLabelDraft(box.label || '');
                      setTimeout(() => labelInputRef.current?.focus(), 50);
                    }}
                    title="Nhấn để chỉnh sửa nhãn"
                  >
                    <Tag size={8} />
                    {box.label}
                  </span>
                ) : (
                  <button
                    className="text-[9px] rounded-full px-2 py-0.5 border flex items-center gap-1 bg-white/90 shadow hover:opacity-80"
                    style={{ borderColor: color, color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLabelingIdx(idx);
                      setLabelDraft('');
                      setTimeout(() => labelInputRef.current?.focus(), 50);
                    }}
                  >
                    <Tag size={8} />
                    Thêm nhãn
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* In-progress drawing box */}
        {isDrawing && currentBox && (
          <div
            className="absolute border-2 border-dashed pointer-events-none"
            style={{
              left: `${currentBox.x}%`,
              top: `${currentBox.y}%`,
              width: `${currentBox.w}%`,
              height: `${currentBox.h}%`,
              borderColor: BOX_COLORS[rois.length % BOX_COLORS.length],
              background: `${BOX_COLORS[rois.length % BOX_COLORS.length]}15`,
            }}
          />
        )}
      </div>

      {/* Remove image button */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-slate-600 hover:text-rose-500 hover:bg-white transition-all shadow-sm z-10 opacity-0 group-hover:opacity-100"
        title="Xóa ảnh"
      >
        <X size={16} />
      </button>

      <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
        <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-md shadow-sm">
          {labelingIdx !== null
            ? 'Nhập nhãn → Enter để lưu · Esc để bỏ qua'
            : 'Click & Kéo để vẽ vùng · Nhấn nhãn để chỉnh sửa'}
        </span>
      </div>
    </div>
  );
};

export default ImageRoiDrawer;
