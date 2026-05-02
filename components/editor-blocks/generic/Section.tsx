'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface SectionProps {
  backgroundColor?: string;
  padding?: number;
  maxWidth?: number;
  children?: React.ReactNode;
}

export const Section: UserComponent<SectionProps> = ({
  backgroundColor = '#ffffff',
  padding = 24,
  maxWidth = 1200,
  children,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{
        backgroundColor,
        padding,
        maxWidth,
        margin: '0 auto',
        width: '100%',
        minHeight: 48,
      }}
    >
      {children}
    </div>
  );
};

Section.craft = {
  displayName: 'Section',
  props: { backgroundColor: '#ffffff', padding: 24, maxWidth: 1200 },
  rules: { canDrop: () => true },
};
