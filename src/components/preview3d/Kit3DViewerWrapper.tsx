'use client';

import React, { useState, useEffect } from 'react';
import { Kit3DViewer, ZoneDragTarget } from './Kit3DViewer';

interface Kit3DViewerWrapperProps {
  textureDataUrl: string | null;
  className?: string;
  zoneDrag?: ZoneDragTarget | null;
}

export const Kit3DViewerWrapper: React.FC<Kit3DViewerWrapperProps> = (props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-[#0a0d14] rounded-2xl border border-slate-800 text-slate-400 gap-3">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold tracking-wide">
          Memuat Engine 3D Three.js...
        </span>
      </div>
    );
  }

  return <Kit3DViewer {...props} />;
};

export default Kit3DViewerWrapper;

