'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface TextProps {
  content?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  as?: 'h1' | 'h2' | 'h3' | 'p';
}

export const Text: UserComponent<TextProps> = ({
  content = 'Text',
  fontSize = 16,
  color = '#1a1a1a',
  fontWeight = 'normal',
  textAlign = 'left',
  as: Tag = 'p',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <Tag
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{ fontSize, color, fontWeight, textAlign, margin: 0 }}
    >
      {content}
    </Tag>
  );
};

Text.craft = {
  displayName: 'Text',
  props: { content: 'Text block', fontSize: 16, color: '#1a1a1a', fontWeight: 'normal', textAlign: 'left', as: 'p' },
};
