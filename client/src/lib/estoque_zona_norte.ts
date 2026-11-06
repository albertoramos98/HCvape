// =========================================================================
// HC VAPE - SERVIÇO DE ESTOQUE DEDICADO E EXCLUSIVO DA ZONA NORTE
// Tabela física: estoque_zona_norte | Auditoria: movimentos_estoque_zona_norte
// Totalmente isolado do estoque legado (produtos.estoque_zonas)
// =========================================================================

import { supabase } from './supabase';
import type { Troca } from './supabase';
import { normalizarNomeSabor, casarSabor } from './estoque';

export interface ItemEstoqueZonaNorte {
  id?: string;
  produto_id: string;
  sabor: string;
  quantidade: number;
  created_at?: string;
  updated_at?: string;
}

export interface MovimentoEstoqueZonaNorte {
  id: string;
  produto_id: string;
  sabor: string;
  delta: number;
  saldo_antes: number;
  saldo_depois: number;
  tipo: 'venda' | 'estorno' | 'ajuste' | 'troca' | 'troca_estorno' | 'contagem_inicial';
  pedido_id?: string | null;
  troca_id?: string | null;
  usuario?: string | null;
  motivo?: string | null;
  created_at: string;
}

export const estoqueZonaNorteService = {
  /**
   * Obtém todo o estoque cadastrado na Zona Norte
   */
  async obterTodos(): Promise<ItemEstoqueZonaNorte[]> {
    const { data, error } = await supabase
      .from('estoque_zona_norte')
      .select('*')
      .order('sabor', { ascending: true });

    if (error) {
      console.error('Erro ao buscar estoque da Zona Norte:', error);
      throw error;
    }

    return (data || []).map(row => ({
      ...row,
      quantidade: Number(row.quantidade) || 0
    }));
  },

  /**
   * Obtém os itens de um produto específico na Zona Norte
   */
  async obterPorProduto(produtoId: string): Promise<ItemEstoqueZonaNorte[]> {
    const { data, error } = await supabase
      .from('estoque_zona_norte')
      .select('*')
      .eq('produto_id', produtoId)
      .order('sabor', { ascending: true });

    if (error) {
      console.error(`Erro ao buscar estoque da Zona Norte para o produto ${produtoId}:`, error);
      throw error;
    }

    return (data || []).map(row => ({
      ...row,
      quantidade: Number(row.quantidade) || 0
    }));
  },

  /**
   * Ajusta quantidade física ou delta na Zona Norte via RPC atômica
   */
  async ajustarEstoque(
    produtoId: string,
    sabor: string,
    operacao: 'definir' | 'delta',
    valor: number,
    motivo: string = 'ajuste_manual',
    usuario?: string
  ): Promise<any> {
    const { data, error } = await supabase.rpc('ajustar_estoque_zona_norte', {
      p_produto_id: produtoId,
      p_sabor: sabor,
      p_operacao: operacao,
      p_valor: valor,
      p_motivo: motivo,
      p_usuario: usuario || null
    });

    if (error) {
      console.error('Erro ao ajustar estoque da Zona Norte:', error);
      throw error;
    }

    return data;
  },

  /**
   * Baixa atômica de pedido na Zona Norte via RPC
   */
  async baixarEstoque(pedidoId: string, usuario?: string): Promise<any> {
    const { data, error } = await supabase.rpc('baixar_estoque_zona_norte', {
      p_pedido_id: pedidoId,
      p_usuario: usuario || null
    });

    if (error) {
      console.error('Erro na baixa de estoque da Zona Norte:', error);
      throw error;
    }

    return data;
  },

  /**
   * Estorno simétrico de pedido na Zona Norte via RPC
   */
  async estornarEstoque(pedidoId: string, usuario?: string): Promise<any> {
    const { data, error } = await supabase.rpc('estornar_estoque_zona_norte', {
      p_pedido_id: pedidoId,
      p_usuario: usuario || null
    });

    if (error) {
      console.error('Erro no estorno de estoque da Zona Norte:', error);
      throw error;
    }

    return data;
  },

  /**
   * Registra troca com baixa opcional na Zona Norte via RPC
   */
  async registrarTroca(troca: Omit<Troca, 'id' | 'created_at' | 'updated_at'>): Promise<Troca> {
    const { data, error } = await supabase.rpc('registrar_troca_zona_norte', {
      p_cliente_nome: troca.cliente_nome,
      p_cliente_telefone: troca.cliente_telefone || null,
      p_vape_defeito: troca.vape_defeito,
      p_sabor_defeito: troca.sabor_defeito || null,
      p_motivo: troca.motivo,
      p_motivo_detalhes: troca.motivo_detalhes || null,
      p_vape_trocado: troca.vape_trocado,
      p_sabor_trocado: troca.sabor_trocado || null,
      p_produto_trocado_id: troca.produto_trocado_id || null,
      p_abater_estoque: !!troca.abateu_estoque,
      p_observacoes: troca.observacoes || null,
      p_data_troca: troca.data_troca || new Date().toISOString()
    });

    if (error) {
      console.error('Erro ao registrar troca na Zona Norte:', error);
      throw error;
    }

    return {
      id: data?.troca_id,
      ...troca,
      zona: 'norte',
      status: 'concluida'
    };
  },

  /**
   * Estorna troca cancelada na Zona Norte via RPC
   */
  async estornarTroca(trocaId: string, usuario?: string): Promise<any> {
    const { data, error } = await supabase.rpc('estornar_troca_zona_norte', {
      p_troca_id: trocaId,
      p_usuario: usuario || null
    });

    if (error) {
      console.error('Erro ao estornar troca na Zona Norte:', error);
      throw error;
    }

    return data;
  },

  /**
   * Consulta histórico de movimentações da Zona Norte
   */
  async obterMovimentos(produtoId?: string, limite: number = 50): Promise<MovimentoEstoqueZonaNorte[]> {
    let query = supabase
      .from('movimentos_estoque_zona_norte')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);

    if (produtoId) {
      query = query.eq('produto_id', produtoId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao obter histórico da Zona Norte:', error);
      throw error;
    }

    return data || [];
  }
};

