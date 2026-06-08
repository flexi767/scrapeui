import { ImageWithFallback } from '@/components/ImageWithFallback';

interface ScrapeThumbnailProps {
  src?: string | null;
  href?: string | null;
}

export function ScrapeThumbnail({ src, href }: ScrapeThumbnailProps) {
  if (!src) {
    return <div className="h-[45px] w-[60px] flex-shrink-0 rounded bg-gray-800" />;
  }

  const image = (
    <ImageWithFallback
      src={src}
      alt=""
      className="h-[45px] w-[60px] rounded bg-gray-800 object-cover hover:opacity-80"
      fallbackLabel=""
      style={{ aspectRatio: '4/3' }}
    />
  );

  if (!href) {
    return <div className="flex-shrink-0">{image}</div>;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
      {image}
    </a>
  );
}
