import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Nome do bucket de imagens no Supabase Storage
const BUCKET_IMAGENS = 'produto-imagens';

export * from './estoque';
import type { 
  ZonaId, 
  EstoqueZona, 
  EstoqueZonasMap 
} from './estoque';
import { 
  ZONAS_DISPONIVEIS, 
  obterEstoqueProdutoPorZona as obterEstoqueCentralizado,
  normalizarNomeSabor,
  casarSabor,
  normalizarZonaId as normalizarZonaIdShared
} from './estoque';

// Tipos para o banco de dados
export interface Produto {
  id: string;
  marca: string;
  nome: string;
  preco: number;
  estoque: number;
  sabores: string[];
  sabores_estoque?: { [sabor: string]: number } | null;
  zonas?: string[] | null;
  estoque_zonas?: EstoqueZonasMap | null;
  estoque_ilimitado?: boolean;
  is_promo?: boolean;
  preco_promo?: number;
  imagem_url?: string | null;
  ativo?: boolean; // Controle de ativação/visibilidade (especialmente vapes promocionais)
  created_at?: string;
  updated_at?: string;
}

export interface PedidoItem {
  id: string;
  marca?: string;
  nome: string;
  sabor: string;
  quantidade: number;
  preco_unitario: number;
  is_promo?: boolean;
}

export interface Pedido {
  id: string;
  numero_pedido: number;
  nome_cliente: string;
  telefone_cliente: string;
  zona?: string;
  itens: PedidoItem[];
  total: number;
  desconto: number;
  total_final: number;
  status_checklist: boolean;
  indicacao?: string;
  notas?: string;
  excluido?: boolean;
  created_at?: string;
}

export interface Troca {
  id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  data_troca: string;
  vape_defeito: string;
  sabor_defeito?: string;
  motivo: string;
  motivo_detalhes?: string;
  vape_trocado: string;
  sabor_trocado?: string;
  produto_trocado_id?: string;
  zona?: string;
  abateu_estoque?: boolean;
  status?: 'concluida' | 'pendente' | 'cancelada';
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  telefone_normalizado: string;
  data_primeiro_contato: string;
  data_ultimo_contato: string;
  total_interacoes: number;
  total_pedidos: number;
  valor_total_gasto: number;
  zona_frequente?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InteracaoCliente {
  id: string;
  cliente_id?: string;
  cliente_telefone_normalizado: string;
  tipo: 'pedido' | 'contato_whatsapp' | 'troca' | 'duvida' | 'outro';
  descricao: string;
  valor?: number;
  referencia_id?: string;
  detalhes?: any;
  data_interacao: string;
  created_at?: string;
}

export interface ClienteRelatorio {
  cliente: Cliente;
  interacoes_no_periodo: number;
  pedidos_no_periodo: number;
  valor_total_no_periodo: number;
  primeiro_contato_periodo: string;
  ultimo_contato_periodo: string;
  interacoes: InteracaoCliente[];
}

export interface Visita {
  id: string;
  created_at: string;
  user_agent: string;
  path: string;
}

export interface PromoSchedule {
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string;
}

export interface HeroSlideConfig {
  id: string;
  ativo: boolean;
  badge: {
    texto: string;
    cor: 'red' | 'green' | 'blue';
    aoVivoBadge?: boolean;
  };
  titulo: string;
  tituloDestaque: string;
  descricao: string;
  tipoDestaque: 'produto_promo' | 'produto_especifico' | 'custom' | 'nenhum';
  produtoDestaqueId?: string | null;
  customImagemUrl?: string | null;
  customTitulo?: string | null;
  customSubtitulo?: string | null;
  botaoTexto: string;
  botaoAcao: 'expressos' | 'promocionais' | 'url';
  botaoUrl?: string | null;
}

export interface HeroBannerConfig {
  slides: HeroSlideConfig[];
}

export const DEFAULT_HERO_BANNER_CONFIG: HeroBannerConfig = {
  slides: [
    {
      id: "slide_promo",
      ativo: true,
      badge: {
        texto: "OFERTAS RELÂMPAGO",
        cor: "red",
        aoVivoBadge: true
      },
      titulo: "Super Preços &",
      tituloDestaque: "Promoções Especiais",
      descricao: "Garanta os pods com os melhores descontos do dia. Quantidades limitadas por horário!",
      tipoDestaque: "produto_promo",
      botaoTexto: "Ver Ofertas Promocionais",
      botaoAcao: "promocionais"
    },
    {
      id: "slide_novidades",
      ativo: true,
      badge: {
        texto: "NOVIDADES DO CATÁLOGO",
        cor: "green",
        aoVivoBadge: false
      },
      titulo: "Os Modelos Mais Vendidos",
      tituloDestaque: "Pronta Entrega Express",
      descricao: "Linha completa com os melhores sabores e marcas premium selecionadas especialmente para você.",
      tipoDestaque: "produto_especifico",
      botaoTexto: "Ver Catálogo Expresso",
      botaoAcao: "expressos"
    },
    {
      id: "slide_qualidade",
      ativo: true,
      badge: {
        texto: "HC VAPE • DESDE 2020",
        cor: "blue",
        aoVivoBadge: false
      },
      titulo: "Garantia de Qualidade &",
      tituloDestaque: "Atendimento Direto",
      descricao: "Faça seu pedido diretamente pelo site e receba a confirmação no seu WhatsApp. Praticidade e rapidez na entrega!",
      tipoDestaque: "custom",
      customTitulo: "100%",
      customSubtitulo: "PRODUTOS SELECIONADOS",
      botaoTexto: "Entenda Como Funciona",
      botaoAcao: "url",
      botaoUrl: "/como-funciona"
    }
  ]
};

// Funções auxiliares
export const produtosService = {
  // Obter lista de IDs de produtos desativados (fallback caso a coluna "ativo" não exista no banco)
  async obterIdsInativos(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'produtos_inativos')
        .single();
      if (!error && data?.valor && Array.isArray(data.valor)) {
        localStorage.setItem('hcvape_produtos_inativos', JSON.stringify(data.valor));
        return data.valor as string[];
      }
    } catch {
      // Falha silenciosa se a tabela configuracoes não existir
    }
    const local = localStorage.getItem('hcvape_produtos_inativos');
    return local ? JSON.parse(local) : [];
  },

  // Salvar lista de IDs desativados
  async salvarIdsInativos(ids: string[]): Promise<void> {
    localStorage.setItem('hcvape_produtos_inativos', JSON.stringify(ids));
    try {
      await supabase.from('configuracoes').upsert({
        chave: 'produtos_inativos',
        valor: ids,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Não foi possível sincronizar produtos_inativos na tabela configuracoes:', e);
    }
  },

  // Buscar todos os produtos
  async obterTodos(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('marca', { ascending: true });

    if (error) throw error;
    const produtos = (data || []) as Produto[];

    try {
      const inativos = await this.obterIdsInativos();
      const setInativos = new Set(inativos);

      return produtos.map(p => ({
        ...p,
        ativo: p.ativo !== undefined && p.ativo !== null ? p.ativo : !setInativos.has(p.id)
      }));
    } catch {
      return produtos;
    }
  },

  // Buscar produtos por marca
  async obterPorMarca(marca: string): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('marca', marca)
      .order('nome', { ascending: true });

    if (error) throw error;
    const produtos = (data || []) as Produto[];

    try {
      const inativos = await this.obterIdsInativos();
      const setInativos = new Set(inativos);

      return produtos.map(p => ({
        ...p,
        ativo: p.ativo !== undefined && p.ativo !== null ? p.ativo : !setInativos.has(p.id)
      }));
    } catch {
      return produtos;
    }
  },

  // Ajustar estoque via RPC atômica (fonte única estoque_zonas + movimentos_estoque)
  async ajustarEstoque(
    produtoId: string, 
    zona: string, 
    sabor: string, 
    novaQtd: number, 
    motivo: string = 'ajuste_manual', 
    usuario?: string
  ): Promise<any> {
    const { data, error } = await supabase.rpc('ajustar_estoque', {
      p_produto_id: produtoId,
      p_zona: zona,
      p_sabor: sabor,
      p_nova_qtd: novaQtd,
      p_motivo: motivo,
      p_usuario: usuario || null
    });
    if (error) throw error;
    return data;
  },

  // Atualizar estoque total (legado)
  async atualizarEstoque(id: string, novoEstoque: number): Promise<void> {
    const { error } = await supabase
      .from('produtos')
      .update({ estoque: novoEstoque, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  // Atualizar estoque por sabores e total (legado)
  async atualizarEstoqueSabores(id: string, saboresEstoque: { [sabor: string]: number }, estoqueTotal: number): Promise<void> {
    const { error } = await supabase
      .from('produtos')
      .update({ 
        sabores_estoque: saboresEstoque, 
        estoque: estoqueTotal, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Criar novo produto
  async criar(produto: Omit<Produto, 'id' | 'created_at' | 'updated_at'>): Promise<Produto> {
    // Tentar criar com todos os campos
    try {
      const { data, error } = await supabase
        .from('produtos')
        .insert([produto])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      // Se coluna "ativo" não existir no banco (código 42703), tenta sem ela
      if (err.code === '42703' || err.message?.includes('ativo')) {
        const { ativo, ...produtoSemAtivo } = produto;
        const { data, error: errSemAtivo } = await supabase
          .from('produtos')
          .insert([produtoSemAtivo])
          .select()
          .single();

        if (errSemAtivo) throw errSemAtivo;
        return { ...data, ativo: ativo !== false };
      }
      throw err;
    }
  },

  // Deletar produto
  async deletar(id: string): Promise<void> {
    // Buscar produto para obter imagem_url antes de deletar
    const { data: produto } = await supabase
      .from('produtos')
      .select('imagem_url')
      .eq('id', id)
      .single();

    // Se tiver imagem, deletar do Storage também
    if (produto?.imagem_url) {
      const path = imagemService.extrairCaminhoDoUrl(produto.imagem_url);
      if (path) {
        try {
          await imagemService.deletar(path);
        } catch {
          console.warn('Não foi possível deletar imagem do produto');
        }
      }
    }

    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Editar produto com tolerância à coluna ativo
  async editar(id: string, updates: Partial<Omit<Produto, 'id' | 'created_at'>>): Promise<Produto> {
    // Se estiver atualizando o status de ativação, salvar no fallback de IDs inativos também
    if (updates.ativo !== undefined) {
      try {
        const inativos = await this.obterIdsInativos();
        const setInativos = new Set(inativos);
        if (updates.ativo === false) {
          setInativos.add(id);
        } else {
          setInativos.delete(id);
        }
        await this.salvarIdsInativos(Array.from(setInativos));
      } catch (errFallback) {
        console.warn('Erro ao atualizar fallback de produtos_inativos:', errFallback);
      }
    }

    // Tentar atualizar normalmente na tabela produtos
    try {
      const { data, error } = await supabase
        .from('produtos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      // Se a coluna "ativo" não existir na tabela produtos (PostgreSQL erro 42703)
      if (err.code === '42703' || err.message?.includes('ativo') || err.message?.includes('column "ativo" of relation "produtos" does not exist')) {
        const { ativo, ...outrosUpdates } = updates;
        if (Object.keys(outrosUpdates).length > 0) {
          const { data, error: errSemAtivo } = await supabase
            .from('produtos')
            .update({ ...outrosUpdates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

          if (errSemAtivo) throw errSemAtivo;
          return { ...data, ativo: updates.ativo };
        }
        // Se a alteração era exclusivamente o campo "ativo", retorna com sucesso
        return { id, ativo: updates.ativo } as any;
      }
      throw err;
    }
  },
};

export const pedidosService = {
  // Buscar todos os pedidos ativos
  async obterTodos(): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .or('excluido.is.null,excluido.eq.false')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Buscar todos os pedidos excluídos (Lixeira)
  async obterExcluidos(): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('excluido', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Criar novo pedido (utiliza RPC seguro para evitar exposição de leitura de pedidos)
  async criar(pedido: Omit<Pedido, 'id' | 'numero_pedido' | 'created_at' | 'excluido'>): Promise<Pedido> {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('criar_pedido_catalogo', {
        dados: { ...pedido, excluido: false }
      });
      if (!rpcError && rpcData) {
        return rpcData as Pedido;
      }
    } catch {
      // Fallback para inserção direta se a RPC ainda não tiver sido criada no Supabase
    }

    const { data, error } = await supabase
      .from('pedidos')
      .insert([{ ...pedido, excluido: false }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Baixar estoque de pedido via RPC atômica e idempotente
  async baixarEstoque(pedidoId: string, usuario?: string): Promise<any> {
    const { data, error } = await supabase.rpc('baixar_estoque_pedido', {
      p_pedido_id: pedidoId,
      p_usuario: usuario || null
    });
    if (error) throw error;
    return data;
  },

  // Estornar estoque de pedido via RPC atômica e simétrica
  async estornarEstoque(pedidoId: string, usuario?: string): Promise<any> {
    const { data, error } = await supabase.rpc('estornar_estoque_pedido', {
      p_pedido_id: pedidoId,
      p_usuario: usuario || null
    });
    if (error) throw error;
    return data;
  },

  // Atualizar status checklist (legado direto)
  async atualizarStatus(id: string, status: boolean): Promise<void> {
    const { error } = await supabase
      .from('pedidos')
      .update({ status_checklist: status })
      .eq('id', id);

    if (error) throw error;
  },

  // Atualizar financeiro (desconto e total final)
  async atualizarFinanceiro(id: string, desconto: number, totalFinal: number): Promise<void> {
    const { error } = await supabase
      .from('pedidos')
      .update({ desconto, total_final: totalFinal })
      .eq('id', id);

    if (error) throw error;
  },

  // Mover para lixeira (soft delete)
  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from('pedidos')
      .update({ excluido: true })
      .eq('id', id);

    if (error) throw error;
  },

  // Restaurar da lixeira
  async restaurar(id: string): Promise<void> {
    const { error } = await supabase
      .from('pedidos')
      .update({ excluido: false })
      .eq('id', id);

    if (error) throw error;
  },
};

// Serviço de Trocas e Garantia
export const trocasService = {
  // Obter trocas do fallback local caso a tabela ainda não exista no Supabase
  obterDoLocalStorage(): Troca[] {
    try {
      const local = localStorage.getItem('hcvape_trocas_registros');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  salvarNoLocalStorage(trocas: Troca[]): void {
    try {
      localStorage.setItem('hcvape_trocas_registros', JSON.stringify(trocas));
    } catch (e) {
      console.warn('Erro ao salvar trocas no localStorage:', e);
    }
  },

  // Obter todas as trocas
  async obterTodas(): Promise<{ trocas: Troca[]; usandoFallback: boolean }> {
    try {
      const { data, error } = await supabase
        .from('trocas')
        .select('*')
        .order('data_troca', { ascending: false });

      if (error) throw error;
      const lista = (data || []) as Troca[];
      this.salvarNoLocalStorage(lista);
      return { trocas: lista, usandoFallback: false };
    } catch (err: any) {
      console.warn('Tabela trocas não acessível no Supabase, usando armazenamento local:', err);
      const local = this.obterDoLocalStorage();
      return { trocas: local, usandoFallback: true };
    }
  },

  // Criar nova troca (utiliza RPC atômica registrar_troca para integridade de estoque)
  async criar(troca: Omit<Troca, 'id' | 'created_at' | 'updated_at'>, usuario?: string): Promise<Troca> {
    try {
      const { data, error } = await supabase.rpc('registrar_troca', {
        p_dados: troca,
        p_usuario: usuario || null
      });

      if (!error && data) {
        const salva = data as Troca;
        const locais = this.obterDoLocalStorage();
        this.salvarNoLocalStorage([salva, ...locais.filter(t => t.id !== salva.id)]);
        return salva;
      }
    } catch (err) {
      console.warn('Erro ao chamar RPC registrar_troca, tentando fallback direto:', err);
    }

    const { data, error } = await supabase
      .from('trocas')
      .insert([{
        ...troca,
        status: troca.status || 'concluida'
      }])
      .select()
      .single();

    if (error) throw error;
    
    const locais = this.obterDoLocalStorage();
    this.salvarNoLocalStorage([data as Troca, ...locais.filter(t => t.id !== (data as any).id)]);
    return data as Troca;
  },

  // Atualizar troca existente (NUNCA altera estoque)
  async atualizar(id: string, updates: Partial<Omit<Troca, 'id' | 'created_at'>>): Promise<Troca> {
    try {
      const { data, error } = await supabase
        .from('trocas')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const locais = this.obterDoLocalStorage();
      this.salvarNoLocalStorage(locais.map(t => t.id === id ? (data as Troca) : t));
      return data as Troca;
    } catch (err) {
      console.warn('Atualizando troca no fallback:', err);
      const locais = this.obterDoLocalStorage();
      const atualizados = locais.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t);
      this.salvarNoLocalStorage(atualizados);

      const editada = atualizados.find(t => t.id === id);
      if (!editada) throw new Error('Troca não encontrada');
      return editada;
    }
  },

  // Deletar troca (utiliza RPC atômica estornar_troca para reverter estoque caso tenha abatido)
  async deletar(id: string, usuario?: string): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('estornar_troca', {
        p_troca_id: id,
        p_usuario: usuario || null
      });

      if (!error && data) {
        const locais = this.obterDoLocalStorage();
        this.salvarNoLocalStorage(locais.filter(t => t.id !== id));
        return;
      }
    } catch (err) {
      console.warn('Erro ao chamar RPC estornar_troca, tentando exclusão direta:', err);
    }

    const { error } = await supabase
      .from('trocas')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const locais = this.obterDoLocalStorage();
    const filtrados = locais.filter(t => t.id !== id);
    this.salvarNoLocalStorage(filtrados);
  }
};

// Normalização inteligente de WhatsApp / Telefone brasileiro
export function normalizarTelefoneWhatsApp(telefone: string, dddPadrao: string = '81'): string {
  if (!telefone) return '';
  // Remove caracteres não-numéricos
  let limpo = telefone.replace(/\D/g, '');

  // Remove zero inicial de DDD (ex: 081999999999 -> 81999999999)
  if (limpo.startsWith('0')) {
    limpo = limpo.substring(1);
  }

  // Se tem prefixo 55 (Brasil) e tamanho 12 ou 13
  if (limpo.startsWith('55') && (limpo.length === 12 || limpo.length === 13)) {
    const sem55 = limpo.substring(2);
    const ddd = sem55.substring(0, 2);
    let num = sem55.substring(2);
    // Adiciona o 9° dígito se for celular (8 dígitos começando com 6, 7, 8 ou 9)
    if (num.length === 8 && ['6', '7', '8', '9'].includes(num[0])) {
      num = '9' + num;
    }
    return `55${ddd}${num}`;
  }

  // Se tem DDD e número (10 ou 11 dígitos)
  if (limpo.length === 10 || limpo.length === 11) {
    const ddd = limpo.substring(0, 2);
    let num = limpo.substring(2);
    if (num.length === 8 && ['6', '7', '8', '9'].includes(num[0])) {
      num = '9' + num;
    }
    return `55${ddd}${num}`;
  }

  // Se tem apenas 8 ou 9 dígitos (sem DDD, assume DDD padrão de Recife/PE 81)
  if (limpo.length === 8 || limpo.length === 9) {
    let num = limpo;
    if (num.length === 8 && ['6', '7', '8', '9'].includes(num[0])) {
      num = '9' + num;
    }
    return `55${dddPadrao}${num}`;
  }

  // Fallback para outros formatos
  if (limpo.length >= 8) {
    if (!limpo.startsWith('55') && limpo.length <= 11) {
      return `55${limpo}`;
    }
    return limpo;
  }

  return limpo;
}

// Formatação visual amigável do telefone (ex: (81) 99999-9999)
export function formatarTelefoneExibicao(telefone: string): string {
  if (!telefone) return '';
  const norm = normalizarTelefoneWhatsApp(telefone);
  if (norm.startsWith('55') && norm.length === 13) {
    const ddd = norm.substring(2, 4);
    const parte1 = norm.substring(4, 9);
    const parte2 = norm.substring(9, 13);
    return `(${ddd}) ${parte1}-${parte2}`;
  }
  if (norm.startsWith('55') && norm.length === 12) {
    const ddd = norm.substring(2, 4);
    const parte1 = norm.substring(4, 8);
    const parte2 = norm.substring(8, 12);
    return `(${ddd}) ${parte1}-${parte2}`;
  }
  return telefone;
}

// Serviço de Clientes & Histórico de Interações (Cadastro Único por WhatsApp)
export const clientesService = {
  // LocalStorage Fallback
  obterClientesLocalStorage(): Cliente[] {
    try {
      const local = localStorage.getItem('hcvape_clientes_cadastros');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  salvarClientesLocalStorage(clientes: Cliente[]): void {
    try {
      localStorage.setItem('hcvape_clientes_cadastros', JSON.stringify(clientes));
    } catch (e) {
      console.warn('Erro ao salvar clientes no localStorage:', e);
    }
  },

  obterInteracoesLocalStorage(): InteracaoCliente[] {
    try {
      const local = localStorage.getItem('hcvape_clientes_interacoes');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  salvarInteracoesLocalStorage(interacoes: InteracaoCliente[]): void {
    try {
      localStorage.setItem('hcvape_clientes_interacoes', JSON.stringify(interacoes));
    } catch (e) {
      console.warn('Erro ao salvar interações no localStorage:', e);
    }
  },

  // Obter todos os clientes únicos cadastrados
  async obterTodos(): Promise<{ clientes: Cliente[]; usandoFallback: boolean }> {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('data_ultimo_contato', { ascending: false });

      if (error) throw error;
      const lista = (data || []) as Cliente[];
      this.salvarClientesLocalStorage(lista);
      return { clientes: lista, usandoFallback: false };
    } catch (err) {
      console.warn('Tabela clientes não acessível no Supabase, usando armazenamento local:', err);
      const local = this.obterClientesLocalStorage();
      return { clientes: local, usandoFallback: true };
    }
  },

  // Obter todas as interações
  async obterInteracoes(clienteTelefoneNorm?: string): Promise<{ interacoes: InteracaoCliente[]; usandoFallback: boolean }> {
    try {
      let query = supabase
        .from('interacoes_cliente')
        .select('*')
        .order('data_interacao', { ascending: false });

      if (clienteTelefoneNorm) {
        query = query.eq('cliente_telefone_normalizado', clienteTelefoneNorm);
      }

      const { data, error } = await query;
      if (error) throw error;
      const lista = (data || []) as InteracaoCliente[];
      if (!clienteTelefoneNorm) {
        this.salvarInteracoesLocalStorage(lista);
      }
      return { interacoes: lista, usandoFallback: false };
    } catch (err) {
      console.warn('Tabela interacoes_cliente não acessível no Supabase, usando armazenamento local:', err);
      let locais = this.obterInteracoesLocalStorage();
      if (clienteTelefoneNorm) {
        locais = locais.filter(i => i.cliente_telefone_normalizado === clienteTelefoneNorm);
      }
      return { interacoes: locais, usandoFallback: true };
    }
  },

  // REGRA DE OURO: Registrar ou Atualizar cliente único por número de WhatsApp normalizado
  async registrarOuAtualizarCliente(dados: {
    nome: string;
    telefone: string;
    tipoInteracao?: 'pedido' | 'contato_whatsapp' | 'troca' | 'duvida' | 'outro';
    descricaoInteracao?: string;
    valor?: number;
    referenciaId?: string;
    detalhes?: any;
    zona?: string;
    data?: string;
  }): Promise<Cliente> {
    const nomeLimpo = (dados.nome || '').trim() || 'Cliente';
    const telefoneNorm = normalizarTelefoneWhatsApp(dados.telefone);
    const telefoneOriginal = dados.telefone.trim();
    const dataHora = dados.data || new Date().toISOString();
    const tipo = dados.tipoInteracao || 'contato_whatsapp';
    const valor = Number(dados.valor) || 0;
    const isPedido = tipo === 'pedido';

    if (!telefoneNorm) {
      throw new Error('Telefone do cliente é obrigatório para cadastro único.');
    }

    // 1. Tentar buscar cliente existente no banco Supabase
    let clienteExistente: Cliente | null = null;
    let usandoFallback = false;

    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefone_normalizado', telefoneNorm)
        .maybeSingle();

      if (!error && data) {
        clienteExistente = data as Cliente;
      }
    } catch (err) {
      usandoFallback = true;
    }

    if (!clienteExistente) {
      const locais = this.obterClientesLocalStorage();
      clienteExistente = locais.find(c => c.telefone_normalizado === telefoneNorm) || null;
    }

    const clienteId = clienteExistente?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cli_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

    let clienteSalvo: Cliente;

    if (clienteExistente) {
      // CLIENTE JÁ EXISTE: Preserva data_primeiro_contato, atualiza data_ultimo_contato e incrementa totais
      const updates = {
        nome: nomeLimpo.length > 2 && !nomeLimpo.toLowerCase().includes('cliente') ? nomeLimpo : clienteExistente.nome,
        telefone: telefoneOriginal || clienteExistente.telefone,
        data_ultimo_contato: dataHora,
        total_interacoes: (clienteExistente.total_interacoes || 0) + 1,
        total_pedidos: (clienteExistente.total_pedidos || 0) + (isPedido ? 1 : 0),
        valor_total_gasto: Number((Number(clienteExistente.valor_total_gasto || 0) + valor).toFixed(2)),
        zona_frequente: dados.zona || clienteExistente.zona_frequente,
        updated_at: new Date().toISOString()
      };

      try {
        const { data, error } = await supabase
          .from('clientes')
          .update(updates)
          .eq('id', clienteExistente.id)
          .select()
          .single();

        if (error) throw error;
        clienteSalvo = data as Cliente;
      } catch (err) {
        clienteSalvo = {
          ...clienteExistente,
          ...updates
        };
      }
    } else {
      // NOVO CLIENTE: Primeiro contato!
      const novoCliente: Cliente = {
        id: clienteId,
        nome: nomeLimpo,
        telefone: telefoneOriginal,
        telefone_normalizado: telefoneNorm,
        data_primeiro_contato: dataHora,
        data_ultimo_contato: dataHora,
        total_interacoes: 1,
        total_pedidos: isPedido ? 1 : 0,
        valor_total_gasto: valor,
        zona_frequente: dados.zona,
        created_at: dataHora,
        updated_at: dataHora
      };

      try {
        const { data, error } = await supabase
          .from('clientes')
          .insert([novoCliente])
          .select()
          .single();

        if (error) throw error;
        clienteSalvo = data as Cliente;
      } catch (err) {
        clienteSalvo = novoCliente;
      }
    }

    // Sincronizar no fallback local
    const locais = this.obterClientesLocalStorage();
    const outrosClientes = locais.filter(c => c.telefone_normalizado !== telefoneNorm);
    const atualizados = [clienteSalvo, ...outrosClientes];
    this.salvarClientesLocalStorage(atualizados);

    // Sincronizado apenas na tabela protegida clientes e cache local seguro

    // 2. Registrar histórico da Interação
    const interacaoId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const descricao = dados.descricaoInteracao || (isPedido ? `Pedido realizado (${dados.referenciaId ? '#' + dados.referenciaId : ''})` : `Contato via WhatsApp`);

    const novaInteracao: InteracaoCliente = {
      id: interacaoId,
      cliente_id: clienteSalvo.id,
      cliente_telefone_normalizado: telefoneNorm,
      tipo: tipo,
      descricao: descricao,
      valor: valor,
      referencia_id: dados.referenciaId,
      detalhes: dados.detalhes || {},
      data_interacao: dataHora,
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('interacoes_cliente').insert([novaInteracao]);
    } catch (err) {
      console.warn('Não foi possível salvar interação na tabela interacoes_cliente:', err);
    }

    const interacoesLocais = this.obterInteracoesLocalStorage();
    const interacoesAtualizadas = [novaInteracao, ...interacoesLocais];
    this.salvarInteracoesLocalStorage(interacoesAtualizadas);

    // Interação salva na tabela protegida interacoes_cliente e cache local seguro

    return clienteSalvo;
  },

  // Gerar relatório consolidado por período (SEM DUPLICIDADES!)
  async obterRelatorioPorPeriodo(dataInicioStr: string, dataFimStr: string): Promise<ClienteRelatorio[]> {
    const { clientes } = await this.obterTodos();
    const { interacoes } = await this.obterInteracoes();

    const dataInicio = new Date(dataInicioStr);
    const dataFim = new Date(dataFimStr);

    // Mapear interações no período por telefone_normalizado
    const mapaInteracoes: Record<string, InteracaoCliente[]> = {};

    interacoes.forEach(int => {
      const dataInt = new Date(int.data_interacao || int.created_at || '');
      if (isNaN(dataInt.getTime())) return;

      if (dataInt >= dataInicio && dataInt <= dataFim) {
        const norm = int.cliente_telefone_normalizado;
        if (!mapaInteracoes[norm]) {
          mapaInteracoes[norm] = [];
        }
        mapaInteracoes[norm].push(int);
      }
    });

    // Mapear também clientes cuja data_primeiro_contato ou data_ultimo_contato cai no período
    const clientesRelevantes = new Map<string, Cliente>();

    clientes.forEach(c => {
      const norm = c.telefone_normalizado;
      const temInteracao = !!mapaInteracoes[norm] && mapaInteracoes[norm].length > 0;
      
      const dPrimeiro = new Date(c.data_primeiro_contato);
      const dUltimo = new Date(c.data_ultimo_contato);
      const primeiroNoPeriodo = !isNaN(dPrimeiro.getTime()) && dPrimeiro >= dataInicio && dPrimeiro <= dataFim;
      const ultimoNoPeriodo = !isNaN(dUltimo.getTime()) && dUltimo >= dataInicio && dUltimo <= dataFim;

      if (temInteracao || primeiroNoPeriodo || ultimoNoPeriodo) {
        clientesRelevantes.set(norm, c);
      }
    });

    // Montar o relatório consolidado: CADA CLIENTE APARECE APENAS UMA VEZ
    const relatorio: ClienteRelatorio[] = [];

    clientesRelevantes.forEach((cli, norm) => {
      const ints = (mapaInteracoes[norm] || []).sort((a, b) => new Date(b.data_interacao).getTime() - new Date(a.data_interacao).getTime());
      
      const qtdInteracoes = ints.length > 0 ? ints.length : 1;
      const pedidos = ints.filter(i => i.tipo === 'pedido');
      const qtdPedidos = pedidos.length;
      const valorTotal = pedidos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

      const ultimoContato = ints.length > 0 ? ints[0].data_interacao : cli.data_ultimo_contato;
      const primeiroContato = ints.length > 0 ? ints[ints.length - 1].data_interacao : cli.data_primeiro_contato;

      relatorio.push({
        cliente: cli,
        interacoes_no_periodo: qtdInteracoes,
        pedidos_no_periodo: qtdPedidos,
        valor_total_no_periodo: valorTotal > 0 ? valorTotal : (qtdPedidos > 0 ? cli.valor_total_gasto : 0),
        primeiro_contato_periodo: primeiroContato,
        ultimo_contato_periodo: ultimoContato,
        interacoes: ints
      });
    });

    // Ordenar pelo último contato mais recente
    return relatorio.sort((a, b) => new Date(b.ultimo_contato_periodo).getTime() - new Date(a.ultimo_contato_periodo).getTime());
  },

  // Sincronizar pedidos e trocas existentes para a base única de clientes
  async sincronizarHistoricoExistente(pedidos: Pedido[], trocas: Troca[]): Promise<{ clientesCadastrados: number; interacoesCriadas: number }> {
    let clientesCadastrados = 0;
    let interacoesCriadas = 0;

    // 1. Processar pedidos (do mais antigo para o mais recente)
    const pedidosOrdenados = [...pedidos].sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());

    for (const ped of pedidosOrdenados) {
      if (!ped.telefone_cliente) continue;
      const dataPed = ped.created_at || new Date().toISOString();
      await this.registrarOuAtualizarCliente({
        nome: ped.nome_cliente,
        telefone: ped.telefone_cliente,
        tipoInteracao: 'pedido',
        descricaoInteracao: `Pedido #${ped.numero_pedido} - ${ped.itens?.length || 0} itens (${utils.formatarMoeda(ped.total_final)})`,
        valor: ped.total_final,
        referenciaId: String(ped.numero_pedido),
        detalhes: { itens: ped.itens, zona: ped.zona, desconto: ped.desconto },
        zona: ped.zona,
        data: dataPed
      });
      clientesCadastrados++;
      interacoesCriadas++;
    }

    // 2. Processar trocas
    for (const troca of trocas) {
      if (!troca.cliente_telefone) continue;
      const dataTroca = troca.data_troca || troca.created_at || new Date().toISOString();
      await this.registrarOuAtualizarCliente({
        nome: troca.cliente_nome,
        telefone: troca.cliente_telefone,
        tipoInteracao: 'troca',
        descricaoInteracao: `Troca/Garantia: ${troca.vape_defeito} (${troca.motivo}) por ${troca.vape_trocado}`,
        valor: 0,
        referenciaId: troca.id,
        detalhes: { defeito: troca.vape_defeito, trocado: troca.vape_trocado, motivo: troca.motivo },
        zona: troca.zona,
        data: dataTroca
      });
      interacoesCriadas++;
    }

    return { clientesCadastrados, interacoesCriadas };
  }
};

// Serviço de imagens (Supabase Storage)
export const imagemService = {
  // Fazer upload de imagem e retornar a URL pública
  async upload(arquivo: File, produtoId: string): Promise<string> {
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() || 'jpg';
    const nomeArquivo = `${produtoId}-${Date.now()}.${extensao}`;
    const caminho = `produtos/${nomeArquivo}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_IMAGENS)
      .upload(caminho, arquivo, {
        cacheControl: '31536000', // 1 ano de cache para imagens
        upsert: true,
        contentType: arquivo.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(BUCKET_IMAGENS)
      .getPublicUrl(caminho);

    return data.publicUrl;
  },

  // Deletar imagem do Storage
  async deletar(caminho: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET_IMAGENS)
      .remove([caminho]);

    if (error) throw error;
  },

  // Extrair o caminho relativo de uma URL pública do Supabase Storage
  extrairCaminhoDoUrl(url: string): string | null {
    try {
      const regex = new RegExp(`/storage/v1/object/public/${BUCKET_IMAGENS}/(.+)`);
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  },

  // Substituir imagem existente (deletar antiga e fazer upload da nova)
  async substituir(novoArquivo: File, produtoId: string, urlAntiga?: string | null): Promise<string> {
    // Deletar imagem antiga se existir
    if (urlAntiga) {
      const caminhoAntigo = this.extrairCaminhoDoUrl(urlAntiga);
      if (caminhoAntigo) {
        try {
          await this.deletar(caminhoAntigo);
        } catch {
          console.warn('Não foi possível deletar imagem antiga');
        }
      }
    }
    return this.upload(novoArquivo, produtoId);
  },
};

export const visitasService = {
  // Registrar uma nova visita (com proteção básica contra bots/spam)
  async registrarVisita(path: string): Promise<void> {
    // Não registrar visitas a rotas administrativas ou de erro
    if (path.startsWith('/admin') || path.startsWith('/404')) return;
    
    // Proteção básica: não registrar se for um bot conhecido
    const userAgent = navigator.userAgent.toLowerCase();
    const isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(userAgent);
    if (isBot) return;

    // Usar sessionStorage para registrar apenas uma vez por sessão
    const jaRegistrado = sessionStorage.getItem(`visit_reg_${path}`);
    if (jaRegistrado) return;

    try {
      await supabase.from('visitas').insert([
        { path, user_agent: navigator.userAgent }
      ]);
      sessionStorage.setItem(`visit_reg_${path}`, 'true');
    } catch (err) {
      console.error('Erro ao registrar visita:', err);
    }
  },

  // Obter métricas de visitas agrupadas por dia (parametrizável para evitar egress alto)
  async obterMetricas(dias: number = 90): Promise<{ data: string; acessos: number }[]> {
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - dias);

    const { data, error } = await supabase
      .from('visitas')
      .select('created_at')
      .gte('created_at', limiteData.toISOString());

    if (error) throw error;

    // Agrupar por dia no frontend (mais simples para Supabase sem edge functions complexas)
    const agrupado: { [key: string]: number } = {};
    data.forEach((v: { created_at: string }) => {
      const dia = new Date(v.created_at).toLocaleDateString('pt-BR');
      agrupado[dia] = (agrupado[dia] || 0) + 1;
    });

    // Converter para array ordenado por data
    return Object.entries(agrupado)
      .map(([dia, acessos]) => ({ data: dia, acessos }))
      .sort((a, b) => {
        const dateA = new Date(a.data.split('/').reverse().join('-'));
        const dateB = new Date(b.data.split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      });
  }
};

export const configService = {
  // Obter a configuração do horário promocional
  async obterPromoSchedule(): Promise<PromoSchedule> {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'promo_schedule')
        .single();
      
      if (error) throw error;
      return data.valor as PromoSchedule;
    } catch (err) {
      console.warn('Usando valores padrão para a promoção (tabela configuracoes pode não existir):', err);
      return {
        dias_semana: [1, 2, 3], // Segunda a Quarta
        hora_inicio: "09:00",
        hora_fim: "15:25"
      };
    }
  },

  // Salvar a configuração do horário promocional
  async salvarPromoSchedule(schedule: PromoSchedule): Promise<void> {
    const { error } = await supabase
      .from('configuracoes')
      .upsert({
        chave: 'promo_schedule',
        valor: schedule,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  },

  // Obter a configuração do Hero Banner
  async obterHeroBannerConfig(): Promise<HeroBannerConfig> {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'hero_banner_config')
        .single();
      
      if (error) throw error;
      return data.valor as HeroBannerConfig;
    } catch (err) {
      console.warn('Usando valores padrão para Hero Banner (tabela configuracoes pode não ter a chave):', err);
      return DEFAULT_HERO_BANNER_CONFIG;
    }
  },

  // Salvar a configuração do Hero Banner
  async salvarHeroBannerConfig(config: HeroBannerConfig): Promise<void> {
    const { error } = await supabase
      .from('configuracoes')
      .upsert({
        chave: 'hero_banner_config',
        valor: config,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }
};

// Autenticação
export const authService = {
  // Login com email e senha
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  // Logout
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Obter usuário atual
  async obterUsuarioAtual() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Verificar se está autenticado
  async estaAutenticado(): Promise<boolean> {
    const user = await this.obterUsuarioAtual();
    return !!user;
  },

  // Observar mudanças de autenticação
  onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });
  },
};

// Utilidades
export const formatarMoeda = (valor: number | string | null | undefined, incluirSimbolo: boolean = true): string => {
  const num = typeof valor === 'number' ? valor : parseFloat(String(valor || 0));
  if (isNaN(num)) return incluirSimbolo ? 'R$ 0,00' : '0,00';
  const formatado = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return incluirSimbolo ? `R$ ${formatado}` : formatado;
};

export const formatarPreco = (valor: number | string | null | undefined): string => {
  return formatarMoeda(valor, true);
};

export const utils = {
  // Formatar valores monetários em padrão pt-BR (ex: R$ 1.250,00)
  formatarMoeda,
  formatarPreco,
  normalizarTelefoneWhatsApp,
  formatarTelefoneExibicao,

  // Normalizar texto para buscas resilientes (remover acentos e minúsculas)
  normalizarTexto(texto: string): string {
    return (texto || '')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  },

  // Obter todas as marcas únicas
  async obterMarcas(): Promise<string[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('marca');

    if (error) throw error;
    
    // Remover duplicatas e ordenar pelas marcas principais (Ignite, Elfbar, etc.)
    const marcasSet = new Set((data || []).map(p => p.marca));
    const marcas = Array.from(marcasSet);
    return utils.ordenarMarcas(marcas);
  },

  // Verificar se está no horário de promoção baseado em uma configuração dinâmica (com fallback)
  estaEmHorarioPromo(config?: PromoSchedule): boolean {
    const schedule = config || {
      dias_semana: [1, 2, 3],
      hora_inicio: "09:00",
      hora_fim: "15:25"
    };

    // Criar data em Brasília (UTC-3)
    const agora = new Date();
    // Use en-US to ensure the resulting string (MM/DD/YYYY) is valid for new Date() parsing
    const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    
    const dia = brasilia.getDay(); // 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
    
    // Verificar se o dia da semana atual está no cronograma promocional
    if (!schedule.dias_semana.includes(dia)) return false;

    const hora = brasilia.getHours();
    const minutos = brasilia.getMinutes();
    
    // Parse hora_inicio e hora_fim (e.g. "09:00", "15:25")
    const [hInicio, mInicio] = schedule.hora_inicio.split(':').map(Number);
    const [hFim, mFim] = schedule.hora_fim.split(':').map(Number);

    const minutosAtual = hora * 60 + minutos;
    const minutosInicio = hInicio * 60 + mInicio;
    const minutosFim = hFim * 60 + mFim;

    return minutosAtual >= minutosInicio && minutosAtual <= minutosFim;
  },

  // Obter hora atual em Brasília (para debug)
  obterHoraBrasilia(): string {
    const agora = new Date();
    const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return brasilia.toLocaleTimeString('pt-BR');
  },

  // Formatar dias da semana por extenso (ex: Segunda a Quarta ou Segunda, Terça)
  formatarDiasSemana(dias: number[]): string {
    if (!dias || dias.length === 0) return 'Nenhum dia';
    const nomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    
    // Verificar se é um intervalo contínuo
    let continuo = true;
    for (let i = 1; i < dias.length; i++) {
      if (dias[i] !== dias[i-1] + 1) {
        continuo = false;
        break;
      }
    }
    
    if (continuo && dias.length > 1) {
      // Remover o "-feira" do primeiro dia se houver mais para encurtar
      const d1 = nomes[dias[0]].replace('-feira', '');
      const d2 = nomes[dias[dias.length - 1]];
      return `${d1} a ${d2}`;
    }
    
    return dias.map(d => nomes[d]).join(', ');
  },

  // Formatar dias da semana abreviado (ex: Seg a Qua)
  formatarDiasSemanaAbreviado(dias: number[]): string {
    if (!dias || dias.length === 0) return 'Nenhum';
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    let continuo = true;
    for (let i = 1; i < dias.length; i++) {
      if (dias[i] !== dias[i-1] + 1) {
        continuo = false;
        break;
      }
    }
    
    if (continuo && dias.length > 1) {
      return `${nomes[dias[0]]} a ${nomes[dias[dias.length - 1]]}`;
    }
    
    return dias.map(d => nomes[d]).join(', ');
  },

  // Extrair número de puffs ou numeração de modelo pós-V (ex: V500=50k, V400=40k, V300=30k, V250=25k, V200=20k, V155=15.5k, V80=8k, V55=5.5k, VNANO=1k, "8.000", "40.000 MIX")
  extrairPuffs(nome: string): number {
    if (!nome) return 0;
    const texto = nome.trim().toLowerCase();

    // 1. Caso especial VNANO / NANO (1.000 puffs)
    if (texto.includes('vnano') || texto.includes('nano')) {
      const matchNanoK = texto.match(/nano\s*[-_]?\s*(\d+)\s*k/i);
      if (matchNanoK) return parseInt(matchNanoK[1], 10) * 1000;
      return 1000;
    }

    // 2. Notação 'K' explícita (ex: "50k", "40k", "30k", "25k", "20k", "15.5k", "15,5k", "8k", "5.5k", "1k")
    const matchK = texto.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
    if (matchK) {
      const num = parseFloat(matchK[1].replace(',', '.'));
      return Math.round(num * 1000);
    }

    // 3. Notação com sufixo "puffs" / "puf" (ex: "50.000 puffs", "15.500 puffs", "8.000 puffs", "8000 puff")
    const matchPuffs = texto.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:puffs?|puf)\b/i);
    if (matchPuffs) {
      const raw = matchPuffs[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) return Math.round(num);
    }

    // 4. Padrão V-Series explícito (ex: "V500", "V400", "V300", "V250", "V200", "V155", "V80", "V55", "V50", "V40", "V25", "V15")
    const matchV = texto.match(/(?:^|[^a-z0-9]|ignite)\s*v\s*[-_.]?\s*(\d+)/i) || texto.match(/\bv\s*[-_.]?\s*(\d+)/i);
    if (matchV) {
      const vNum = parseInt(matchV[1], 10);
      if (vNum === 500) return 50000;
      if (vNum === 400) return 40000;
      if (vNum === 300) return 30000;
      if (vNum === 250) return 25000;
      if (vNum === 200) return 20000;
      if (vNum === 155) return 15500;
      if (vNum === 80) return 8000;
      if (vNum === 55) return 5500;
      if (vNum === 50) return 5000;
      if (vNum === 40) return 4000;
      if (vNum === 25) return 2500;
      if (vNum === 15) return 1500;
      if (vNum < 1000) return vNum * 100;
      return vNum;
    }

    // 5. Notação com separador de milhar com ponto (ex: "50.000", "40.000", "30.000", "25.000", "20.000", "15.500", "8.000", "5.500", "1.000")
    const matchMilhar = texto.match(/\b(\d{1,3})\.(\d{3})\b/);
    if (matchMilhar) {
      const num = parseInt(matchMilhar[1] + matchMilhar[2], 10);
      if (!isNaN(num) && num > 0) return num;
    }

    // Decimal com vírgula ou ponto de milhar reduzido (ex: "15,500", "5,500", "15.5", "5.5")
    const matchDecimal = texto.match(/\b(\d{1,2})[,.](\d{1,3})\b/);
    if (matchDecimal) {
      const parteInt = parseInt(matchDecimal[1], 10);
      const parteDec = matchDecimal[2];
      if (parteDec.length === 3) {
        return parseInt(matchDecimal[1] + parteDec, 10);
      } else {
        const numFloat = parseFloat(`${parteInt}.${parteDec}`);
        if (numFloat <= 100) return Math.round(numFloat * 1000);
      }
    }

    // 6. Número direto de 4 a 6 dígitos (ex: "50000", "40000", "20000", "10000", "8000", "5000", "1000")
    const matchNum = texto.match(/\b(\d{4,6})\b/);
    if (matchNum) {
      const num = parseInt(matchNum[1], 10);
      if (!isNaN(num)) return num;
    }

    // 7. Número grudado em letras de modelo (ex: "MO20000", "BC10000", "GH23000", "G8000")
    const matchEmbedded = texto.match(/[a-z]\s*[-_]?\s*(\d{2,6})/i);
    if (matchEmbedded) {
      const num = parseInt(matchEmbedded[1], 10);
      if (num === 155) return 15500;
      if (num === 55) return 5500;
      if (num < 1000) return num * 100;
      if (!isNaN(num)) return num;
    }

    // 8. Número isolado de 2 ou 3 dígitos (ex: "500", "400", "300", "250", "200", "155", "80", "55")
    const matchDoisDigitos = texto.match(/\b(\d{2,3})\b/);
    if (matchDoisDigitos) {
      const num = parseInt(matchDoisDigitos[1], 10);
      if (num === 500) return 50000;
      if (num === 400) return 40000;
      if (num === 300) return 30000;
      if (num === 250) return 25000;
      if (num === 200) return 20000;
      if (num === 155) return 15500;
      if (num === 80) return 8000;
      if (num === 55) return 5500;
      if (num === 50) return 5000;
      if (num === 40) return 4000;
      if (num === 25) return 2500;
      if (num === 15) return 1500;
      if (!isNaN(num)) return num * 100;
    }

    return 0;
  },

  // Ordenar lista de marcas com prioridade para as marcas principais (Ignite, Elfbar, Black Sheep, Waka, Sex Addict)
  // Identificar a família principal da marca (Ignite, Elf Bar, Black Sheep, Waka, Sex Addict, Lost Vape, Maskking, Extre Bar, etc.)
  extrairFamiliaMarca(marca: string, nome: string): { familia: string; nomeExibicao: string } {
    const texto = `${marca || ''} ${nome || ''}`.toLowerCase();

    if (texto.includes('ignite') || /v\s*[-_.]?\d{2,4}\b/.test(texto) || texto.includes('vnano')) {
      return { familia: 'ignite', nomeExibicao: 'IGNITE' };
    }
    if (texto.includes('elf bar') || texto.includes('elfbar') || texto.includes('lost mary')) {
      return { familia: 'elf bar', nomeExibicao: 'ELF BAR' };
    }
    if (texto.includes('black sheep') || texto.includes('blacksheep')) {
      return { familia: 'black sheep', nomeExibicao: 'BLACK SHEEP' };
    }
    if (texto.includes('waka')) {
      return { familia: 'waka', nomeExibicao: 'WAKA' };
    }
    if (texto.includes('sex addic') || texto.includes('sexaddic')) {
      return { familia: 'sex addict', nomeExibicao: 'SEX ADDICT' };
    }
    if (texto.includes('lost vape') || texto.includes('lostvape') || texto.includes('lost vaper')) {
      return { familia: 'lost vape', nomeExibicao: 'LOST VAPE' };
    }
    if (texto.includes('maskking')) {
      return { familia: 'maskking', nomeExibicao: 'MASKKING' };
    }
    if (texto.includes('extre bar') || texto.includes('oxbar')) {
      return { familia: 'extre bar', nomeExibicao: 'EXTRE BAR' };
    }

    const m = (marca || '').trim();
    // Limpa números e sufixos da marca (ex: "BRAND 20K" -> "BRAND")
    const limpa = m.replace(/\s+\d+.*$/, '').trim();
    return {
      familia: (limpa || m || 'outros').toLowerCase(),
      nomeExibicao: (limpa || m || 'Outros').toUpperCase()
    };
  },

  // Ordenar lista de marcas com prioridade para as marcas principais (Ignite, Elfbar, Black Sheep, Waka, Sex Addict, Lost Vape, Maskking, Extre Bar)
  ordenarMarcas(marcas: string[]): string[] {
    const prioridade = ['ignite', 'elf bar', 'black sheep', 'waka', 'sex addict', 'lost vape', 'maskking', 'extre bar'];
    return [...marcas].sort((a, b) => {
      const famA = utils.extrairFamiliaMarca(a, '').familia;
      const famB = utils.extrairFamiliaMarca(b, '').familia;
      if (famA === famB) return (a || '').localeCompare(b || '', 'pt-BR');

      const idxA = prioridade.findIndex(m => famA.includes(m) || m.includes(famA));
      const idxB = prioridade.findIndex(m => famB.includes(m) || m.includes(famB));
      if (idxA !== -1 && idxB !== -1) {
        if (idxA !== idxB) return idxA - idxB;
      } else if (idxA !== -1) {
        return -1;
      } else if (idxB !== -1) {
        return 1;
      }
      return famA.localeCompare(famB, 'pt-BR');
    });
  },

  // Ordenar lista de vapes: 1º por Família de Marca (Ignite, Elfbar, Black Sheep, etc.), 2º dentro da família por Puffs (do MAIOR para o MENOR por padrão oficial), 3º desempate por Nome
  ordenarProdutosPorMarcaEPuffs(produtos: Produto[], direcaoPuffs: 'asc' | 'desc' = 'desc'): Produto[] {
    const prioridadeMarcas = ['ignite', 'elf bar', 'black sheep', 'waka', 'sex addict', 'lost vape', 'maskking', 'extre bar'];

    return [...produtos].sort((a, b) => {
      // 1. Marca / Família da Marca
      const famA = utils.extrairFamiliaMarca(a.marca, a.nome).familia;
      const famB = utils.extrairFamiliaMarca(b.marca, b.nome).familia;

      if (famA !== famB) {
        const idxA = prioridadeMarcas.findIndex(m => famA.includes(m) || m.includes(famA));
        const idxB = prioridadeMarcas.findIndex(m => famB.includes(m) || m.includes(famB));

        if (idxA !== -1 && idxB !== -1) {
          if (idxA !== idxB) return idxA - idxB;
        } else if (idxA !== -1) {
          return -1;
        } else if (idxB !== -1) {
          return 1;
        }

        const compMarca = famA.localeCompare(famB, 'pt-BR');
        if (compMarca !== 0) return compMarca;
      }

      // 2. Dentro da mesma família de marca: Puffs do maior para o menor (ou ascendente se configurado)
      const puffsA = Math.max(utils.extrairPuffs(a.nome), utils.extrairPuffs(a.marca));
      const puffsB = Math.max(utils.extrairPuffs(b.nome), utils.extrairPuffs(b.marca));

      if (puffsA !== puffsB) {
        return direcaoPuffs === 'asc' ? puffsA - puffsB : puffsB - puffsA;
      }

      // 3. Desempate por Nome do Produto (A-Z)
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    });
  },

  // Obter estoque e sabores disponíveis de um produto filtrado por zona (centralizado em estoque.ts)
  obterEstoqueProdutoPorZona(
    produto: Produto,
    zona: ZonaId | string | null | undefined
  ) {
    return obterEstoqueCentralizado(produto, zona);
  }
};

