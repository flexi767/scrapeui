'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface DescriptionProps {
  fontSize?: number;
  color?: string;
  maxHeight?: number;
  truncate?: boolean;
}

export const Description: UserComponent<DescriptionProps> = ({
  fontSize = 15,
  color = '#334155',
  maxHeight = 200,
  truncate = true,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{
        fontSize,
        color,
        lineHeight: 1.6,
        maxHeight: truncate ? maxHeight : undefined,
        overflow: truncate ? 'hidden' : undefined,
        position: 'relative',
        padding: '8px 0',
      }}
    >
      <p style={{ margin: 0 }}>
        This is a placeholder listing description. The actual description text will be loaded from the listing data when the public page is rendered. Dealers can configure font size, color, and whether the text is truncated with a &ldquo;Read more&rdquo; button.
      </p>
      {truncate && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, white)', display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ color: '#2563eb', fontSize: 13, fontWeight: 600 }}>Read more ↓</span>
        </div>
      )}
    </div>
  );
};

Description.craft = { displayName: 'Description', props: { fontSize: 15, color: '#334155', maxHeight: 200, truncate: true } };
