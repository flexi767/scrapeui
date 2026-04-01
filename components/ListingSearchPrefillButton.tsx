'use client';

import { useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SearchField {
  name: string;
  label: string;
  value: string;
  source: 'default' | 'listing' | 'derived';
}

interface SearchPrefillResponse {
  listing: {
    id: number;
    title: string | null;
    make: string | null;
    model: string | null;
    currentPrice: number | null;
  };
  form: {
    action: string;
    method: 'POST';
    fields: SearchField[];
    visibleFields: SearchField[];
  };
  reference: {
    makeCount: number | null;
    modelCount: number | null;
  };
  omitted: string[];
}

export default function ListingSearchPrefillButton({ listingId }: { listingId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SearchPrefillResponse | null>(null);

  async function load() {
    if (data || loading) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError('');
    setOpen(true);

    try {
      const res = await fetch(`/api/listings/search-prefill/${listingId}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to load search fields');
      }
      setData(payload as SearchPrefillResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load search fields');
    } finally {
      setLoading(false);
    }
  }

  function submitToMobileBg() {
    if (!data || typeof document === 'undefined') return;
    const form = document.createElement('form');
    form.method = data.form.method;
    form.action = data.form.action;
    form.target = '_blank';

    for (const field of data.form.fields) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = field.name;
      input.value = field.value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
        onClick={load}
        aria-label="Show prefilled mobile.bg search fields"
      >
        <SearchIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border border-gray-700 bg-gray-900 text-gray-100" showCloseButton>
          <DialogHeader>
            <DialogTitle>Prefilled Mobile.bg Search</DialogTitle>
            <DialogDescription className="text-gray-400">
              {data?.listing.title || 'Build a prefilled search from this listing.'}
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-4 py-8 text-center text-sm text-gray-400">
              Loading mobile.bg search fields…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {data && !loading && !error && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-4 py-3 text-sm">
                <div className="font-medium text-white">
                  {[data.listing.make, data.listing.model].filter(Boolean).join(' ') || 'Listing'}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {data.reference.makeCount != null ? `${data.reference.makeCount.toLocaleString('en-US')} listings for make` : 'No make count in reference data'}
                  {data.reference.modelCount != null ? ` • ${data.reference.modelCount.toLocaleString('en-US')} for model` : ''}
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-950/60">
                <div className="border-b border-gray-800 px-4 py-3 text-sm font-medium text-gray-200">
                  Search fields
                </div>
                <div className="max-h-72 overflow-y-auto px-4 py-3">
                  <div className="space-y-2">
                    {data.form.visibleFields.map((field) => (
                      <div key={field.name} className="flex items-center justify-between gap-3 rounded border border-gray-800 bg-gray-900/80 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-gray-500">{field.name}</div>
                          <div className="text-sm text-gray-200">{field.label}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white">{field.value}</div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">{field.source}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {data.omitted.length > 0 && (
                <div className="rounded-lg border border-amber-700/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                  {data.omitted.map((message, index) => (
                    <div key={`${message}-${index}`}>{message}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-gray-800 bg-gray-950/70">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={submitToMobileBg} disabled={!data || loading || Boolean(error)}>
              Open on mobile.bg
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
