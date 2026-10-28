'use client';

import React, { useMemo, useRef } from 'react';
import { Image as KonvaImage, Text as KonvaText, Group, Rect } from 'react-konva';
import useImage from 'use-image';
import { KitGraphicItem } from '@/types/kit';
import { getStyledLogo } from '@/utils/logoStyle';

interface InteractiveGraphicItemProps {
  item: KitGraphicItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: KitGraphicItem) => void;
}

export const InteractiveGraphicItem: React.FC<InteractiveGraphicItemProps> = ({
  item,
  isSelected,
  onSelect,
  onChange,
}) => {
  const shapeRef = useRef<any>(null);

  // Load image with anonymous crossOrigin to prevent canvas tainting
  const [image] = useImage(item.src || '', 'anonymous');

  // Recolour / gradient / outline: a pre-rendered bitmap (2x for a sharp editor view)
  const styled = useMemo(
    () => (image ? getStyledLogo(image, item, 2) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image, item.src, item.width, item.height, item.fill, item.outline]
  );

  return (
    <Group
      id={item.id}
      ref={shapeRef}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      draggable={!item.locked}
      onClick={(e) => {
        // Prevent click from bubbling down to parts underneath
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(e) => {
        onChange({
          ...item,
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        // Reset scale on node and update dimensions
        node.scaleX(1);
        node.scaleY(1);

        onChange({
          ...item,
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.max(12, Math.round(node.width() * scaleX)),
          height: Math.max(12, Math.round(node.height() * scaleY)),
          rotation: Math.round(node.rotation()),
        });
      }}
    >
      {/* Invisible hit-box ensures Group always has concrete dimensions even before image is loaded */}
      <Rect
        width={item.width}
        height={item.height}
        fill="rgba(0,0,0,0.001)"
      />

      {item.type === 'image' && image && !styled && (
        <KonvaImage
          image={image}
          width={item.width}
          height={item.height}
          opacity={item.opacity}
        />
      )}
      {item.type === 'image' && image && styled && (
        <KonvaImage
          image={styled.canvas}
          x={-styled.pad}
          y={-styled.pad}
          width={styled.canvas.width / 2}
          height={styled.canvas.height / 2}
          opacity={item.opacity}
        />
      )}

      {item.type === 'text' && (
        <KonvaText
          text={item.text || ''}
          fontSize={item.fontSize || 32}
          fontFamily={item.fontFamily || "'Impact', 'Arial Black', sans-serif"}
          fontStyle="bold"
          fill={item.textColor || '#ffffff'}
          stroke={item.strokeColor || undefined}
          strokeWidth={item.strokeWidth || 0}
          width={item.width}
          height={item.height}
          align="center"
          verticalAlign="middle"
          opacity={item.opacity}
          shadowColor="rgba(0,0,0,0.8)"
          shadowBlur={4}
          shadowOffsetX={2}
          shadowOffsetY={2}
        />
      )}
    </Group>
  );
};

export default InteractiveGraphicItem;
