'use client';
import { useState, useCallback } from 'react';
import { Editor, Frame, useEditor } from '@craftjs/core';
import { BLOCK_RESOLVER, BLOCK_PALETTE } from '@/components/editor-blocks';
import type { DealerTemplateConfig } from '@/lib/queries';

// ── Toolbar ──────────────────────────────────────────────────────────────────

function EditorToolbar({
  name,
  configId,
  pageType,
  onPageTypeChange,
}: {
  name: string;
  configId: number;
  pageType: 'listingGrid' | 'listingDetail';
  onPageTypeChange: (t: 'listingGrid' | 'listingDetail') => void;
}) {
  const { actions, query, canUndo, canRedo } = useEditor((state, q) => ({
    canUndo: q.history.canUndo(),
    canRedo: q.history.canRedo(),
  }));
  const [saving, setSaving] = useState(false);
  const [configName, setConfigName] = useState(name);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const serialized = query.serialize();
      const res = await fetch(`/api/dealer-templates/${configId}/save-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageType, craftState: serialized, name: configName }),
      });
      if (!res.ok) throw new Error('Save failed');
    } finally {
      setSaving(false);
    }
  }, [query, configId, pageType, configName]);

  return (
    <div className="flex items-center gap-3 px-4 h-12 bg-gray-900 border-b border-gray-700 shrink-0">
      <input
        value={configName}
        onChange={(e) => setConfigName(e.target.value)}
        className="bg-transparent text-sm font-medium text-white border-b border-transparent hover:border-gray-600 focus:border-blue-500 outline-none px-1 py-0.5 w-48"
      />
      <div className="flex gap-1 ml-2">
        <button
          onClick={() => actions.history.undo()}
          disabled={!canUndo}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 rounded"
        >
          ↩ Undo
        </button>
        <button
          onClick={() => actions.history.redo()}
          disabled={!canRedo}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 rounded"
        >
          ↪ Redo
        </button>
      </div>
      <div className="flex gap-1 ml-2 bg-gray-800 rounded-md p-0.5">
        {(['listingGrid', 'listingDetail'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onPageTypeChange(t)}
            className={`text-xs px-3 py-1 rounded ${pageType === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t === 'listingGrid' ? 'Grid Page' : 'Detail Page'}
          </button>
        ))}
      </div>
      <div className="ml-auto flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-md font-medium"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Block palette (left strip) ────────────────────────────────────────────────

function BlockPalette({ pageType }: { pageType: 'listingGrid' | 'listingDetail' }) {
  const { connectors } = useEditor();
  const pagePalette = BLOCK_PALETTE[pageType];
  const genericPalette = BLOCK_PALETTE.generic;

  return (
    <div className="w-14 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-2 gap-1 overflow-y-auto shrink-0">
      {[...pagePalette, ...genericPalette].map((item) => {
        const BlockComp = BLOCK_RESOLVER[item.name as keyof typeof BLOCK_RESOLVER];
        return (
          <button
            key={item.name}
            ref={(ref) => { if (ref) connectors.create(ref, <BlockComp />); }}
            className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-gray-800 cursor-grab w-12"
            title={item.label}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="text-[9px] text-gray-400 leading-tight text-center">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Properties panel (right) ─────────────────────────────────────────────────

function PropertiesPanel() {
  const { selected, actions } = useEditor((state) => {
    const selectedIds = state.events.selected;
    const id = selectedIds.size > 0 ? [...selectedIds][0] : null;
    return { selected: id ? { id, node: state.nodes[id] } : null };
  });

  if (!selected) {
    return (
      <div className="w-60 bg-gray-900 border-l border-gray-700 flex items-center justify-center text-gray-500 text-sm shrink-0">
        Select a block
      </div>
    );
  }

  const { id, node } = selected;
  const props = node.data.props as Record<string, unknown>;

  const setProp = (key: string, value: unknown) => {
    actions.setProp(id, (p: Record<string, unknown>) => { p[key] = value; });
  };

  return (
    <div className="w-60 bg-gray-900 border-l border-gray-700 overflow-y-auto shrink-0">
      <div className="px-3 py-2 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {node.data.displayName}
      </div>
      <div className="p-3 space-y-3">
        {Object.entries(props).map(([key, value]) => (
          <PropControl key={key} propKey={key} value={value} onChange={(v) => setProp(key, v)} />
        ))}
      </div>
    </div>
  );
}

function PropControl({ propKey, value, onChange }: { propKey: string; value: unknown; onChange: (v: unknown) => void }) {
  const label = propKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center justify-between">
        <span className="text-xs text-gray-300">{label}</span>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full"
        />
      </label>
    );
  }
  if (typeof value === 'string' && (value.startsWith('#') || propKey.toLowerCase().includes('color'))) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        <div className="flex gap-2 items-center">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 rounded cursor-pointer bg-transparent border-0" />
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white flex-1" />
        </div>
      </label>
    );
  }
  if (typeof value === 'string') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full"
        />
      </label>
    );
  }
  return null;
}

// ── Main editor client component ─────────────────────────────────────────────

export function EditorClient({ config }: { config: DealerTemplateConfig }) {
  const [pageType, setPageType] = useState<'listingGrid' | 'listingDetail'>('listingGrid');

  const parsedConfig = JSON.parse(config.configJson) as {
    listingGrid: object;
    listingDetail: object;
  };

  const currentState = JSON.stringify(parsedConfig[pageType]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <Editor resolver={BLOCK_RESOLVER}>
        <EditorToolbar
          name={config.name}
          configId={config.id}
          pageType={pageType}
          onPageTypeChange={setPageType}
        />
        <div className="flex flex-1 overflow-hidden">
          <BlockPalette pageType={pageType} />
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="bg-white min-h-full shadow-sm">
              <Frame key={pageType} data={currentState} />
            </div>
          </div>
          <PropertiesPanel />
        </div>
      </Editor>
    </div>
  );
}
