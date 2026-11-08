'use client';

import React from 'react';
import { Group, Text as KonvaText, Rect, Shape } from 'react-konva';
import { drawPlayerMarkings, MarkingsView } from '@/utils/markingsLayout';
import { useI18n } from '@/i18n/I18nProvider';

interface PlayerMarkingsLayerProps {
  markings: MarkingsView;
  isExportingClean?: boolean;
}

export const PlayerMarkingsLayer: React.FC<PlayerMarkingsLayerProps> = ({
  markings,
  isExportingClean = false,
}) => {
  // canvas text is not part of the page, so it is translated here (react-konva passes the context through)
  const { t } = useI18n();
  // If exporting and user configured to NOT include markings in texture, skip rendering
  if (isExportingClean && !markings.includeInExport) {
    return null;
  }

  // If preview is disabled in editor and not exporting, skip
  if (!markings.showPreview && !isExportingClean) {
    return null;
  }

  return (
    <Group id="player-markings-layer">
      {/* drawn by the same code as the export and the 3D texture, placed from the config values */}
      <Shape listening={false} sceneFunc={(ctx) => drawPlayerMarkings(ctx._context, markings)} />

      {/* 4. Non-intrusive preview tag shown only in editor */}
      {!isExportingClean && (
        <Group x={345} y={6} listening={false}>
          <Rect
            width={170}
            height={16}
            fill="rgba(2, 132, 199, 0.25)"
            stroke="rgba(56, 189, 248, 0.5)"
            strokeWidth={0.8}
            cornerRadius={3}
          />
          <KonvaText
            x={6}
            y={3}
            text={t('PREVIEW NAMA & NOMOR')}
            fontSize={9}
            fontFamily="system-ui, sans-serif"
            fontStyle="bold"
            fill="#38bdf8"
          />
        </Group>
      )}
    </Group>
  );
};

export default PlayerMarkingsLayer;
