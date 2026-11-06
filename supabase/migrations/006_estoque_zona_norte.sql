-- =========================================================================
-- HC VAPE - MIGRAÇÃO 006: ESTOQUE TOTALMENTE INDEPENDENTE PARA A ZONA NORTE
-- Idempotente: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION
-- =========================================================================

-- 1. Assegurar extensão unaccent
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS unaccent;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- 2. Tabela Principal: estoque_zona_norte (1 linha por produto + sabor)
CREATE TABLE IF NOT EXISTS public.estoque_zona_norte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  sabor TEXT NOT NULL,
  quantidade INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Restrições de integridade
  CONSTRAINT estoque_zn_quantidade_nao_negativa CHECK (quantidade >= 0),
  CONSTRAINT uq_estoque_zn_produto_sabor UNIQUE (produto_id, sabor)
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_estoque_zn_produto ON public.estoque_zona_norte(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_zn_sabor ON public.estoque_zona_norte(sabor);

-- 3. Tabela Imutável de Auditoria: movimentos_estoque_zona_norte (Append-Only)
CREATE TABLE IF NOT EXISTS public.movimentos_estoque_zona_norte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  sabor TEXT NOT NULL,
  delta INT NOT NULL,
  saldo_antes INT NOT NULL,
  saldo_depois INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  troca_id UUID REFERENCES public.trocas(id) ON DELETE RESTRICT,
  usuario TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validações de integridade
  CONSTRAINT movimentos_zn_tipo_check CHECK (
    tipo IN ('venda', 'estorno', 'ajuste', 'troca', 'troca_estorno', 'contagem_inicial')
  ),
  CONSTRAINT movimentos_zn_saldo_depois_check CHECK (saldo_depois >= 0),
  CONSTRAINT movimentos_zn_consistencia_check CHECK (saldo_antes + delta = saldo_depois)
);

CREATE INDEX IF NOT EXISTS idx_mov_zn_produto_sabor ON public.movimentos_estoque_zona_norte(produto_id, sabor);
CREATE INDEX IF NOT EXISTS idx_mov_zn_pedido_id ON public.movimentos_estoque_zona_norte(pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_zn_troca_id ON public.movimentos_estoque_zona_norte(troca_id) WHERE troca_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_zn_created_at ON public.movimentos_estoque_zona_norte(created_at DESC);

-- 4. Segurança RLS Estrita:
-- Escrita DIRETA revogada para público, anon e authenticated.
-- Toda mutação deve passar exclusivamente pelas RPCs SECURITY DEFINER.
ALTER TABLE public.estoque_zona_norte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentos_estoque_zona_norte ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.estoque_zona_norte FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.movimentos_estoque_zona_norte FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.estoque_zona_norte TO authenticated;
GRANT SELECT ON public.movimentos_estoque_zona_norte TO authenticated;

DROP POLICY IF EXISTS "authenticated_select_estoque_zn" ON public.estoque_zona_norte;
CREATE POLICY "authenticated_select_estoque_zn" 
  ON public.estoque_zona_norte FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_select_movimentos_zn" ON public.movimentos_estoque_zona_norte;
CREATE POLICY "authenticated_select_movimentos_zn" 
  ON public.movimentos_estoque_zona_norte FOR SELECT 
  TO authenticated 
  USING (true);

-- 5. RPC: Ajuste manual e contagem física na Zona Norte
CREATE OR REPLACE FUNCTION public.ajustar_estoque_zona_norte(
  p_produto_id UUID,
  p_sabor TEXT,
  p_operacao TEXT, -- 'definir' ou 'delta'
  p_valor INT,
  p_motivo TEXT DEFAULT 'ajuste_manual',
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_produto RECORD;
  v_item_id UUID;
  v_sabor_oficial TEXT;
  v_saldo_antes INT := 0;
  v_saldo_depois INT;
  v_delta INT;
  v_usuario TEXT;
  v_tipo_mov VARCHAR(30);
BEGIN
  IF p_operacao NOT IN ('definir', 'delta') THEN
    RAISE EXCEPTION 'Operação inválida: "%". Permitidas: "definir" ou "delta".', p_operacao;
  END IF;

  IF p_sabor IS NULL OR TRIM(p_sabor) = '' THEN
    RAISE EXCEPTION 'O nome do sabor é obrigatório para ajuste de estoque.';
  END IF;

  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  -- 1. Verificar se o produto existe
  SELECT * INTO v_produto 
  FROM public.produtos 
  WHERE id = p_produto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  -- 2. Localizar registro existente (exato ou por sabor normalizado)
  SELECT id, sabor, quantidade INTO v_item_id, v_sabor_oficial, v_saldo_antes
  FROM public.estoque_zona_norte
  WHERE produto_id = p_produto_id
    AND (sabor = TRIM(p_sabor) OR public.normalizar_sabor(sabor) = public.normalizar_sabor(p_sabor))
  LIMIT 1
  FOR UPDATE;

  IF v_sabor_oficial IS NULL THEN
    v_sabor_oficial := TRIM(p_sabor);
    v_saldo_antes := 0;
  END IF;

  -- 3. Calcular saldo final e delta
  IF p_operacao = 'definir' THEN
    IF p_valor < 0 THEN
      RAISE EXCEPTION 'Valor de contagem física não pode ser negativo (% un).', p_valor;
    END IF;
    v_saldo_depois := p_valor;
    v_delta := v_saldo_depois - v_saldo_antes;
  ELSE -- delta
    v_delta := p_valor;
    v_saldo_depois := v_saldo_antes + v_delta;
  END IF;

  IF v_saldo_depois < 0 THEN
    RAISE EXCEPTION 'Operação resultaria em saldo negativo (% un) para o produto "%" (Sabor: "%") na Zona Norte.',
      v_saldo_depois, v_produto.nome, v_sabor_oficial;
  END IF;

  -- Se não houve alteração real, retorna sem criar movimento redundante
  IF v_delta = 0 AND v_item_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'produto_id', p_produto_id,
      'sabor', v_sabor_oficial,
      'saldo', v_saldo_antes,
      'delta', 0
    );
  END IF;

  -- 4. Gravar saldo na tabela estoque_zona_norte
  IF v_item_id IS NOT NULL THEN
    UPDATE public.estoque_zona_norte
    SET quantidade = v_saldo_depois,
        updated_at = now()
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.estoque_zona_norte (produto_id, sabor, quantidade, created_at, updated_at)
    VALUES (p_produto_id, v_sabor_oficial, v_saldo_depois, now(), now())
    RETURNING id INTO v_item_id;
  END IF;

  -- 5. Gravar na auditoria da Zona Norte
  IF p_motivo = 'contagem_inicial' THEN
    v_tipo_mov := 'contagem_inicial';
  ELSE
    v_tipo_mov := 'ajuste';
  END IF;

  INSERT INTO public.movimentos_estoque_zona_norte (
    produto_id,
    sabor,
    delta,
    saldo_antes,
    saldo_depois,
    tipo,
    usuario,
    motivo
  ) VALUES (
    p_produto_id,
    v_sabor_oficial,
    v_delta,
    v_saldo_antes,
    v_saldo_depois,
    v_tipo_mov,
    v_usuario,
    p_motivo
  );

  RETURN jsonb_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'sabor', v_sabor_oficial,
    'saldo_antes', v_saldo_antes,
    'saldo_depois', v_saldo_depois,
    'delta', v_delta,
    'operacao', p_operacao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ajustar_estoque_zona_norte(UUID, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated;

-- 6. RPC: Baixa Atômica Exclusiva da Zona Norte
CREATE OR REPLACE FUNCTION public.baixar_estoque_zona_norte(
  p_pedido_id UUID,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido RECORD;
  v_zona_id VARCHAR(50);
  v_item JSONB;
  v_prod_id UUID;
  v_sabor_solicitado TEXT;
  v_qtd INT;
  v_produto RECORD;
  v_item_zn RECORD;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  -- 1. Lock exclusivo no pedido
  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  -- 2. BLINDAGEM DE ZONA: Só permite baixar na Zona Norte se a zona do pedido for 'norte'
  v_zona_id := public.resolver_zona_id(COALESCE(v_pedido.zona::text, 'recife'));
  IF v_zona_id <> 'norte' THEN
    RAISE EXCEPTION 'O pedido #% possui região "%" e NÃO pertence à Zona Norte. A baixa deve ser feita na rotina correspondente à sua zona.',
      v_pedido.numero_pedido, v_zona_id;
  END IF;

  -- 3. Idempotência
  IF v_pedido.status_checklist = true THEN
    RAISE EXCEPTION 'Pedido #% já teve o estoque baixado anteriormente.', v_pedido.numero_pedido;
  END IF;

  IF v_pedido.excluido = true THEN
    RAISE EXCEPTION 'Não é permitido dar baixa em pedido excluído (Pedido #%).', v_pedido.numero_pedido;
  END IF;

  -- 4. Processar itens do pedido na tabela estoque_zona_norte
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pedido.itens, '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := COALESCE((v_item->>'quantidade')::int, 0);

    IF v_qtd <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_prod_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado para o item "%" (ID: %) no Pedido #%',
        COALESCE(v_item->>'nome', 'Item'), v_prod_id, v_pedido.numero_pedido;
    END IF;

    -- Produtos com estoque ilimitado não sofrem baixa física
    IF v_produto.estoque_ilimitado THEN
      CONTINUE;
    END IF;

    -- Buscar e travar linha no estoque_zona_norte
    SELECT * INTO v_item_zn
    FROM public.estoque_zona_norte
    WHERE produto_id = v_prod_id
      AND (sabor = v_sabor_solicitado OR public.normalizar_sabor(sabor) = public.normalizar_sabor(v_sabor_solicitado))
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sabor "%" não encontrado no estoque da Zona Norte para o produto "%" (Pedido #%).',
        v_sabor_solicitado, v_produto.nome, v_pedido.numero_pedido;
    END IF;

    IF v_item_zn.quantidade < v_qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente na Zona Norte para o produto "%" (Sabor: "%"). Disponível: %, Solicitado: % (Pedido #%).',
        v_produto.nome, v_item_zn.sabor, v_item_zn.quantidade, v_qtd, v_pedido.numero_pedido;
    END IF;

    v_saldo_depois := v_item_zn.quantidade - v_qtd;

    -- Atualiza exclusivamente a tabela estoque_zona_norte
    UPDATE public.estoque_zona_norte
    SET quantidade = v_saldo_depois,
        updated_at = now()
    WHERE id = v_item_zn.id;

    -- Grava na auditoria exclusiva da Zona Norte
    INSERT INTO public.movimentos_estoque_zona_norte (
      produto_id,
      sabor,
      delta,
      saldo_antes,
      saldo_depois,
      tipo,
      pedido_id,
      usuario,
      motivo
    ) VALUES (
      v_prod_id,
      v_item_zn.sabor,
      -v_qtd,
      v_item_zn.quantidade,
      v_saldo_depois,
      'venda',
      p_pedido_id,
      v_usuario,
      'baixa_pedido_zona_norte'
    );
  END LOOP;

  -- 5. Atualizar checklist do pedido
  UPDATE public.pedidos 
  SET status_checklist = true 
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero_pedido', v_pedido.numero_pedido,
    'zona', 'norte',
    'status_checklist', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.baixar_estoque_zona_norte(UUID, TEXT) TO authenticated;

-- 7. RPC: Estorno Atômico Exclusivo da Zona Norte (Saldo Líquido)
CREATE OR REPLACE FUNCTION public.estornar_estoque_zona_norte(
  p_pedido_id UUID,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido RECORD;
  v_zona_id VARCHAR(50);
  v_item_mov RECORD;
  v_item_zn RECORD;
  v_saldo_depois INT;
  v_usuario TEXT;
  v_teve_movimento BOOLEAN := false;
BEGIN
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  -- 1. Lock exclusivo no pedido
  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  -- 2. BLINDAGEM DE ZONA: Só permite estornar na Zona Norte se o pedido for da Zona Norte
  v_zona_id := public.resolver_zona_id(COALESCE(v_pedido.zona::text, 'recife'));
  IF v_zona_id <> 'norte' THEN
    RAISE EXCEPTION 'O pedido #% possui região "%" e NÃO pertence à Zona Norte. O estorno deve ser feito na rotina correspondente à sua zona.',
      v_pedido.numero_pedido, v_zona_id;
  END IF;

  -- 3. Idempotência
  IF v_pedido.status_checklist = false THEN
    RAISE EXCEPTION 'Pedido #% não está com o checklist baixado para estorno.', v_pedido.numero_pedido;
  END IF;

  -- 4. Repor exatamente o negativo da soma dos deltas em movimentos_estoque_zona_norte
  FOR v_item_mov IN 
    SELECT 
      produto_id, 
      sabor, 
      -SUM(delta) AS qtd_repor
    FROM public.movimentos_estoque_zona_norte 
    WHERE pedido_id = p_pedido_id
    GROUP BY produto_id, sabor
    HAVING -SUM(delta) > 0
  LOOP
    v_teve_movimento := true;

    SELECT * INTO v_item_zn
    FROM public.estoque_zona_norte
    WHERE produto_id = v_item_mov.produto_id
      AND (sabor = v_item_mov.sabor OR public.normalizar_sabor(sabor) = public.normalizar_sabor(v_item_mov.sabor))
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      v_saldo_depois := v_item_zn.quantidade + v_item_mov.qtd_repor;

      UPDATE public.estoque_zona_norte
      SET quantidade = v_saldo_depois,
          updated_at = now()
      WHERE id = v_item_zn.id;

      INSERT INTO public.movimentos_estoque_zona_norte (
        produto_id,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        pedido_id,
        usuario,
        motivo
      ) VALUES (
        v_item_mov.produto_id,
        v_item_zn.sabor,
        v_item_mov.qtd_repor,
        v_item_zn.quantidade,
        v_saldo_depois,
        'estorno',
        p_pedido_id,
        v_usuario,
        'reabertura_ou_cancelamento_pedido_zn'
      );
    ELSE
      -- Se a linha foi apagada no intervalo, recria com a quantidade estornada
      INSERT INTO public.estoque_zona_norte (produto_id, sabor, quantidade, created_at, updated_at)
      VALUES (v_item_mov.produto_id, v_item_mov.sabor, v_item_mov.qtd_repor, now(), now());

      INSERT INTO public.movimentos_estoque_zona_norte (
        produto_id,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        pedido_id,
        usuario,
        motivo
      ) VALUES (
        v_item_mov.produto_id,
        v_item_mov.sabor,
        v_item_mov.qtd_repor,
        0,
        v_item_mov.qtd_repor,
        'estorno',
        p_pedido_id,
        v_usuario,
        'reabertura_ou_cancelamento_pedido_zn'
      );
    END IF;
  END LOOP;

  -- 5. Atualizar checklist do pedido para false
  UPDATE public.pedidos 
  SET status_checklist = false 
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero_pedido', v_pedido.numero_pedido,
    'status_checklist', false,
    'movimentos_estornados', v_teve_movimento
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.estornar_estoque_zona_norte(UUID, TEXT) TO authenticated;

-- 8. RPC: Trocas e Garantias na Zona Norte
CREATE OR REPLACE FUNCTION public.registrar_troca_zona_norte(
  p_cliente_nome TEXT,
  p_cliente_telefone TEXT,
  p_vape_defeito TEXT,
  p_sabor_defeito TEXT,
  p_motivo TEXT,
  p_motivo_detalhes TEXT,
  p_vape_trocado TEXT,
  p_sabor_trocado TEXT,
  p_produto_trocado_id UUID,
  p_abater_estoque BOOLEAN,
  p_observacoes TEXT DEFAULT NULL,
  p_data_troca TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_troca_id UUID := gen_random_uuid();
  v_produto RECORD;
  v_item_zn RECORD;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  IF p_abater_estoque AND p_produto_trocado_id IS NOT NULL THEN
    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = p_produto_trocado_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto trocado não encontrado: %', p_produto_trocado_id;
    END IF;

    IF NOT v_produto.estoque_ilimitado THEN
      SELECT * INTO v_item_zn
      FROM public.estoque_zona_norte
      WHERE produto_id = p_produto_trocado_id
        AND (sabor = p_sabor_trocado OR public.normalizar_sabor(sabor) = public.normalizar_sabor(p_sabor_trocado))
      LIMIT 1
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Sabor "%" não encontrado no estoque da Zona Norte para efetuar a troca.', p_sabor_trocado;
      END IF;

      IF v_item_zn.quantidade < 1 THEN
        RAISE EXCEPTION 'Estoque insuficiente na Zona Norte para efetuar a troca do produto "%" (Sabor: "%"). Saldo: 0.',
          v_produto.nome, v_item_zn.sabor;
      END IF;

      v_saldo_depois := v_item_zn.quantidade - 1;

      UPDATE public.estoque_zona_norte
      SET quantidade = v_saldo_depois,
          updated_at = now()
      WHERE id = v_item_zn.id;

      INSERT INTO public.trocas (
        id,
        cliente_nome,
        cliente_telefone,
        data_troca,
        vape_defeito,
        sabor_defeito,
        motivo,
        motivo_detalhes,
        vape_trocado,
        sabor_trocado,
        produto_trocado_id,
        zona,
        abateu_estoque,
        status,
        observacoes
      ) VALUES (
        v_troca_id,
        p_cliente_nome,
        p_cliente_telefone,
        p_data_troca,
        p_vape_defeito,
        p_sabor_defeito,
        p_motivo,
        p_motivo_detalhes,
        p_vape_trocado,
        p_sabor_trocado,
        p_produto_trocado_id,
        'norte',
        p_abater_estoque,
        'concluida',
        p_observacoes
      );

      INSERT INTO public.movimentos_estoque_zona_norte (
        produto_id,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        troca_id,
        usuario,
        motivo
      ) VALUES (
        p_produto_trocado_id,
        v_item_zn.sabor,
        -1,
        v_item_zn.quantidade,
        v_saldo_depois,
        'troca',
        v_troca_id,
        v_usuario,
        'troca_cliente_zn'
      );

      RETURN jsonb_build_object(
        'success', true,
        'troca_id', v_troca_id,
        'abateu_estoque', true,
        'status', 'concluida'
      );
    END IF;
  END IF;

  INSERT INTO public.trocas (
    id,
    cliente_nome,
    cliente_telefone,
    data_troca,
    vape_defeito,
    sabor_defeito,
    motivo,
    motivo_detalhes,
    vape_trocado,
    sabor_trocado,
    produto_trocado_id,
    zona,
    abateu_estoque,
    status,
    observacoes
  ) VALUES (
    v_troca_id,
    p_cliente_nome,
    p_cliente_telefone,
    p_data_troca,
    p_vape_defeito,
    p_sabor_defeito,
    p_motivo,
    p_motivo_detalhes,
    p_vape_trocado,
    p_sabor_trocado,
    p_produto_trocado_id,
    'norte',
    p_abater_estoque,
    'concluida',
    p_observacoes
  );

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', v_troca_id,
    'abateu_estoque', false,
    'status', 'concluida'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_troca_zona_norte TO authenticated;

-- RPC: Estorno de Troca na Zona Norte
CREATE OR REPLACE FUNCTION public.estornar_troca_zona_norte(
  p_troca_id UUID,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_troca RECORD;
  v_mov_agrupado RECORD;
  v_item_zn RECORD;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  SELECT * INTO v_troca 
  FROM public.trocas 
  WHERE id = p_troca_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de troca não encontrado: %', p_troca_id;
  END IF;

  IF v_troca.status = 'cancelada' THEN
    RAISE EXCEPTION 'Registro de troca já se encontra cancelado.';
  END IF;

  IF v_troca.abateu_estoque = true THEN
    FOR v_mov_agrupado IN 
      SELECT 
        produto_id, 
        sabor, 
        -SUM(delta) AS qtd_repor
      FROM public.movimentos_estoque_zona_norte 
      WHERE troca_id = p_troca_id
      GROUP BY produto_id, sabor
      HAVING -SUM(delta) > 0
    LOOP
      SELECT * INTO v_item_zn
      FROM public.estoque_zona_norte
      WHERE produto_id = v_mov_agrupado.produto_id
        AND (sabor = v_mov_agrupado.sabor OR public.normalizar_sabor(sabor) = public.normalizar_sabor(v_mov_agrupado.sabor))
      LIMIT 1
      FOR UPDATE;

      IF FOUND THEN
        v_saldo_depois := v_item_zn.quantidade + v_mov_agrupado.qtd_repor;

        UPDATE public.estoque_zona_norte
        SET quantidade = v_saldo_depois,
            updated_at = now()
        WHERE id = v_item_zn.id;

        INSERT INTO public.movimentos_estoque_zona_norte (
          produto_id,
          sabor,
          delta,
          saldo_antes,
          saldo_depois,
          tipo,
          troca_id,
          usuario,
          motivo
        ) VALUES (
          v_mov_agrupado.produto_id,
          v_item_zn.sabor,
          v_mov_agrupado.qtd_repor,
          v_item_zn.quantidade,
          v_saldo_depois,
          'troca_estorno',
          p_troca_id,
          v_usuario,
          'cancelamento_troca_zn'
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE public.trocas 
  SET status = 'cancelada' 
  WHERE id = p_troca_id;

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', p_troca_id,
    'status', 'cancelada'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.estornar_troca_zona_norte(UUID, TEXT) TO authenticated;

-- =========================================================================
-- 9. AJUSTES OBRIGATÓRIOS NAS FUNÇÕES LEGADAS (BLINDAGEM NO BANCO DE DADOS)
-- =========================================================================

-- 9.1 Atualizar baixar_estoque_pedido legada:
-- RECUSA E ABORTA COM EXCEPTION SE A ZONA RESOLVER PARA 'norte'
CREATE OR REPLACE FUNCTION public.baixar_estoque_pedido(
  p_pedido_id UUID,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido RECORD;
  v_item JSONB;
  v_prod_id UUID;
  v_sabor_solicitado TEXT;
  v_qtd INT;
  v_zona_id VARCHAR(50);
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  -- BLINDAGEM OBRIGATÓRIA: Recusa pedidos da Zona Norte
  v_zona_id := public.resolver_zona_id(COALESCE(v_pedido.zona::text, 'recife'));
  IF v_zona_id = 'norte' THEN
    RAISE EXCEPTION 'O pedido #% pertence à Zona Norte e deve ser baixado exclusivamente através da rotina baixar_estoque_zona_norte.', 
      v_pedido.numero_pedido;
  END IF;

  IF v_pedido.status_checklist = true THEN
    RAISE EXCEPTION 'Pedido #% já teve o estoque baixado anteriormente.', v_pedido.numero_pedido;
  END IF;

  IF v_pedido.excluido = true THEN
    RAISE EXCEPTION 'Não é permitido dar baixa em pedido excluído (Pedido #%).', v_pedido.numero_pedido;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pedido.itens, '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := COALESCE((v_item->>'quantidade')::int, 0);

    IF v_qtd <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_prod_id 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado para o item "%" (ID: %) no Pedido #%', 
        COALESCE(v_item->>'nome', 'Item'), v_prod_id, v_pedido.numero_pedido;
    END IF;

    IF v_produto.estoque_ilimitado THEN
      CONTINUE;
    END IF;

    v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

    IF NOT (v_estoque_zonas ? v_zona_id) THEN
      IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
        v_zona_id := 'sul_oeste';
      ELSE
        RAISE EXCEPTION 'Produto "%" não possui estoque configurado para a região "%" (Pedido #%)', 
          v_produto.nome, v_zona_id, v_pedido.numero_pedido;
      END IF;
    END IF;

    v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
    v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);

    IF v_chave_sabor IS NULL THEN
      RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%" (Pedido #%).', 
        v_sabor_solicitado, v_produto.nome, v_zona_id, v_pedido.numero_pedido;
    END IF;

    v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

    IF v_saldo_antes < v_qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%", Região: "%"). Saldo disponível: %, Solicitado: % (Pedido #%)',
        v_produto.nome, v_chave_sabor, v_zona_id, v_saldo_antes, v_qtd, v_pedido.numero_pedido;
    END IF;

    v_saldo_depois := v_saldo_antes - v_qtd;

    v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
    v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

    UPDATE public.produtos 
    SET estoque_zonas = v_estoque_zonas
    WHERE id = v_prod_id;

    INSERT INTO public.movimentos_estoque (
      produto_id,
      zona,
      sabor,
      delta,
      saldo_antes,
      saldo_depois,
      tipo,
      pedido_id,
      usuario
    ) VALUES (
      v_prod_id,
      v_zona_id,
      v_chave_sabor,
      -v_qtd,
      v_saldo_antes,
      v_saldo_depois,
      'venda',
      p_pedido_id,
      v_usuario
    );

    PERFORM recalcular_estoque_produto(v_prod_id);
  END LOOP;

  UPDATE public.pedidos 
  SET status_checklist = true 
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero_pedido', v_pedido.numero_pedido,
    'status_checklist', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.baixar_estoque_pedido(UUID, TEXT) TO authenticated;

-- 9.2 Atualizar estornar_estoque_pedido legada:
-- RECUSA E ABORTA COM EXCEPTION SE A ZONA RESOLVER PARA 'norte'
CREATE OR REPLACE FUNCTION public.estornar_estoque_pedido(
  p_pedido_id UUID,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido RECORD;
  v_zona_id VARCHAR(50);
  v_item_mov RECORD;
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_qtd_repor INT;
  v_usuario TEXT;
  v_teve_movimento BOOLEAN := false;
BEGIN
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  -- BLINDAGEM OBRIGATÓRIA: Recusa pedidos da Zona Norte
  v_zona_id := public.resolver_zona_id(COALESCE(v_pedido.zona::text, 'recife'));
  IF v_zona_id = 'norte' THEN
    RAISE EXCEPTION 'O pedido #% pertence à Zona Norte e deve ser estornado exclusivamente através de estornar_estoque_zona_norte.', 
      v_pedido.numero_pedido;
  END IF;

  IF v_pedido.status_checklist = false THEN
    RAISE EXCEPTION 'Pedido #% não está com o checklist baixado para estorno.', v_pedido.numero_pedido;
  END IF;

  FOR v_item_mov IN 
    SELECT 
      produto_id, 
      zona, 
      sabor, 
      -SUM(delta) AS qtd_repor
    FROM public.movimentos_estoque 
    WHERE pedido_id = p_pedido_id
    GROUP BY produto_id, zona, sabor
    HAVING -SUM(delta) > 0
  LOOP
    v_teve_movimento := true;
    v_qtd_repor := v_item_mov.qtd_repor;

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_item_mov.produto_id 
    FOR UPDATE;

    IF FOUND THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
      v_sabores_zona := COALESCE(v_estoque_zonas->v_item_mov.zona->'sabores_estoque', '{}'::jsonb);

      v_saldo_antes := COALESCE((v_sabores_zona->>v_item_mov.sabor)::int, 0);
      v_saldo_depois := v_saldo_antes + v_qtd_repor;

      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_item_mov.sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_item_mov.zona, 'sabores_estoque'], v_sabores_zona);

      UPDATE public.produtos 
      SET estoque_zonas = v_estoque_zonas
      WHERE id = v_item_mov.produto_id;

      INSERT INTO public.movimentos_estoque (
        produto_id,
        zona,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        pedido_id,
        usuario,
        motivo
      ) VALUES (
        v_item_mov.produto_id,
        v_item_mov.zona,
        v_item_mov.sabor,
        v_qtd_repor,
        v_saldo_antes,
        v_saldo_depois,
        'estorno',
        p_pedido_id,
        v_usuario,
        'reabertura_ou_cancelamento_pedido'
      );

      PERFORM recalcular_estoque_produto(v_item_mov.produto_id);
    END IF;
  END LOOP;

  UPDATE public.pedidos 
  SET status_checklist = false 
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero_pedido', v_pedido.numero_pedido,
    'status_checklist', false,
    'movimentos_estornados', v_teve_movimento
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.estornar_estoque_pedido(UUID, TEXT) TO authenticated;

-- 9.3 Atualizar registrar_troca e estornar_troca legadas:
-- RECUSA ZONA 'norte' SE abateu_estoque = true
CREATE OR REPLACE FUNCTION public.registrar_troca(
  p_cliente_nome TEXT,
  p_cliente_telefone TEXT,
  p_vape_defeito TEXT,
  p_sabor_defeito TEXT,
  p_motivo TEXT,
  p_motivo_detalhes TEXT,
  p_vape_trocado TEXT,
  p_sabor_trocado TEXT,
  p_produto_trocado_id UUID,
  p_zona VARCHAR(50),
  p_abater_estoque BOOLEAN,
  p_observacoes TEXT DEFAULT NULL,
  p_data_troca TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_troca_id UUID := gen_random_uuid();
  v_zona_id VARCHAR(50);
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  v_zona_id := public.resolver_zona_id(COALESCE(p_zona::text, 'recife'));

  -- BLINDAGEM OBRIGATÓRIA: Recusa zona norte com abatimento de estoque na rotina legada
  IF v_zona_id = 'norte' AND p_abater_estoque = true THEN
    RAISE EXCEPTION 'Trocas da Zona Norte com abatimento de estoque devem ser registradas através de registrar_troca_zona_norte.';
  END IF;

  IF p_abater_estoque AND p_produto_trocado_id IS NOT NULL THEN
    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = p_produto_trocado_id 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto trocado não encontrado: %', p_produto_trocado_id;
    END IF;

    IF NOT v_produto.estoque_ilimitado THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
          v_zona_id := 'sul_oeste';
        ELSE
          RAISE EXCEPTION 'Produto "%" não possui estoque na região "%" para efetuar a troca.', 
            v_produto.nome, v_zona_id;
        END IF;
      END IF;

      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor_trocado);

      IF v_chave_sabor IS NULL THEN
        RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%".', 
          p_sabor_trocado, v_produto.nome, v_zona_id;
      END IF;

      v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

      IF v_saldo_antes < 1 THEN
        RAISE EXCEPTION 'Estoque insuficiente para efetuar a troca do produto "%" (Sabor: "%", Região: "%"). Saldo: 0.',
          v_produto.nome, v_chave_sabor, v_zona_id;
      END IF;

      v_saldo_depois := v_saldo_antes - 1;

      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

      UPDATE public.produtos 
      SET estoque_zonas = v_estoque_zonas
      WHERE id = p_produto_trocado_id;

      INSERT INTO public.trocas (
        id,
        cliente_nome,
        cliente_telefone,
        data_troca,
        vape_defeito,
        sabor_defeito,
        motivo,
        motivo_detalhes,
        vape_trocado,
        sabor_trocado,
        produto_trocado_id,
        zona,
        abateu_estoque,
        status,
        observacoes
      ) VALUES (
        v_troca_id,
        p_cliente_nome,
        p_cliente_telefone,
        p_data_troca,
        p_vape_defeito,
        p_sabor_defeito,
        p_motivo,
        p_motivo_detalhes,
        p_vape_trocado,
        p_sabor_trocado,
        p_produto_trocado_id,
        v_zona_id,
        p_abater_estoque,
        'concluida',
        p_observacoes
      );

      INSERT INTO public.movimentos_estoque (
        produto_id,
        zona,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        troca_id,
        usuario,
        motivo
      ) VALUES (
        p_produto_trocado_id,
        v_zona_id,
        v_chave_sabor,
        -1,
        v_saldo_antes,
        v_saldo_depois,
        'troca',
        v_troca_id,
        v_usuario,
        'troca_cliente'
      );

      PERFORM recalcular_estoque_produto(p_produto_trocado_id);

      RETURN jsonb_build_object(
        'success', true,
        'troca_id', v_troca_id,
        'abateu_estoque', true,
        'status', 'concluida'
      );
    END IF;
  END IF;

  INSERT INTO public.trocas (
    id,
    cliente_nome,
    cliente_telefone,
    data_troca,
    vape_defeito,
    sabor_defeito,
    motivo,
    motivo_detalhes,
    vape_trocado,
    sabor_trocado,
    produto_trocado_id,
    zona,
    abateu_estoque,
    status,
    observacoes
  ) VALUES (
    v_troca_id,
    p_cliente_nome,
    p_cliente_telefone,
    p_data_troca,
    p_vape_defeito,
    p_sabor_defeito,
    p_motivo,
    p_motivo_detalhes,
    p_vape_trocado,
    p_sabor_trocado,
    p_produto_trocado_id,
    v_zona_id,
    p_abater_estoque,
    'concluida',
    p_observacoes
  );

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', v_troca_id,
    'abateu_estoque', false,
    'status', 'concluida'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_troca TO authenticated;

CREATE OR REPLACE FUNCTION public.estornar_troca(
  p_troca_id UUID,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_troca RECORD;
  v_zona_id VARCHAR(50);
  v_mov_agrupado RECORD;
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  SELECT * INTO v_troca 
  FROM public.trocas 
  WHERE id = p_troca_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de troca não encontrado: %', p_troca_id;
  END IF;

  v_zona_id := public.resolver_zona_id(COALESCE(v_troca.zona::text, 'recife'));
  IF v_zona_id = 'norte' AND v_troca.abateu_estoque = true THEN
    RAISE EXCEPTION 'Trocas da Zona Norte com abatimento de estoque devem ser canceladas através de estornar_troca_zona_norte.';
  END IF;

  IF v_troca.status = 'cancelada' THEN
    RAISE EXCEPTION 'Registro de troca já se encontra cancelado.';
  END IF;

  IF v_troca.abateu_estoque = true THEN
    FOR v_mov_agrupado IN 
      SELECT 
        produto_id, 
        zona, 
        sabor, 
        -SUM(delta) AS qtd_repor
      FROM public.movimentos_estoque 
      WHERE troca_id = p_troca_id
      GROUP BY produto_id, zona, sabor
      HAVING -SUM(delta) > 0
    LOOP
      SELECT * INTO v_produto 
      FROM public.produtos 
      WHERE id = v_mov_agrupado.produto_id 
      FOR UPDATE;

      IF FOUND THEN
        v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
        v_sabores_zona := COALESCE(v_estoque_zonas->v_mov_agrupado.zona->'sabores_estoque', '{}'::jsonb);

        v_saldo_antes := COALESCE((v_sabores_zona->>v_mov_agrupado.sabor)::int, 0);
        v_saldo_depois := v_saldo_antes + v_mov_agrupado.qtd_repor;

        v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_mov_agrupado.sabor], to_jsonb(v_saldo_depois));
        v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_mov_agrupado.zona, 'sabores_estoque'], v_sabores_zona);

        UPDATE public.produtos 
        SET estoque_zonas = v_estoque_zonas
        WHERE id = v_mov_agrupado.produto_id;

        INSERT INTO public.movimentos_estoque (
          produto_id,
          zona,
          sabor,
          delta,
          saldo_antes,
          saldo_depois,
          tipo,
          troca_id,
          usuario,
          motivo
        ) VALUES (
          v_mov_agrupado.produto_id,
          v_mov_agrupado.zona,
          v_mov_agrupado.sabor,
          v_mov_agrupado.qtd_repor,
          v_saldo_antes,
          v_saldo_depois,
          'troca_estorno',
          p_troca_id,
          v_usuario,
          'cancelamento_troca'
        );

        PERFORM recalcular_estoque_produto(v_mov_agrupado.produto_id);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.trocas 
  SET status = 'cancelada' 
  WHERE id = p_troca_id;

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', p_troca_id,
    'status', 'cancelada'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.estornar_troca TO authenticated;

-- 9.4 Atualizar criar_pedido_catalogo:
-- QUANDO zona = 'norte', VALIDA EXCLUSIVAMENTE NA TABELA estoque_zona_norte (NUNCA EM RECIFE)
CREATE OR REPLACE FUNCTION public.criar_pedido_catalogo(
  p_nome_cliente TEXT,
  p_telefone_cliente TEXT,
  p_indicacao TEXT,
  p_zona TEXT,
  p_itens JSONB,
  p_total NUMERIC DEFAULT 0,
  p_desconto NUMERIC DEFAULT 0,
  p_total_final NUMERIC DEFAULT 0,
  p_notas TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido_id UUID := gen_random_uuid();
  v_numero_pedido INT;
  v_zona_id VARCHAR(50);
  v_item JSONB;
  v_prod_id UUID;
  v_sabor_solicitado TEXT;
  v_qtd INT;
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_disponivel INT;
  v_preco_unitario NUMERIC(10,2);
  v_item_total NUMERIC(10,2);
  v_total_recalculado NUMERIC(10,2) := 0;
  v_desconto_aplicado NUMERIC(10,2);
  v_total_final_calculado NUMERIC(10,2);
  v_itens_higienizados JSONB := '[]'::jsonb;
BEGIN
  IF p_nome_cliente IS NULL OR TRIM(p_nome_cliente) = '' THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório.';
  END IF;

  IF p_telefone_cliente IS NULL OR TRIM(p_telefone_cliente) = '' THEN
    RAISE EXCEPTION 'WhatsApp do cliente é obrigatório.';
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O pedido deve conter pelo menos um item.';
  END IF;

  v_zona_id := public.resolver_zona_id(COALESCE(p_zona::text, 'recife'));

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := (v_item->>'quantidade')::INT;

    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Item "%" possui quantidade inválida (% un). A quantidade deve ser um número inteiro maior que zero.',
        COALESCE(v_item->>'nome', 'Item'), COALESCE(v_qtd, 0);
    END IF;

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_prod_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado: %', v_prod_id;
    END IF;

    IF v_produto.ativo = false THEN
      RAISE EXCEPTION 'O produto "%" está indisponível para pedidos no momento.', v_produto.nome;
    END IF;

    IF v_produto.is_promo AND v_produto.preco_promo IS NOT NULL AND v_produto.preco_promo > 0 THEN
      v_preco_unitario := v_produto.preco_promo;
    ELSE
      v_preco_unitario := v_produto.preco;
    END IF;

    v_item_total := v_preco_unitario * v_qtd;
    v_total_recalculado := v_total_recalculado + v_item_total;

    -- Validação de estoque para produtos normais (não ilimitados)
    IF NOT v_produto.estoque_ilimitado THEN
      IF v_zona_id = 'norte' THEN
        -- BLINDAGEM OBRIGATÓRIA: Valida EXCLUSIVAMENTE na tabela estoque_zona_norte
        SELECT sabor, quantidade INTO v_chave_sabor, v_saldo_disponivel
        FROM public.estoque_zona_norte
        WHERE produto_id = v_prod_id
          AND (sabor = v_sabor_solicitado OR public.normalizar_sabor(sabor) = public.normalizar_sabor(v_sabor_solicitado))
        LIMIT 1;

        IF v_chave_sabor IS NULL THEN
          RAISE EXCEPTION 'Sabor "%" esgotado ou indisponível na Zona Norte para o produto "%".', 
            v_sabor_solicitado, v_produto.nome;
        END IF;

        IF v_saldo_disponivel < v_qtd THEN
          RAISE EXCEPTION 'Estoque insuficiente na Zona Norte para o produto "%" (Sabor: "%"). Disponível: %, Solicitado: %.',
            v_produto.nome, v_chave_sabor, v_saldo_disponivel, v_qtd;
        END IF;
      ELSE
        -- Validação no estoque_zonas legado (Recife / Sul_Oeste)
        v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

        IF NOT (v_estoque_zonas ? v_zona_id) THEN
          IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
            v_zona_id := 'sul_oeste';
          ELSE
            RAISE EXCEPTION 'O produto "%" não possui estoque configurado para a região selecionada ("%").', 
              v_produto.nome, v_zona_id;
          END IF;
        END IF;

        v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
        v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);

        IF v_chave_sabor IS NULL THEN
          RAISE EXCEPTION 'Sabor "%" esgotado ou indisponível para o produto "%" na região "%".', 
            v_sabor_solicitado, v_produto.nome, v_zona_id;
        END IF;

        v_saldo_disponivel := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

        IF v_saldo_disponivel < v_qtd THEN
          RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%", Região: "%"). Saldo disponível: %, Solicitado: %.',
            v_produto.nome, v_chave_sabor, v_zona_id, v_saldo_disponivel, v_qtd;
        END IF;
      END IF;
    ELSE
      v_chave_sabor := v_sabor_solicitado;
    END IF;

    v_itens_higienizados := v_itens_higienizados || jsonb_build_array(
      jsonb_build_object(
        'id', v_prod_id,
        'marca', v_produto.marca,
        'nome', v_produto.nome,
        'sabor', COALESCE(v_chave_sabor, v_sabor_solicitado),
        'quantidade', v_qtd,
        'preco_unitario', v_preco_unitario,
        'total', v_item_total,
        'is_promo', COALESCE(v_produto.is_promo, false)
      )
    );
  END LOOP;

  v_desconto_aplicado := GREATEST(0, COALESCE(p_desconto, 0));
  IF v_desconto_aplicado > v_total_recalculado THEN
    v_desconto_aplicado := v_total_recalculado;
  END IF;

  v_total_final_calculado := GREATEST(0, v_total_recalculado - v_desconto_aplicado);

  SELECT COALESCE(MAX(numero_pedido), 1000) + 1 INTO v_numero_pedido FROM public.pedidos;

  INSERT INTO public.pedidos (
    id,
    numero_pedido,
    nome_cliente,
    telefone_cliente,
    indicacao,
    zona,
    itens,
    total,
    desconto,
    total_final,
    status_checklist,
    notas,
    excluido
  ) VALUES (
    v_pedido_id,
    v_numero_pedido,
    TRIM(p_nome_cliente),
    TRIM(p_telefone_cliente),
    TRIM(COALESCE(p_indicacao, '')),
    v_zona_id,
    v_itens_higienizados,
    v_total_recalculado,
    v_desconto_aplicado,
    v_total_final_calculado,
    false,
    TRIM(COALESCE(p_notas, '')),
    false
  );

  RETURN jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'nome_cliente', TRIM(p_nome_cliente),
    'telefone_cliente', TRIM(p_telefone_cliente),
    'zona', v_zona_id,
    'total', v_total_recalculado,
    'desconto', v_desconto_aplicado,
    'total_final', v_total_final_calculado,
    'status_checklist', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_pedido_catalogo(TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;

-- Sobrecarga de compatibilidade para chamadas via RPC com payload { dados: { ... } }
CREATE OR REPLACE FUNCTION public.criar_pedido_catalogo(dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN public.criar_pedido_catalogo(
    p_nome_cliente => (dados->>'nome_cliente'),
    p_telefone_cliente => (dados->>'telefone_cliente'),
    p_indicacao => (dados->>'indicacao'),
    p_zona => (dados->>'zona'),
    p_itens => (dados->'itens'),
    p_total => COALESCE((dados->>'total')::numeric, 0),
    p_desconto => COALESCE((dados->>'desconto')::numeric, 0),
    p_total_final => COALESCE((dados->>'total_final')::numeric, 0),
    p_notas => COALESCE((dados->>'notas'), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_pedido_catalogo(JSONB) TO anon, authenticated;

-- =========================================================================
-- 10. REVOGAÇÃO DE PRIVILÉGIOS PÚBLICOS E ANON (BLINDAGEM DE SEGURANÇA)
-- =========================================================================
-- Assegura que nenhuma das RPCs administrativas possa ser invocada por anon/PUBLIC
REVOKE EXECUTE ON FUNCTION public.ajustar_estoque_zona_norte(UUID, TEXT, TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.baixar_estoque_zona_norte(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.estornar_estoque_zona_norte(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.estornar_troca_zona_norte(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_troca_zona_norte(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;

-- Blindagem adicional de segurança: fechar privilégio padrão de PUBLIC/anon nas funções legadas
REVOKE EXECUTE ON FUNCTION public.baixar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.estornar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_troca(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.estornar_troca(UUID, TEXT) FROM PUBLIC, anon;

-- 11. Recarregar cache de schema do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';

