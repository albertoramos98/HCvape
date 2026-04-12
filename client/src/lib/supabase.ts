import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente Supabase não configuradas');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Nome do bucket de imagens no Supabase Storage
const BUCKET_IMAGENS = 'produto-imagens';

// Tipos para o banco de dados
export interface Produto {
  id: string;
  marca: string;
  nome: string;
  preco: number;
  estoque: number;
  sabores: string[];
  is_promo?: boolean;
  preco_promo?: number;
  imagem_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoItem {
  id: string;
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
  itens: PedidoItem[];
  total: number;
  desconto: number;
  total_final: number;
  status_checklist: boolean;
  indicacao?: string;
  notas?: string;
  created_at?: string;
}

// Funções auxiliares
export const produtosService = {
  // Buscar todos os produtos
  async obterTodos(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('marca', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Buscar produtos por marca
  async obterPorMarca(marca: string): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('marca', marca)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Atualizar estoque
  async atualizarEstoque(id: string, novoEstoque: number): Promise<void> {
    const { error } = await supabase
      .from('produtos')
      .update({ estoque: novoEstoque, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  // Criar novo produto
  async criar(produto: Omit<Produto, 'id' | 'created_at' | 'updated_at'>): Promise<Produto> {
    const { data, error } = await supabase
      .from('produtos')
      .insert([produto])
      .select()
      .single();

    if (error) throw error;
    return data;
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

  // Editar produto
  async editar(id: string, updates: Partial<Omit<Produto, 'id' | 'created_at'>>): Promise<Produto> {
    const { data, error } = await supabase
      .from('produtos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const pedidosService = {
  // Buscar todos os pedidos
  async obterTodos(): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Criar novo pedido
  async criar(pedido: Omit<Pedido, 'id' | 'numero_pedido' | 'created_at'>): Promise<Pedido> {
    const { data, error } = await supabase
      .from('pedidos')
      .insert([pedido])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Atualizar status checklist
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

  // Deletar pedido
  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from('pedidos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
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
        cacheControl: '3600',
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
export const utils = {
  // Obter todas as marcas únicas
  async obterMarcas(): Promise<string[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('marca')
      .order('marca', { ascending: true });

    if (error) throw error;
    
    // Remover duplicatas
    const marcasSet = new Set((data || []).map(p => p.marca));
    const marcas = Array.from(marcasSet);
    return marcas;
  },

  // Verificar se está no horário de promoção (09:00 às 15:25 Brasília)
  estaEmHorarioPromo(): boolean {
    // Criar data em Brasília (UTC-3)
    const agora = new Date();
    const brasilia = new Date(agora.toLocaleString('pt-BR', { timeZone: 'America/Recife' }));
    const hora = brasilia.getHours();
    const minutos = brasilia.getMinutes();
    
    // Promoção ativa das 09:00 até as 15:25
    if (hora < 9) return false;
    if (hora > 15) return false;
    if (hora === 15 && minutos > 25) return false;
    
    return true;
  },

  // Obter hora atual em Brasília (para debug)
  obterHoraBrasilia(): string {
    const agora = new Date();
    const brasilia = new Date(agora.toLocaleString('pt-BR', { timeZone: 'America/Recife' }));
    return brasilia.toLocaleTimeString('pt-BR');
  },
};
