import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TranslationEditor } from './TranslationEditor';

export default async function TranslationsPage() {
  const session = await auth();

  // Only allow admin access
  if (!session || session.user?.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Manage Translations</h1>
      <TranslationEditor />
    </div>
  );
}
