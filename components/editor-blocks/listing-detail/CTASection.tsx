'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface CTASectionProps {
  showPhone?: boolean;
  showEmail?: boolean;
  showWhatsapp?: boolean;
  buttonColor?: string;
  layout?: 'row' | 'column';
}

export const CTASection: UserComponent<CTASectionProps> = ({
  showPhone = true,
  showEmail = true,
  showWhatsapp = true,
  buttonColor = '#2563eb',
  layout = 'row',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{ display: 'flex', flexDirection: layout === 'column' ? 'column' : 'row', gap: 12, padding: '16px 0', flexWrap: 'wrap' }}
    >
      {showPhone && (
        <div style={{ padding: '12px 24px', background: buttonColor, color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>📞 Call</div>
      )}
      {showEmail && (
        <div style={{ padding: '12px 24px', background: '#fff', color: buttonColor, border: `2px solid ${buttonColor}`, borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>✉️ Email</div>
      )}
      {showWhatsapp && (
        <div style={{ padding: '12px 24px', background: '#25d366', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>WhatsApp</div>
      )}
    </div>
  );
};

CTASection.craft = {
  displayName: 'CTA Section',
  props: { showPhone: true, showEmail: true, showWhatsapp: true, buttonColor: '#2563eb', layout: 'row' },
};
