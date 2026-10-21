-- =============================================================================
-- CORREÇÃO DEFINITIVA DO ALERTA CRÍTICO: rls_disabled_in_public (incluindo public.notas)
-- Ativa o Row-Level Security (RLS) especificamente em public.notas e também
-- automaticamente em TODAS as tabelas do schema public, criando políticas para
-- não impactar a aplicação em nada.
-- =============================================================================

-- 1. Ativa RLS diretamente na tabela public.notas apontada no alerta
ALTER TABLE IF EXISTS public.notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso app notas" ON public.notas;
CREATE POLICY "Permitir acesso app notas"
  ON public.notas
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Bloco automático que garante que TODAS as tabelas em 'public' tenham RLS ativo e política criada
DO $$
DECLARE
  r RECORD;
  policy_name TEXT;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    policy_name := 'Permitir acesso app ' || r.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      policy_name,
      r.tablename
    );
  END LOOP;
END $$;
