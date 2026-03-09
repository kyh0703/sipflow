import { Redo2, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CanvasToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
}

export function CanvasToolbar({
  canUndo,
  canRedo,
  canDelete,
  onUndo,
  onRedo,
  onDelete,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-md"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        aria-label="Undo"
      >
        <Undo2 />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-md"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
        disabled={!canDelete}
        title="Delete selection (Delete/Backspace)"
        aria-label="Delete selection"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
