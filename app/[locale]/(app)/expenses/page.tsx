
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/api/auth-helpers';
import ExpensesClient from './ExpensesClient';

export default async function ExpensesPage() {
  const pageAccess = await requirePagePermission('expenses');
  if ('redirect' in pageAccess) redirect(pageAccess.redirect);

  return <ExpensesClient />;
}
