'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface TranslationRow {
  key: string;
  context: string;
  description: string;
  bg: string;
  en: string;
  de: string;
  ru: string;
}

type AutoTranslatedValues = Partial<Pick<TranslationRow, 'bg' | 'de' | 'ru'>>;

export function TranslationEditor() {
  const t = useTranslations('ui');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all translation keys and their translations
    fetch('/api/translations')
      .then((res) => res.json())
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load translations:', error);
        setLoading(false);
      });
  }, []);

  const handleUpdate = async (key: string, locale: string, value: string) => {
    // Update translation in database via API
    const response = await fetch('/api/translations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, locale, value }),
    });

    if (response.ok) {
      // Update local state
      setRows((prev) =>
        prev.map((row) =>
          row.key === key ? { ...row, [locale]: value } : row,
        ),
      );
    }
  };

  const handleAutoTranslate = async (key: string) => {
    setTranslatingKey(key);
    setError(null);

    try {
      const response = await fetch('/api/translations/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as {
        translations?: AutoTranslatedValues;
      };

      setRows((prev) =>
        prev.map((row) =>
          row.key === key ? { ...row, ...data.translations } : row,
        ),
      );
    } catch (translateError) {
      setError(
        translateError instanceof Error
          ? translateError.message
          : 'Auto-translation failed',
      );
    } finally {
      setTranslatingKey(null);
    }
  };

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredRows = normalizedFilter
    ? rows.filter((row) =>
        [
          row.key,
          row.context,
          row.description,
          row.bg,
          row.en,
          row.de,
          row.ru,
        ].some((value) => value?.toLowerCase().includes(normalizedFilter)),
      )
    : rows;

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <input
        type="text"
        placeholder="Search by key, context, or value..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 px-4 py-2 bg-gray-800 text-gray-100 border border-gray-600 rounded w-full"
      />

      {error && (
        <div className="mb-4 rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <table className="w-full border-collapse border border-gray-600">
        <thead>
          <tr className="bg-gray-800">
            <th className="border border-gray-600 px-4 py-2 text-left">Key</th>
            <th className="border border-gray-600 px-4 py-2 text-left">Context</th>
            <th className="border border-gray-600 px-4 py-2 text-left">BG</th>
            <th className="border border-gray-600 px-4 py-2 text-left">EN</th>
            <th className="border border-gray-600 px-4 py-2 text-left">DE</th>
            <th className="border border-gray-600 px-4 py-2 text-left">RU</th>
            <th className="border border-gray-600 px-4 py-2 text-left">Auto</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.key} className="hover:bg-gray-800">
              <td className="border border-gray-600 px-4 py-2">{row.key}</td>
              <td className="border border-gray-600 px-4 py-2">{row.context}</td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.bg}
                  onChange={(e) => handleUpdate(row.key, 'bg', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.en}
                  onChange={(e) => handleUpdate(row.key, 'en', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.de}
                  onChange={(e) => handleUpdate(row.key, 'de', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.ru}
                  onChange={(e) => handleUpdate(row.key, 'ru', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
              <td className="border border-gray-600 px-4 py-2">
                <button
                  type="button"
                  onClick={() => handleAutoTranslate(row.key)}
                  disabled={translatingKey === row.key || !row.en.trim()}
                  className="rounded border border-blue-500/60 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Translate from EN to BG, DE, and RU"
                >
                  {translatingKey === row.key ? 'Translating...' : 'Translate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
