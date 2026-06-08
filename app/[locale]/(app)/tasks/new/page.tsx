
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { LinkedCarsSelector } from '@/components/shared/LinkedCarsSelector';
import type { LabelRow, UserRow } from '@/lib/queries';
import { apiRequest } from '@/lib/utils';

export default function NewTaskPage() {
  const t = useTranslations('ui');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('backlog');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);

  useEffect(() => {
    apiRequest<UserRow[]>('/api/users', 'Failed to load users').then(setUsers).catch(() => {});
    apiRequest<LabelRow[]>('/api/labels', 'Failed to load labels').then(setLabels).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { id } = await apiRequest<{ id: number }>('/api/tasks', 'Failed to create task', {
        method: 'POST',
        json: {
          title, description: description || null, status, priority,
          assigneeId: assigneeId ? Number(assigneeId) : null,
          deadline: deadline || null,
          listingIds: selectedListings,
          labelIds: selectedLabels,
        },
      });
      router.push(`/tasks/${id}`);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{t('new_task')}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">{t('title')}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            placeholder={t('task_title')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('description')}</Label>
          <TiptapEditor
            content={description}
            onChange={setDescription}
            placeholder={t('describe_the_task')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('status')}</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="backlog">{t('backlog')}</option>
              <option value="in_progress">{t('in_progress')}</option>
              <option value="done">{t('done')}</option>
              <option value="cancelled">{t('cancelled')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t('priority')}</Label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="low">{t('low')}</option>
              <option value="medium">{t('medium')}</option>
              <option value="high">{t('high')}</option>
              <option value="urgent">{t('urgent')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('assignee')}</Label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="">{t('everyone')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t('deadline')}</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <LinkedCarsSelector selected={selectedListings} onChange={setSelectedListings} />

        <div className="space-y-2">
          <Label>{t('labels')}</Label>
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  if (selectedLabels.includes(l.id)) setSelectedLabels(selectedLabels.filter((x) => x !== l.id));
                  else setSelectedLabels([...selectedLabels, l.id]);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedLabels.includes(l.id)
                    ? 'ring-2 ring-white'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: l.color, color: '#fff' }}
              >
                {l.name}
              </button>
            ))}
            {labels.length === 0 && (
              <p className="text-sm text-gray-400">{t('no_labels_yet')}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? t('creating') : t('create_task')}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
}
