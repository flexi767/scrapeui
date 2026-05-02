'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface PaginationProps {
  style?: 'numbered' | 'prev-next' | 'load-more';
  color?: string;
}

export const Pagination: UserComponent<PaginationProps> = ({
  style: pStyle = 'numbered',
  color = '#2563eb',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}
    >
      {pStyle === 'numbered' && [1, 2, 3, 4, 5].map((n) => (
        <div key={n} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: n === 1 ? color : '#f1f5f9', color: n === 1 ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{n}</div>
      ))}
      {pStyle === 'prev-next' && (
        <>
          <div style={{ padding: '6px 16px', border: `1px solid ${color}`, borderRadius: 6, color, cursor: 'pointer', fontSize: 13 }}>← Previous</div>
          <div style={{ padding: '6px 16px', background: color, borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}>Next →</div>
        </>
      )}
      {pStyle === 'load-more' && (
        <div style={{ padding: '10px 32px', background: color, borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Load More</div>
      )}
    </div>
  );
};

Pagination.craft = { displayName: 'Pagination', props: { style: 'numbered', color: '#2563eb' } };
