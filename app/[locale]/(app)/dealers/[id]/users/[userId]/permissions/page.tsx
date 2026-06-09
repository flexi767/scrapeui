import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserWithPermissions } from '@/lib/queries';
import { PermissionsForm } from './PermissionsForm';

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    redirect('/dashboard');
  }

  const { userId: userIdParam } = await params;
  const userId = parseInt(userIdParam, 10);
  if (Number.isNaN(userId)) notFound();

  const user = getUserWithPermissions(userId);
  if (!user) notFound();

  return (
    <div className="min-h-screen bg-[#111827] p-8">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Page permissions</h1>
      <p className="text-sm text-gray-400 mb-6">
        Choose which admin pages <span className="font-mono">{user.username}</span> can see.
      </p>
      <PermissionsForm
        userId={user.id}
        username={user.username}
        initialGrantedPageKeys={user.grantedPageKeys}
      />
    </div>
  );
}
