'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface ListingGridBlockProps {
  columns?: 2 | 3 | 4;
  cardStyle?: 'card' | 'minimal';
  gap?: number;
  showPrice?: boolean;
  showMileage?: boolean;
  showYear?: boolean;
  showFuel?: boolean;
}

const PLACEHOLDER_CARDS = Array.from({ length: 6 }, (_, i) => i);

export const ListingGridBlock: UserComponent<ListingGridBlockProps> = ({
  columns = 3,
  cardStyle = 'card',
  gap = 16,
  showPrice = true,
  showMileage = true,
  showYear = true,
  showFuel = true,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        padding: 16,
      }}
    >
      {PLACEHOLDER_CARDS.map((i) => (
        <div
          key={i}
          style={{
            borderRadius: cardStyle === 'card' ? 8 : 0,
            border: cardStyle === 'card' ? '1px solid #e2e8f0' : 'none',
            overflow: 'hidden',
            background: cardStyle === 'card' ? '#fff' : 'transparent',
          }}
        >
          <div style={{ height: 140, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
            📷 Photo
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Make Model Year</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
              {showPrice && <span>€12 500</span>}
              {showYear && <span>2020</span>}
              {showMileage && <span>95 000 km</span>}
              {showFuel && <span>Diesel</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

ListingGridBlock.craft = {
  displayName: 'Listing Grid',
  props: { columns: 3, cardStyle: 'card', gap: 16, showPrice: true, showMileage: true, showYear: true, showFuel: true },
};
