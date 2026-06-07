import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();

  // Redirect to dashboard if authenticated
  if (session) {
    redirect('/dashboard');
  }

  // Redirect to login if not authenticated
  redirect('/login');
}
