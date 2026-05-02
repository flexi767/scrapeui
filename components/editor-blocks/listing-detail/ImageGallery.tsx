'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface ImageGalleryProps {
  layout?: 'slider' | 'grid' | 'filmstrip';
  maxHeight?: number;
}

export const ImageGallery: UserComponent<ImageGalleryProps> = ({
  layout = 'slider',
  maxHeight = 400,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }} style={{ width: '100%' }}>
      {layout === 'slider' && (
        <div style={{ height: maxHeight, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8', gap: 16 }}>
          <span style={{ fontSize: 20, cursor: 'pointer' }}>‹</span>
          📷 Main Photo
          <span style={{ fontSize: 20, cursor: 'pointer' }}>›</span>
        </div>
      )}
      {layout === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 120, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>📷</div>
          ))}
        </div>
      )}
      {layout === 'filmstrip' && (
        <div>
          <div style={{ height: maxHeight * 0.75, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8' }}>📷 Main Photo</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, height: 60, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}>📷</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

ImageGallery.craft = { displayName: 'Image Gallery', props: { layout: 'slider', maxHeight: 400 } };
