'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export function QuickAdd() {
  const t = useTranslations('ui');
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-7 items-center gap-1.5 rounded-md border border-gray-600 bg-gray-800 px-2 text-[11px] font-medium text-gray-400 hover:border-gray-500 hover:text-gray-200 sm:px-2.5"
        title={t('search_or_jump_to')}
      >
        <span className="hidden sm:inline">{t('search_ellipsis')}</span>
        <kbd className="rounded border border-gray-600 px-1 py-0.5 text-[10px] leading-none">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t('search_or_jump_to')} />
        <CommandList>
          <CommandEmpty>{t('no_results_found')}</CommandEmpty>

          <CommandGroup heading={t('create')}>
            <CommandItem onSelect={() => navigate('/tasks/new')}>
              {t('new_task')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/expenses/new')}>
              {t('new_expense')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/kb/new')}>
              {t('new_article')}
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading={t('navigate')}>
            <CommandItem onSelect={() => navigate('/')}>
              {t('listings')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/tasks')}>
              {t('all_tasks')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/tasks/my')}>
              {t('my_tasks')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/expenses')}>
              {t('expenses')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/kb')}>
              {t('knowledge_base')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/files')}>
              {t('files')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/search')}>
              {t('search')}
            </CommandItem>
            <CommandItem onSelect={() => navigate('/config')}>
              {t('config')}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
