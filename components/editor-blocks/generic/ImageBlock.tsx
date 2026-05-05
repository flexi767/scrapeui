'use client';
import { useNode, type UserComponent } from '@craftjs/core';
import { ImageWithFallback } from '@/components/ImageWithFallback';

interface ImageBlockProps {
  src?: string;
  alt?: string;
  width?: string;
  alignment?: 'left' | 'center' | 'right';
  linkHref?: string;
}

export const ImageBlock: UserComponent<ImageBlockProps> = ({
  src = 'https://placehold.co/400x200',
  alt = '',
  width = '100%',
  alignment = 'left',
  linkHref,
}) => {
  const { connectors: { connect, drag } } = useNode();
  const img = (
    <ImageWithFallback
      src={src}
      alt={alt}
      fallbackLabel="No image"
      style={{ width, display: 'block' }}
    />
  );
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{ textAlign: alignment }}
    >
      {linkHref ? <a href={linkHref}>{img}</a> : img}
    </div>
  );
};

ImageBlock.craft = {
  displayName: 'Image',
  props: { src: 'https://placehold.co/400x200', alt: '', width: '100%', alignment: 'left' },
};
