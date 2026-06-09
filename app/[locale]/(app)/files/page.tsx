
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/api/auth-helpers';
import FilesClient from './FilesClient';

export default async function FilesPage() {
  const pageAccess = await requirePagePermission('files');
  if ('redirect' in pageAccess) redirect(pageAccess.redirect);

  return <FilesClient />;
}
