-- =========================================================================
-- HC VAPE - SCRIPT 06: LIMPEZA DE SABORES ÓRFÃOS / DUPLICADOS NO ELF BAR 23K
-- =========================================================================
-- Motivo: O produto estava com "Maça verde: 2" (em português) e "green apple: 2" (em inglês).
-- "Maça verde" ficou como chave órfã antiga no JSON de estoque_zonas, inflando o total
-- para 7 unidades, enquanto o modal exibia apenas os 5 sabores oficiais cadastrados (5 un).
-- =========================================================================

-- 1. Diagnóstico específico do ELF BAR 23K
SELECT 
  id, 
  nome, 
  estoque, 
  zonas, 
  sabores, 
  sabores_estoque, 
  estoque_zonas 
FROM public.produtos 
WHERE nome ILIKE '%ELF BAR 23K%';

-- 2. Limpeza definitiva do ELF BAR 23K:
-- - Remove chaves órfãs ("Maça verde", "blueberry pear", etc.)
-- - Define estoque consolidado para 5 unidades
-- - Restringe zona para 'recife'
UPDATE public.produtos
SET 
  zonas = ARRAY['recife'],
  estoque_zonas = jsonb_build_object(
    'recife', jsonb_build_object(
      'estoque', 5,
      'sabores_estoque', jsonb_build_object(
        'green apple', 2,
        'baja splash', 1,
        'lime grapefruit', 0,
        'raspberry watermelon', 1,
        'green apple plum sour lime', 1
      )
    )
  ),
  sabores = ARRAY[
    'green apple',
    'baja splash',
    'lime grapefruit',
    'raspberry watermelon',
    'green apple plum sour lime'
  ],
  sabores_estoque = jsonb_build_object(
    'green apple', 2,
    'baja splash', 1,
    'lime grapefruit', 0,
    'raspberry watermelon', 1,
    'green apple plum sour lime', 1
  ),
  estoque = 5,
  updated_at = now()
WHERE nome ILIKE '%ELF BAR 23K%';

-- 3. Notificar recarga do PostgREST
NOTIFY pgrst, 'reload schema';
