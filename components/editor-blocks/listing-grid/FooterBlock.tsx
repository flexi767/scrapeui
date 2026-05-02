'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface FooterBlockProps {
  backgroundColor?: string;
  fontColor?: string;
  showAddress?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
}

export const FooterBlock: UserComponent<FooterBlockProps> = ({
  backgroundColor = '#1e293b',
  fontColor = '#cbd5e1',
  showAddress = true,
  showPhone = true,
  showEmail = true,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <footer
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{ backgroundColor, color: fontColor, padding: '24px 32px', display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 13 }}
    >
      <div style={{ fontWeight: 600, fontSize: 16 }}>Dealer Name</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {showAddress && <span>📍 123 Main Street, City</span>}
        {showPhone && <span>📞 +1 234 567 890</span>}
        {showEmail && <span>✉️ dealer@example.com</span>}
      </div>
    </footer>
  );
};

FooterBlock.craft = {
  displayName: 'Footer',
  props: { backgroundColor: '#1e293b', fontColor: '#cbd5e1', showAddress: true, showPhone: true, showEmail: true },
};
