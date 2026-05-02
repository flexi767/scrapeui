'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface SpecsTableProps {
  showMileage?: boolean;
  showFuel?: boolean;
  showPower?: boolean;
  showTransmission?: boolean;
  showYear?: boolean;
  layout?: 'table' | 'cards';
}

const PLACEHOLDER_SPECS = [
  { key: 'mileage', label: 'Mileage', value: '95 000 km' },
  { key: 'fuel', label: 'Fuel', value: 'Diesel' },
  { key: 'power', label: 'Power', value: '140 kW' },
  { key: 'transmission', label: 'Transmission', value: 'Automatic' },
  { key: 'year', label: 'Year', value: '2020' },
];

export const SpecsTable: UserComponent<SpecsTableProps> = ({
  showMileage = true,
  showFuel = true,
  showPower = true,
  showTransmission = true,
  showYear = true,
  layout = 'table',
}) => {
  const { connectors: { connect, drag } } = useNode();
  const visMap: Record<string, boolean> = { mileage: showMileage, fuel: showFuel, power: showPower, transmission: showTransmission, year: showYear };
  const visible = PLACEHOLDER_SPECS.filter((s) => visMap[s.key]);

  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }} style={{ padding: '8px 0' }}>
      {layout === 'table' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {visible.map((s) => (
              <tr key={s.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 0', color: '#64748b', width: '40%' }}>{s.label}</td>
                <td style={{ padding: '8px 0', fontWeight: 600 }}>{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {visible.map((s) => (
            <div key={s.key} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

SpecsTable.craft = {
  displayName: 'Specs Table',
  props: { showMileage: true, showFuel: true, showPower: true, showTransmission: true, showYear: true, layout: 'table' },
};
