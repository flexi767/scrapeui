import React from "react";
import type { PublicDealer, PublicListing, PublicListingDetail } from "./query-modules/public";

// ── Types ─────────────────────────────────────────────────────────────────

export interface RenderData {
  dealer: PublicDealer;
  listings?: PublicListing[];
  listing?: PublicListingDetail;
  total?: number;
  page?: number;
  limit?: number;
  makes?: string[];
}

interface CraftNode {
  type: { resolvedName: string };
  props: Record<string, unknown>;
  nodes: string[];
  linkedNodes: Record<string, string>;
  isCanvas?: boolean;
  hidden?: boolean;
}

type CraftState = Record<string, CraftNode>;

// ── Block renderer registry ───────────────────────────────────────────────
// Server-side renderers: receive props + live data, return React elements.
// No Craft.js dependency.

type BlockRenderer = (props: Record<string, unknown>, data: RenderData, children: React.ReactNode) => React.ReactElement;

const BLOCK_RENDERER_REGISTRY: Record<string, BlockRenderer> = {
  Section: ({ backgroundColor, padding, maxWidth }, _data, children) =>
    React.createElement('div', {
      style: { backgroundColor: backgroundColor ?? '#fff', padding: padding ?? 24, maxWidth: maxWidth ?? 1200, margin: '0 auto', width: '100%' },
    }, children),

  Text: ({ content, fontSize, color, fontWeight, textAlign, as: tag }) =>
    React.createElement(String(tag ?? 'p'), {
      style: { fontSize: fontSize ?? 16, color: color ?? '#1a1a1a', fontWeight: fontWeight ?? 'normal', textAlign: textAlign ?? 'left', margin: 0 },
    }, String(content ?? '')),

  ImageBlock: ({ src, alt, width, alignment, linkHref }) => {
    const img = React.createElement('img', { src: String(src ?? ''), alt: String(alt ?? ''), style: { width: String(width ?? '100%'), display: 'block' } });
    return React.createElement('div', { style: { textAlign: String(alignment ?? 'left') } },
      linkHref ? React.createElement('a', { href: String(linkHref) }, img) : img
    );
  },

  ButtonBlock: ({ label, href, backgroundColor, color, size }) => {
    const SIZES: Record<string, string> = { sm: '8px 16px', md: '12px 24px', lg: '16px 32px' };
    return React.createElement('a', {
      href: String(href ?? '#'),
      style: { display: 'inline-block', backgroundColor: backgroundColor ?? '#2563eb', color: color ?? '#fff', padding: SIZES[String(size ?? 'md')] ?? '12px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 },
    }, String(label ?? 'Click here'));
  },

  Divider: ({ color, thickness, marginY }) =>
    React.createElement('hr', {
      style: { borderColor: color ?? '#e5e7eb', borderWidth: thickness ?? 1, borderStyle: 'solid', margin: `${marginY ?? 16}px 0` },
    }),

  Spacer: ({ height }) => React.createElement('div', { style: { height: height ?? 32 } }),

  HeroBanner: ({ backgroundColor, height, showLogo, tagline, fontColor }, data) =>
    React.createElement('div', {
      style: { backgroundColor: backgroundColor ?? '#1e293b', height: height ?? 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: fontColor ?? '#fff' },
    },
      showLogo !== false ? React.createElement('div', { style: { fontSize: 24, fontWeight: 700 } }, data.dealer.name) : null,
      tagline ? React.createElement('div', { style: { fontSize: 14, opacity: 0.8 } }, String(tagline)) : null,
    ),

  FilterBar: ({ backgroundColor, layout }) =>
    React.createElement('form', {
      style: { backgroundColor: backgroundColor ?? '#f8fafc', padding: '12px 16px', display: 'flex', flexDirection: layout === 'vertical' ? 'column' : 'row', gap: 8, flexWrap: 'wrap' },
    },
      React.createElement('select', { name: 'make', style: { padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 } },
        React.createElement('option', { value: '' }, 'Any Make')
      ),
      React.createElement('input', { type: 'submit', value: 'Filter', style: { padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' } }),
    ),

  ListingGridBlock: ({ columns, cardStyle, gap, showPrice, showMileage, showYear, showFuel }, data) => {
    const listings = data.listings ?? [];
    return React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: `repeat(${columns ?? 3}, 1fr)`, gap: gap ?? 16, padding: 16 },
    },
      listings.map((l) =>
        React.createElement('a', {
          key: l.mobileId,
          href: `${l.mobileId}`,
          style: { borderRadius: cardStyle === 'card' ? 8 : 0, border: cardStyle === 'card' ? '1px solid #e2e8f0' : 'none', overflow: 'hidden', background: '#fff', display: 'block', textDecoration: 'none', color: 'inherit' },
        },
          React.createElement('div', { style: { height: 160, background: '#e2e8f0', overflow: 'hidden', position: 'relative' } }),
          React.createElement('div', { style: { padding: '8px 12px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: 14, marginBottom: 4 } }, `${l.make ?? ''} ${l.model ?? ''} ${l.regYear ?? ''}`),
            React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' } },
              showPrice !== false && l.currentPrice ? React.createElement('span', { key: 'price' }, `€${l.currentPrice.toLocaleString()}`) : null,
              showYear !== false && l.regYear ? React.createElement('span', { key: 'year' }, l.regYear) : null,
              showMileage !== false && l.mileage ? React.createElement('span', { key: 'km' }, `${l.mileage.toLocaleString()} km`) : null,
              showFuel !== false && l.fuel ? React.createElement('span', { key: 'fuel' }, l.fuel) : null,
            ),
          ),
        )
      )
    );
  },

  Pagination: ({ style: pStyle, color }, data) => {
    const totalPages = Math.ceil((data.total ?? 0) / (data.limit ?? 24));
    const current = data.page ?? 1;
    if (totalPages <= 1) return React.createElement(React.Fragment, null);
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 8, padding: 16 } },
      pStyle === 'prev-next'
        ? [
            current > 1 ? React.createElement('a', { key: 'prev', href: `?page=${current - 1}`, style: { padding: '6px 16px', border: `1px solid ${color ?? '#2563eb'}`, borderRadius: 6, color: color ?? '#2563eb', textDecoration: 'none', fontSize: 13 } }, '← Previous') : null,
            current < totalPages ? React.createElement('a', { key: 'next', href: `?page=${current + 1}`, style: { padding: '6px 16px', background: color ?? '#2563eb', borderRadius: 6, color: '#fff', textDecoration: 'none', fontSize: 13 } }, 'Next →') : null,
          ]
        : Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
            React.createElement('a', { key: n, href: `?page=${n}`, style: { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: n === current ? (color ?? '#2563eb') : '#f1f5f9', color: n === current ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, textDecoration: 'none' } }, n)
          )
    );
  },

  FooterBlock: ({ backgroundColor, fontColor, showAddress }, data) =>
    React.createElement('footer', {
      style: { backgroundColor: backgroundColor ?? '#1e293b', color: fontColor ?? '#cbd5e1', padding: '24px 32px', fontSize: 13 },
    },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 16, marginBottom: 8 } }, data.dealer.name),
      showAddress !== false ? React.createElement('div', null, '📍 Address on file') : null,
    ),

  ImageGallery: ({ maxHeight }, data) => {
    const listing = data.listing;
    if (!listing) return React.createElement('div', null);
    return React.createElement('div', { style: { background: '#e2e8f0', height: maxHeight ?? 400, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8' } },
      `${listing.imageCount ?? 0} photos`
    );
  },

  PriceTag: ({ showVat, fontSize, color }, data) => {
    const price = data.listing?.currentPrice;
    if (!price) return React.createElement('div', null);
    return React.createElement('div', { style: { padding: '12px 0' } },
      React.createElement('div', { style: { fontSize: fontSize ?? 32, fontWeight: 700, color: color ?? '#1e293b' } }, `€${price.toLocaleString()}`),
      showVat !== false ? React.createElement('div', { style: { fontSize: 12, color: '#64748b', marginTop: 2 } }, 'incl. VAT') : null,
    );
  },

  SpecsTable: ({ showMileage, showFuel, showPower, showTransmission, showYear }, data) => {
    const l = data.listing;
    if (!l) return React.createElement('div', null);
    const specs = [
      showMileage !== false && l.mileage ? { label: 'Mileage', value: `${l.mileage.toLocaleString()} km` } : null,
      showFuel !== false && l.fuel ? { label: 'Fuel', value: l.fuel } : null,
      showPower !== false && l.power ? { label: 'Power', value: `${l.power} kW` } : null,
      showTransmission !== false && l.transmission ? { label: 'Transmission', value: l.transmission } : null,
      showYear !== false && l.regYear ? { label: 'Year', value: l.regYear } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    return React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 14 } },
      React.createElement('tbody', null,
        specs.map((s) =>
          React.createElement('tr', { key: s.label, style: { borderBottom: '1px solid #e2e8f0' } },
            React.createElement('td', { style: { padding: '8px 0', color: '#64748b', width: '40%' } }, s.label),
            React.createElement('td', { style: { padding: '8px 0', fontWeight: 600 } }, s.value),
          )
        )
      )
    );
  },

  Description: ({ fontSize, color, maxHeight, truncate }, data) => {
    const text = data.listing?.description ?? '';
    return React.createElement('div', {
      style: { fontSize: fontSize ?? 15, color: color ?? '#334155', lineHeight: 1.6, maxHeight: truncate !== false ? (maxHeight ?? 200) : undefined, overflow: truncate !== false ? 'hidden' : undefined, padding: '8px 0' },
    }, text);
  },

  CTASection: ({ showPhone, showEmail, showWhatsapp, buttonColor, layout }) =>
    React.createElement('div', {
      style: { display: 'flex', flexDirection: layout === 'column' ? 'column' : 'row', gap: 12, padding: '16px 0', flexWrap: 'wrap' },
    },
      showPhone !== false ? React.createElement('a', { key: 'phone', href: 'tel:', style: { padding: '12px 24px', background: buttonColor ?? '#2563eb', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, '📞 Call') : null,
      showEmail !== false ? React.createElement('a', { key: 'email', href: 'mailto:', style: { padding: '12px 24px', border: `2px solid ${buttonColor ?? '#2563eb'}`, color: buttonColor ?? '#2563eb', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, '✉️ Email') : null,
      showWhatsapp !== false ? React.createElement('a', { key: 'wa', href: 'https://wa.me/', style: { padding: '12px 24px', background: '#25d366', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, 'WhatsApp') : null,
    ),

  RelatedListings: () =>
    React.createElement('div', { style: { padding: '16px 0' } },
      React.createElement('h3', { style: { fontSize: 18, fontWeight: 600, marginBottom: 12 } }, 'Similar Cars'),
    ),
};

// ── Recursive renderer ────────────────────────────────────────────────────

export function renderCraftNode(
  nodeId: string,
  state: CraftState,
  data: RenderData,
): React.ReactElement | null {
  const node = state[nodeId];
  if (!node || node.hidden) return null;

  const children = node.nodes
    .map((childId) => renderCraftNode(childId, state, data))
    .filter(Boolean) as React.ReactElement[];

  const typeName = node.type.resolvedName;
  const renderer = BLOCK_RENDERER_REGISTRY[typeName];

  if (!renderer) {
    console.warn(`No renderer for block type: ${typeName}`);
    return children.length > 0 ? React.createElement(React.Fragment, null, ...children) : null;
  }

  return renderer(node.props, data, children.length > 0 ? React.createElement(React.Fragment, null, ...children) : null);
}

export function renderCraftPage(
  configJson: string,
  pageType: 'listingGrid' | 'listingDetail',
  data: RenderData,
): React.ReactElement {
  const parsed = JSON.parse(configJson) as Record<string, CraftState>;
  const pageState = parsed[pageType];
  if (!pageState) return React.createElement('div', null, 'No template configured');
  return renderCraftNode('ROOT', pageState, data) ?? React.createElement('div', null);
}
