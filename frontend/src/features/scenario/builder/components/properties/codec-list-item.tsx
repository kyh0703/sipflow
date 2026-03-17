import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodecListItemProps {
  codec: string;
  index: number;
  onMove: (fromIndex: number, toIndex: number) => void;
}

// Codec payload types mapping (RTP payload type numbers)
const CODEC_PAYLOAD_TYPES: Record<string, number> = {
  PCMU: 0,
  PCMA: 8,
};

export function CodecListItem({ codec, index, onMove }: CodecListItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = () => {
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onMove(fromIndex, index);
    }
  };

  const payloadType = CODEC_PAYLOAD_TYPES[codec] ?? '?';

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'nodrag flex items-center gap-2 px-3 py-2 border rounded-md cursor-move transition-all',
        'bg-background hover:bg-accent/50',
        isDragging && 'opacity-50',
        isDragOver && 'bg-accent'
      )}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground" />
      <span className="flex-1 font-medium">{codec}</span>
      <span className="text-xs text-muted-foreground">({payloadType})</span>
    </div>
  );
}
