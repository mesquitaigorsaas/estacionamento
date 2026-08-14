// ============================================================
// js/supabase.js
// Conexão única com o Supabase — todo o resto do sistema
// importa o "supabase" a partir daqui, nunca cria outra conexão.
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// >>> SUBSTITUA pelos valores do seu projeto:
// Painel Supabase > Settings > API > Project URL / anon public key
// A "anon key" é segura para expor no front-end: o acesso real aos
// dados é controlado pelas políticas RLS (supabase/policies.sql).
const SUPABASE_URL = 'https://htgzoigdonvvdakqkjmx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_C23GeNAdt40K-viTeD15qQ_Nofosj6v';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
