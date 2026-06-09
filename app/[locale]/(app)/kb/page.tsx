
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/api/auth-helpers';
import KbClient from './KbClient';

export default async function KBPage() {
  const pageAccess = await requirePagePermission('kb');
  if ('redirect' in pageAccess) redirect(pageAccess.redirect);

  return <KbClient />;
}
