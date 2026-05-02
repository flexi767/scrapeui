'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface HeroBannerProps {
  backgroundColor?: string;
  height?: number;
  showLogo?: boolean;
  tagline?: string;
  fontColor?: string;
}

export const HeroBanner: UserComponent<HeroBannerProps> = ({
  backgroundColor = '#1e293b',
  height = 200,
  showLogo = true,
  tagline = 'Quality Cars',
  fontColor = '#ffffff',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{
        backgroundColor,
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: fontColor,
      }}
    >
      {showLogo && (
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          🚗
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 24 }}>Dealer Name</div>
      {tagline && <div style={{ fontSize: 14, opacity: 0.8 }}>{tagline}</div>}
    </div>
  );
};

HeroBanner.craft = {
  displayName: 'Hero Banner',
  props: { backgroundColor: '#1e293b', height: 200, showLogo: true, tagline: 'Quality Cars', fontColor: '#ffffff' },
};
