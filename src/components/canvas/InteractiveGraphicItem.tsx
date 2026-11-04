'use client';

import React, { useMemo, useRef } from 'react';
import { Image as KonvaImage, Shape, Group, Rect } from 'react-konva';
import useImage from 'use-image';
import { KitGraphicItem } from '@/types/kit';
import { getStyledLogo } from '@/utils/logoStyle';
import { drawTextItem, fitTextBox } from '@/utils/textItem';

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
      // item.x / item.y are the top-left of the UNROTATED box; the texture generator (3D + export)
      // rotates around the box centre, so the node pivots on its centre too (position = centre).
      x={item.x + item.width / 2}
      y={item.y + item.height / 2}
      offsetX={item.width / 2}
      offsetY={item.height / 2}
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
          x: Math.round(e.target.x() - item.width / 2),
          y: Math.round(e.target.y() - item.height / 2),
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

        // a text box scales its letters: the font size follows, and the box is fitted to the text again
        if (item.type === 'text') {
          const k = Math.max(Math.abs(scaleX), Math.abs(scaleY));
          const cx = node.x(), cy = node.y();
          const sized = fitTextBox({ ...item, fontSize: Math.max(6, Math.round((item.fontSize || 32) * k)) });
          onChange({
            ...sized,
            x: Math.round(cx - sized.width / 2),
            y: Math.round(cy - sized.height / 2),
            rotation: Math.round(node.rotation()),
          });
          return;
        }
        // the offset point is the box centre, so node.x() / node.y() stay the centre while it scales
        const width = Math.max(12, Math.round(node.width() * scaleX));
        const height = Math.max(12, Math.round(node.height() * scaleY));
        onChange({
          ...item,
          x: Math.round(node.x() - width / 2),
          y: Math.round(node.y() - height / 2),
          width,
          height,
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
        // the same drawing as the 3D texture and the export (one line, outline behind, optional shadow)
        <Shape
          listening={false}
          opacity={item.opacity}
          sceneFunc={(context) => {
            const c = (context as any)._context as CanvasRenderingContext2D;
            c.save();
            c.translate(item.width / 2, item.height / 2);
            drawTextItem(c, item);
            c.restore();
          }}
        />
      )}
    </Group>
  );
};

export default InteractiveGraphicItem;
