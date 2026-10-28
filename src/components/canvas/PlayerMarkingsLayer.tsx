'use client';

import React from 'react';
import { Group, Text as KonvaText, Rect } from 'react-konva';
import { PlayerMarkingsConfig } from '@/types/kit';
import { BACK_NECK_Y, BACK_CENTER_X } from '@/constants/pes2021Parts';

interface PlayerMarkingsLayerProps {
  markings: PlayerMarkingsConfig;
  isExportingClean?: boolean;
}

export const PlayerMarkingsLayer: React.FC<PlayerMarkingsLayerProps> = ({
  markings,
  isExportingClean = false,
}) => {
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
      {/* Shirt back is stored upside-down in the PES template (hem at y=0, neck at
          BACK_NECK_Y), so name + number live in a group rotated 180° about the neck centre.
          Inside the group y grows from the neckline down the shirt. */}
      <Group x={BACK_CENTER_X} y={BACK_NECK_Y} rotation={180} listening={false}>
        {/* 1. Player Name */}
        {markings.playerName && (
          <KonvaText
            x={-172}
            y={markings.nameY - markings.nameSize / 2}
            text={markings.playerName.toUpperCase()}
            width={344}
            align="center"
            fontSize={markings.nameSize}
            fontFamily={markings.fontFamily}
            fontStyle="bold"
            fill={markings.nameColor}
            letterSpacing={4}
            shadowColor="rgba(0,0,0,0.6)"
            shadowBlur={4}
            shadowOffsetY={2}
          />
        )}

        {/* 2. Squad Number */}
        {markings.playerNumber && (
          <KonvaText
            x={-172}
            y={markings.numberY - markings.numberSize / 2}
            text={markings.playerNumber}
            width={344}
            align="center"
            fontSize={markings.numberSize}
            fontFamily={markings.fontFamily}
            fontStyle="bold"
            fill={markings.numberColor}
            stroke={markings.numberStrokeWidth > 0 ? markings.numberStrokeColor : undefined}
            strokeWidth={markings.numberStrokeWidth}
            letterSpacing={2}
            shadowColor="rgba(0,0,0,0.7)"
            shadowBlur={6}
            shadowOffsetY={3}
          />
        )}
      </Group>

      {/* 3. Squad Number on the texture-left shorts piece */}
      {markings.shortsNumber && (
        <Group x={markings.shortsNumberX} y={markings.shortsNumberY} listening={false}>
          <KonvaText
            x={-markings.shortsNumberSize}
            y={-markings.shortsNumberSize / 2}
            width={markings.shortsNumberSize * 2}
            align="center"
            text={markings.shortsNumber}
            fontSize={markings.shortsNumberSize}
            fontFamily={markings.fontFamily}
            fontStyle="bold"
            fill={markings.numberColor}
            stroke={markings.numberStrokeWidth > 0 ? markings.numberStrokeColor : undefined}
            strokeWidth={Math.max(1, Math.round(markings.numberStrokeWidth * 0.7))}
            shadowColor="rgba(0,0,0,0.7)"
            shadowBlur={4}
            shadowOffsetY={2}
          />
        </Group>
      )}

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
            text="PREVIEW NAMA & NOMOR"
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
