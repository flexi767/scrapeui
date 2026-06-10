import React from "react";
import { logger } from "@/lib/logger";
import type { PublicDealer, PublicListing, PublicListingDetail, PublicListingFilters } from "./query-modules/public";
import { formatListingMileage, formatListingPrice } from "./listing-format";
import { renderFilterBar } from "./template-renderers/filter-bar";
import { renderImageGallery } from "./template-renderers/image-gallery";
import { renderListingGridCard, renderRelatedListingCard } from "./template-renderers/listing-cards";

const log = logger.child("template");

// ── Types ─────────────────────────────────────────────────────────────────

export interface RenderData {
  dealer: PublicDealer;
  listings?: PublicListing[];
  listing?: PublicListingDetail;
  relatedListings?: PublicListing[];
  total?: number;
  page?: number;
  limit?: number;
  nextCursor?: string | null;
  makes?: string[];
  filters?: PublicListingFilters;
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

  FilterBar: renderFilterBar,

  ListingGridBlock: ({ columns, cardStyle, gap, showPrice, showMileage, showYear, showFuel }, data) => {
    const listings = data.listings ?? [];
    return React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: `repeat(${columns ?? 3}, 1fr)`, gap: gap ?? 16, padding: 16 },
    },
      listings.map((listing: PublicListing) => renderListingGridCard(listing, {
        cardStyle,
        showPrice,
        showMileage,
        showYear,
        showFuel,
      }))
    );
  },

  Pagination: ({ style: pStyle, color }, data) => {
    const totalPages = Math.ceil((data.total ?? 0) / (data.limit ?? 24));
    const current = data.page ?? 1;
    const nextHref = data.nextCursor ? `?cursor=${encodeURIComponent(data.nextCursor)}` : `?page=${current + 1}`;
    const hasCursor = Boolean(data.filters?.cursor);
    const hasNext = Boolean(data.nextCursor) || current < totalPages;
    if (totalPages <= 1 && !data.nextCursor) return React.createElement(React.Fragment, null);

    if (hasCursor) {
      return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 8, padding: 16 } },
        React.createElement('a', { key: 'first', href: '?page=1', style: { padding: '6px 16px', border: `1px solid ${color ?? '#2563eb'}`, borderRadius: 6, color: color ?? '#2563eb', textDecoration: 'none', fontSize: 13 } }, '← First'),
        data.nextCursor ? React.createElement('a', { key: 'next', href: nextHref, style: { padding: '6px 16px', background: color ?? '#2563eb', borderRadius: 6, color: '#fff', textDecoration: 'none', fontSize: 13 } }, 'Next →') : null,
      );
    }

    const startPage = Math.max(1, Math.min(current - 3, totalPages - 6));
    const visiblePages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => startPage + i);
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 8, padding: 16 } },
      pStyle === 'prev-next'
        ? [
            current > 1 ? React.createElement('a', { key: 'prev', href: `?page=${current - 1}`, style: { padding: '6px 16px', border: `1px solid ${color ?? '#2563eb'}`, borderRadius: 6, color: color ?? '#2563eb', textDecoration: 'none', fontSize: 13 } }, '← Previous') : null,
            hasNext ? React.createElement('a', { key: 'next', href: nextHref, style: { padding: '6px 16px', background: color ?? '#2563eb', borderRadius: 6, color: '#fff', textDecoration: 'none', fontSize: 13 } }, 'Next →') : null,
          ]
        : visiblePages.map((n) =>
            React.createElement('a', { key: n, href: `?page=${n}`, style: { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: n === current ? (color ?? '#2563eb') : '#f1f5f9', color: n === current ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, textDecoration: 'none' } }, n)
          )
    );
  },

  FooterBlock: ({ backgroundColor, fontColor, showAddress, showPhone, showEmail }, data) => {
    const contactLine = data.dealer.publicDomain ?? (data.dealer.mobileUrl ? new URL(data.dealer.mobileUrl).hostname : null);
    const detailItems: React.ReactElement[] = [];
    if (showAddress !== false && contactLine) detailItems.push(React.createElement('span', { key: 'addr' }, `📍 ${contactLine}`));
    if (showPhone !== false && data.dealer.mobileUrl) detailItems.push(React.createElement('a', { key: 'phone', href: data.dealer.mobileUrl, target: '_blank', rel: 'noopener noreferrer', style: { color: 'inherit', textDecoration: 'none', opacity: 0.7 } }, '📞 View on Mobile.bg'));
    if (showEmail !== false && data.dealer.mobileUrl) detailItems.push(React.createElement('a', { key: 'email', href: data.dealer.mobileUrl, target: '_blank', rel: 'noopener noreferrer', style: { color: 'inherit', textDecoration: 'none', opacity: 0.7 } }, '✉️ Contact'));
    return React.createElement('footer', {
      style: { backgroundColor: backgroundColor ?? '#1e293b', color: fontColor ?? '#cbd5e1', padding: '24px 32px', display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 13 },
    },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 16 } }, data.dealer.name),
      detailItems.length > 0
        ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.7, fontSize: 12 } }, ...detailItems)
        : null,
    );
  },

  ImageGallery: renderImageGallery,

  PriceTag: ({ showVat, fontSize, color }, data) => {
    const price = data.listing?.currentPrice;
    if (!price) return React.createElement('div', null);
    return React.createElement('div', { style: { padding: '12px 0' } },
      React.createElement('div', { style: { fontSize: fontSize ?? 32, fontWeight: 700, color: color ?? '#1e293b' } }, formatListingPrice(price)),
      showVat !== false ? React.createElement('div', { style: { fontSize: 12, color: '#64748b', marginTop: 2 } }, 'incl. VAT') : null,
    );
  },

  SpecsTable: ({ showMileage, showFuel, showPower, showTransmission, showYear, layout }, data) => {
    const l = data.listing;
    if (!l) return React.createElement('div', null);
    const specs = [
      showMileage !== false && l.mileage ? { label: 'Mileage', value: formatListingMileage(l.mileage) } : null,
      showFuel !== false && l.fuel ? { label: 'Fuel', value: l.fuel } : null,
      showPower !== false && l.power ? { label: 'Power', value: `${l.power} kW` } : null,
      showTransmission !== false && l.transmission ? { label: 'Transmission', value: l.transmission } : null,
      showYear !== false && l.regYear ? { label: 'Year', value: l.regYear } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    if (layout === 'cards') {
      return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '8px 0' } },
        specs.map((s) =>
          React.createElement('div', { key: s.label, style: { background: '#f8fafc', borderRadius: 8, padding: 12, textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: 12, color: '#64748b' } }, s.label),
            React.createElement('div', { style: { fontWeight: 700, fontSize: 16, marginTop: 4 } }, s.value),
          )
        )
      );
    }

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

  CTASection: ({ showPhone, showEmail, showWhatsapp, buttonColor, layout }, data) => {
    const dealerUrl = data.dealer.mobileUrl ?? '#';
    const bc = buttonColor ?? '#2563eb';
    return React.createElement('div', {
      style: { display: 'flex', flexDirection: layout === 'column' ? 'column' : 'row', gap: 12, padding: '16px 0', flexWrap: 'wrap' },
    },
      showPhone !== false
        ? React.createElement('a', { key: 'phone', href: dealerUrl, target: '_blank', rel: 'noopener noreferrer', style: { padding: '12px 24px', background: bc, color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, '📞 Call Dealer')
        : null,
      showEmail !== false
        ? React.createElement('a', { key: 'email', href: dealerUrl, target: '_blank', rel: 'noopener noreferrer', style: { padding: '12px 24px', border: `2px solid ${bc}`, color: bc, borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, '✉️ Contact')
        : null,
      showWhatsapp !== false
        ? React.createElement('a', { key: 'wa', href: dealerUrl, target: '_blank', rel: 'noopener noreferrer', style: { padding: '12px 24px', background: '#25d366', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, '💬 WhatsApp')
        : null,
    );
  },

  RelatedListings: ({ count, cardStyle }, data) => {
    const related = (data.relatedListings ?? []).slice(0, (count as number) ?? 3);
    const bordered = cardStyle !== 'minimal';
    return React.createElement('div', { style: { padding: '16px 0' } },
      React.createElement('h3', { style: { fontSize: 18, fontWeight: 600, marginBottom: 12 } }, 'Similar Cars'),
      related.length === 0
        ? null
        : React.createElement('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${Math.min(related.length, 3)}, 1fr)`, gap: 12 } },
            ...related.map((listing: PublicListing) => renderRelatedListingCard(listing, bordered)),
          ),
    );
  },
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
    log.warn(`No renderer for block type: ${typeName}`);
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
