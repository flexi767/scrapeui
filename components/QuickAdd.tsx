'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export function QuickAdd() {
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
        className="flex items-center gap-2 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-200"
      >
        <span>Search...</span>
        <kbd className="rounded border border-gray-600 px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or jump to..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Create">
            <CommandItem onSelect={() => navigate('/tasks/new')}>
              New Task
            </CommandItem>
            <CommandItem onSelect={() => navigate('/expenses/new')}>
              New Expense
            </CommandItem>
            <CommandItem onSelect={() => navigate('/kb/new')}>
              New Article
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => navigate('/')}>
              Listings
            </CommandItem>
            <CommandItem onSelect={() => navigate('/tasks')}>
              All Tasks
            </CommandItem>
            <CommandItem onSelect={() => navigate('/tasks/my')}>
              My Tasks
            </CommandItem>
            <CommandItem onSelect={() => navigate('/expenses')}>
              Expenses
            </CommandItem>
            <CommandItem onSelect={() => navigate('/kb')}>
              Knowledge Base
            </CommandItem>
            <CommandItem onSelect={() => navigate('/files')}>
              Files
            </CommandItem>
            <CommandItem onSelect={() => navigate('/search')}>
              Search
            </CommandItem>
            <CommandItem onSelect={() => navigate('/config')}>
              Config
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
