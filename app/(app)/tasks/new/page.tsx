'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { LinkedCarsSelector } from '@/components/shared/LinkedCarsSelector';

interface UserOption { id: number; name: string; }
interface LabelOption { id: number; name: string; color: string; }

export default function NewTaskPage() {
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

  const [users, setUsers] = useState<UserOption[]>([]);
  const [labels, setLabels] = useState<LabelOption[]>([]);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers);
    fetch('/api/labels').then(r => r.json()).then(setLabels);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, description: description || null, status, priority,
        assigneeId: assigneeId ? Number(assigneeId) : null,
        deadline: deadline || null,
        listingIds: selectedListings,
        labelIds: selectedLabels,
      }),
    });

    if (res.ok) {
      const { id } = await res.json();
      router.push(`/tasks/${id}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">New Task</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            placeholder="Task title"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <TiptapEditor
            content={description}
            onChange={setDescription}
            placeholder="Describe the task..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="backlog">Backlog</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Assignee</Label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            >
              <option value="">Everyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Deadline</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <LinkedCarsSelector selected={selectedListings} onChange={setSelectedListings} />

        <div className="space-y-2">
          <Label>Labels</Label>
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
              <p className="text-sm text-gray-400">No labels yet</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create Task'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
