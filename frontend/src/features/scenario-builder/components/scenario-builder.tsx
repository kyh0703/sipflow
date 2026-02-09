import { ReactFlowProvider } from '@xyflow/react';
import { DnDProvider } from '../hooks/use-dnd';
import { Canvas } from './canvas';
import { NodePalette } from './node-palette';
import { PropertiesPanel } from './properties-panel';

export function ScenarioBuilder() {
  return (
    <ReactFlowProvider>
      <DnDProvider>
        <div className="flex h-screen w-screen">
          {/* Left Sidebar */}
          <div className="w-[200px] border-r border-border flex flex-col bg-background">
            {/* Upper area: Scenario tree placeholder */}
            <div className="flex-1 border-b p-3">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Scenarios</h3>
              <p className="text-xs text-muted-foreground">No scenarios yet</p>
            </div>

            {/* Lower area: Node palette */}
            <div className="flex-1 overflow-y-auto p-3">
              <NodePalette />
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1">
            <Canvas />
          </div>

          {/* Right Sidebar: Properties */}
          <div className="w-[280px] border-l border-border bg-background overflow-y-auto p-4">
            <PropertiesPanel />
          </div>
        </div>
      </DnDProvider>
    </ReactFlowProvider>
  );
}
