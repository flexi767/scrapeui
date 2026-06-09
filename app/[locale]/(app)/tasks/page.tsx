
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/api/auth-helpers';
import TasksClient from './TasksClient';

export default async function TasksPage() {
  const pageAccess = await requirePagePermission('tasks');
  if ('redirect' in pageAccess) redirect(pageAccess.redirect);

  return <TasksClient />;
}
