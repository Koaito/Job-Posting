import { redirect } from 'next/navigation';
import { isAuthenticated } from './actions/auth';

/**
 * Root page - redirects to dashboard if authenticated, login otherwise
 */

export default async function Home() {
  const authenticated = await isAuthenticated();
  
  if (authenticated) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
