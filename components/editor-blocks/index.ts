// Generic blocks
import { Section } from './generic/Section';
import { Text } from './generic/Text';
import { ImageBlock } from './generic/ImageBlock';
import { ButtonBlock } from './generic/ButtonBlock';
import { Divider } from './generic/Divider';
import { Spacer } from './generic/Spacer';

// Listing Grid page blocks
import { HeroBanner } from './listing-grid/HeroBanner';
import { FilterBar } from './listing-grid/FilterBar';
import { ListingGridBlock } from './listing-grid/ListingGridBlock';
import { Pagination } from './listing-grid/Pagination';
import { FooterBlock } from './listing-grid/FooterBlock';

// Listing Detail page blocks
import { ImageGallery } from './listing-detail/ImageGallery';
import { PriceTag } from './listing-detail/PriceTag';
import { SpecsTable } from './listing-detail/SpecsTable';
import { Description } from './listing-detail/Description';
import { CTASection } from './listing-detail/CTASection';
import { RelatedListings } from './listing-detail/RelatedListings';

export {
  Section, Text, ImageBlock, ButtonBlock, Divider, Spacer,
  HeroBanner, FilterBar, ListingGridBlock, Pagination, FooterBlock,
  ImageGallery, PriceTag, SpecsTable, Description, CTASection, RelatedListings,
};

// Resolver map for Craft.js Editor
export const BLOCK_RESOLVER = {
  Section,
  Text,
  ImageBlock,
  ButtonBlock,
  Divider,
  Spacer,
  HeroBanner,
  FilterBar,
  ListingGridBlock,
  Pagination,
  FooterBlock,
  ImageGallery,
  PriceTag,
  SpecsTable,
  Description,
  CTASection,
  RelatedListings,
} as const;

// Metadata for the block palette (left icon strip)
export const BLOCK_PALETTE = {
  listingGrid: [
    { name: 'HeroBanner', label: 'Hero Banner', icon: '🖼' },
    { name: 'FilterBar', label: 'Filter Bar', icon: '🔍' },
    { name: 'ListingGridBlock', label: 'Listing Grid', icon: '⊞' },
    { name: 'Pagination', label: 'Pagination', icon: '⟨⟩' },
    { name: 'FooterBlock', label: 'Footer', icon: '📄' },
  ],
  listingDetail: [
    { name: 'ImageGallery', label: 'Image Gallery', icon: '🖼' },
    { name: 'PriceTag', label: 'Price Tag', icon: '💰' },
    { name: 'SpecsTable', label: 'Specs Table', icon: '📊' },
    { name: 'Description', label: 'Description', icon: '📝' },
    { name: 'CTASection', label: 'CTA Section', icon: '📞' },
    { name: 'RelatedListings', label: 'Related', icon: '🔗' },
  ],
  generic: [
    { name: 'Section', label: 'Section', icon: '📦' },
    { name: 'Text', label: 'Text', icon: 'T' },
    { name: 'ImageBlock', label: 'Image', icon: '🖼' },
    { name: 'ButtonBlock', label: 'Button', icon: '🔘' },
    { name: 'Divider', label: 'Divider', icon: '—' },
    { name: 'Spacer', label: 'Spacer', icon: '↕' },
  ],
} as const;
