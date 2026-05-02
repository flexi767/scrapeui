'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface FilterBarProps {
  showMake?: boolean;
  showModel?: boolean;
  showPrice?: boolean;
  showYear?: boolean;
  showFuel?: boolean;
  layout?: 'horizontal' | 'vertical';
  backgroundColor?: string;
}

export const FilterBar: UserComponent<FilterBarProps> = ({
  showMake = true,
  showModel = true,
  showPrice = true,
  showYear = true,
  showFuel = true,
  layout = 'horizontal',
  backgroundColor = '#f8fafc',
}) => {
  const { connectors: { connect, drag } } = useNode();
  const filters = [
    showMake && 'Make',
    showModel && 'Model',
    showPrice && 'Price',
    showYear && 'Year',
    showFuel && 'Fuel',
  ].filter(Boolean) as string[];

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{
        backgroundColor,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {filters.map((f) => (
        <div
          key={f}
          style={{
            background: '#e2e8f0',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            color: '#475569',
          }}
        >
          {f} ▾
        </div>
      ))}
    </div>
  );
};

FilterBar.craft = {
  displayName: 'Filter Bar',
  props: { showMake: true, showModel: true, showPrice: true, showYear: true, showFuel: true, layout: 'horizontal', backgroundColor: '#f8fafc' },
};
