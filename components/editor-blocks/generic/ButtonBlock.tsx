'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface ButtonBlockProps {
  label?: string;
  href?: string;
  backgroundColor?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: '8px 16px', md: '12px 24px', lg: '16px 32px' };

export const ButtonBlock: UserComponent<ButtonBlockProps> = ({
  label = 'Click here',
  href = '#',
  backgroundColor = '#2563eb',
  color = '#ffffff',
  size = 'md',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <a
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor,
        color,
        padding: SIZES[size],
        borderRadius: 6,
        textDecoration: 'none',
        fontWeight: 600,
      }}
    >
      {label}
    </a>
  );
};

ButtonBlock.craft = {
  displayName: 'Button',
  props: { label: 'Click here', href: '#', backgroundColor: '#2563eb', color: '#ffffff', size: 'md' },
};
