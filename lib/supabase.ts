import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// La sesión la maneja Clerk. AuthContext registra aquí la función que entrega
// el token de Clerk, y Supabase lo envía en cada consulta, función y canal en tiempo real.
let getClerkToken: (() => Promise<string | null>) | null = null;

export function setSupabaseTokenGetter(getter: (() => Promise<string | null>) | null) {
  getClerkToken = getter;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => (getClerkToken ? await getClerkToken() : null),
});
