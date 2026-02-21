import { useAuthStore } from '../lib/store';
import { signIn, signUp, signOut } from '../lib/auth';

export function useAuth() {
  const { user, isAuthenticated, token } = useAuthStore();

  return {
    user,
    isAuthenticated,
    token,
    signIn,
    signUp,
    signOut,
  };
}
