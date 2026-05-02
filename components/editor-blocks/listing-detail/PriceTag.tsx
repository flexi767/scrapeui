'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface PriceTagProps {
  showVat?: boolean;
  fontSize?: number;
  color?: string;
}

export const PriceTag: UserComponent<PriceTagProps> = ({
  showVat = true,
  fontSize = 32,
  color = '#1e293b',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }} style={{ padding: '12px 0' }}>
      <div style={{ fontSize, fontWeight: 700, color }}>€12 500</div>
      {showVat && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>incl. VAT (€10 504 excl.)</div>}
    </div>
  );
};

PriceTag.craft = { displayName: 'Price Tag', props: { showVat: true, fontSize: 32, color: '#1e293b' } };
