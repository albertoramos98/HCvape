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
  // Buscar todos os pedidos ativos (limitado aos últimos 500 para performance)
  async obterTodos(): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .or('excluido.is.null,excluido.eq.false')
      .order('created_at', { ascending: false })
      .limit(500);

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

  // Criar novo pedido
  async criar(pedido: Omit<Pedido, 'id' | 'numero_pedido' | 'created_at' | 'excluido'>): Promise<Pedido> {
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{ ...pedido, excluido: false }])
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
};
