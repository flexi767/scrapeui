'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface RelatedListingsProps {
  count?: 3 | 4 | 6;
  cardStyle?: 'card' | 'minimal';
}

export const RelatedListings: UserComponent<RelatedListingsProps> = ({
  count = 3,
  cardStyle = 'card',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }} style={{ padding: '16px 0' }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Similar Cars</h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 12 }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ borderRadius: cardStyle === 'card' ? 8 : 0, border: cardStyle === 'card' ? '1px solid #e2e8f0' : 'none', overflow: 'hidden' }}>
            <div style={{ height: 100, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>📷</div>
            <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>Similar Car {i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

RelatedListings.craft = { displayName: 'Related Listings', props: { count: 3, cardStyle: 'card' } };
