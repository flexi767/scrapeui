'use client';
import { useNode, type UserComponent } from '@craftjs/core';

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
  const img = <img src={src} alt={alt} style={{ width, display: 'block' }} />;
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
