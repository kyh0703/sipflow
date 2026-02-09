import { ReactFlowProvider } from '@xyflow/react';
import { DnDProvider } from './features/scenario-builder/hooks/useDnD';
import { Canvas } from './features/scenario-builder/components/Canvas';
import './App.css';

function App() {
  return (
    <ReactFlowProvider>
      <DnDProvider>
        <div className="flex h-screen w-screen">
          <Canvas />
        </div>
      </DnDProvider>
    </ReactFlowProvider>
  );
}

export default App;
