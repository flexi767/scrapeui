'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface SpacerProps { height?: number }

export const Spacer: UserComponent<SpacerProps> = ({ height = 32 }) => {
  const { connectors: { connect, drag } } = useNode();
  return <div ref={(ref) => { if (ref) connect(drag(ref)); }} style={{ height }} />;
};

Spacer.craft = { displayName: 'Spacer', props: { height: 32 } };
