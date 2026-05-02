'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface DividerProps {
  color?: string;
  thickness?: number;
  marginY?: number;
}

export const Divider: UserComponent<DividerProps> = ({
  color = '#e5e7eb',
  thickness = 1,
  marginY = 16,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <hr
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{ borderColor: color, borderWidth: thickness, borderStyle: 'solid', margin: `${marginY}px 0` }}
    />
  );
};

Divider.craft = { displayName: 'Divider', props: { color: '#e5e7eb', thickness: 1, marginY: 16 } };
