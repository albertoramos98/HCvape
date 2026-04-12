import { useState, useEffect, useRef } from 'react';
import { LogOut, Save, AlertCircle, Loader2, Plus, Trash2, Edit2, X, Zap, ImagePlus, ImageOff, ShoppingBag, Box, CheckCircle2, Circle, Download } from 'lucide-react';
import { authService, produtosService, pedidosService, imagemService, Produto, Pedido, utils } from '@/lib/supabase';

/**
 * Página Admin - Gerenciamento Completo de Estoque + Promoções + Imagens + Pedidos
 * Design: Cyberpunk Dark Mode com Neon Verde
 * Acesso: Protegido por autenticação Supabase
 */

interface EstoqueEditado {
  [key: string]: number | undefined;
}

interface FormProduto {
  marca: string;
  nome: string;
  preco: string;
  estoque: string;
  sabores: string;
  is_promo: boolean;
  preco_promo: string;
}

export default function Admin() {
  const [autenticado, setAutenticado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'produtos' | 'pedidos'>('produtos');
  const [marcas, setMarcas] = useState<string[]>([]);
  const [estoqueEditado, setEstoqueEditado] = useState<EstoqueEditado>({});
  const [salvando, setSalvando] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState<string>('');

  // Estados para financeiro (desconto)
  const [editandoFinanceiro, setEditandoFinanceiro] = useState<{ id: string; desconto: string } | null>(null);

  // Estados para modal de criar/editar
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [marcaCustomizada, setMarcaCustomizada] = useState('');
  const [formProduto, setFormProduto] = useState<FormProduto>({
    marca: '',
    nome: '',
    preco: '',
    estoque: '',
    sabores: '',
    is_promo: false,
    preco_promo: '',
  });

  // Estados para imagem
  const [imagemArquivo, setImagemArquivo] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemUrlAtual, setImagemUrlAtual] = useState<string | null>(null);
  const [removerImagem, setRemoverImagem] = useState(false);
  const [uploadandoImagem, setUploadandoImagem] = useState(false);
  const inputImagemRef = useRef<HTMLInputElement>(null);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const verificarAuth = async () => {
      try {
        const user = await authService.obterUsuarioAtual();
        if (user) {
          setAutenticado(true);
          setUsuarioEmail(user.email || '');
          await carregarTudo();
        }
      } catch (err) {
        console.error('Erro ao verificar autenticação:', err);
      } finally {
        setCarregando(false);
      }
    };

    verificarAuth();
  }, []);

  // Carregar todos os dados
  const carregarTudo = async () => {
    try {
      setErro(null);
      const [produtosData, pedidosData, marcasData] = await Promise.all([
        produtosService.obterTodos(),
        pedidosService.obterTodos(),
        utils.obterMarcas()
      ]);
      setProdutos(produtosData);
      setPedidos(pedidosData);
      setMarcas(marcasData);
      setEstoqueEditado({});
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setErro('Erro ao carregar dados do sistema');
    }
  };

  // Carregar produtos
  const carregarProdutos = async () => {
    try {
      const dados = await produtosService.obterTodos();
      setProdutos(dados);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  };

  // Carregar marcas
  const carregarMarcas = async () => {
    try {
      const marcasData = await utils.obterMarcas();
      setMarcas(marcasData);
    } catch (err) {
      console.error('Erro ao carregar marcas:', err);
    }
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!email || !senha) {
      setErro('Preencha email e senha');
      return;
    }

    try {
      setSalvando(true);
      await authService.login(email, senha);
      setAutenticado(true);
      setUsuarioEmail(email);
      setEmail('');
      setSenha('');
      await carregarTudo();
      setSucesso('Login realizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      setErro(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setSalvando(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      setAutenticado(false);
      setUsuarioEmail('');
      setProdutos([]);
      setPedidos([]);
      setMarcas([]);
      setEstoqueEditado({});
      setErro(null);
      setSucesso(null);
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
      setErro('Erro ao fazer logout');
    }
  };

  // Abrir modal para novo produto
  const abrirModalNovo = () => {
    setEditandoId(null);
    setMarcaCustomizada('');
    setFormProduto({
      marca: '',
      nome: '',
      preco: '',
      estoque: '',
      sabores: '',
      is_promo: false,
      preco_promo: '',
    });
    setImagemArquivo(null);
    setImagemPreview(null);
    setImagemUrlAtual(null);
    setRemoverImagem(false);
    setModalAberto(true);
  };

  // Abrir modal para editar produto
  const abrirModalEditar = (produto: Produto) => {
    setEditandoId(produto.id);
    setMarcaCustomizada('');
    setFormProduto({
      marca: produto.marca,
      nome: produto.nome,
      preco: produto.preco.toString(),
      estoque: produto.estoque.toString(),
      sabores: produto.sabores.join(', '),
      is_promo: produto.is_promo || false,
      preco_promo: produto.preco_promo?.toString() || '',
    });
    setImagemArquivo(null);
    setImagemPreview(null);
    setImagemUrlAtual(produto.imagem_url || null);
    setRemoverImagem(false);
    setModalAberto(true);
  };

  // Fechar modal
  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setMarcaCustomizada('');
    setFormProduto({
      marca: '',
      nome: '',
      preco: '',
      estoque: '',
      sabores: '',
      is_promo: false,
      preco_promo: '',
    });
    setImagemArquivo(null);
    setImagemPreview(null);
    setImagemUrlAtual(null);
    setRemoverImagem(false);
  };

  // Selecionar imagem
  const handleSelecionarImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem válido (JPG, PNG, WebP, etc.)');
      return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
      setErro('A imagem deve ter no máximo 5MB');
      return;
    }

    setImagemArquivo(arquivo);
    setRemoverImagem(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagemPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(arquivo);
  };

  // Remover imagem selecionada/atual
  const handleRemoverImagem = () => {
    setImagemArquivo(null);
    setImagemPreview(null);
    setRemoverImagem(true);
    if (inputImagemRef.current) {
      inputImagemRef.current.value = '';
    }
  };

  // Salvar produto (criar ou editar)
  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const marcaFinal = marcaCustomizada || formProduto.marca;

    if (!marcaFinal || !formProduto.nome || !formProduto.preco || !formProduto.estoque || !formProduto.sabores) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }

    const preco = parseFloat(formProduto.preco);
    const estoque = parseInt(formProduto.estoque);
    const sabores = formProduto.sabores.split(',').map(s => s.trim()).filter(s => s);

    if (isNaN(preco) || preco <= 0) {
      setErro('Preço deve ser um número positivo');
      return;
    }

    if (isNaN(estoque) || estoque < 0) {
      setErro('Estoque deve ser um número não-negativo');
      return;
    }

    if (sabores.length === 0) {
      setErro('Adicione pelo menos um sabor');
      return;
    }

    let precoPromo: number | null = null;
    if (formProduto.is_promo) {
      if (!formProduto.preco_promo) {
        setErro('Defina o preço promocional');
        return;
      }
      precoPromo = parseFloat(formProduto.preco_promo);
      if (isNaN(precoPromo) || precoPromo <= 0) {
        setErro('Preço promocional deve ser um número positivo');
        return;
      }
      if (precoPromo >= preco) {
        setErro('Preço promocional deve ser menor que o preço original');
        return;
      }
    }

    try {
      setSalvando(true);

      let imagemUrl: string | null | undefined = undefined;

      if (editandoId) {
        // --- EDITAR ---
        if (imagemArquivo) {
          setUploadandoImagem(true);
          imagemUrl = await imagemService.substituir(imagemArquivo, editandoId, imagemUrlAtual);
          setUploadandoImagem(false);
        } else if (removerImagem && imagemUrlAtual) {
          const caminho = imagemService.extrairCaminhoDoUrl(imagemUrlAtual);
          if (caminho) {
            try {
              await imagemService.deletar(caminho);
            } catch {
              console.warn('Não foi possível deletar imagem');
            }
          }
          imagemUrl = null;
        }

        const updates: any = {
          marca: marcaFinal,
          nome: formProduto.nome,
          preco,
          estoque,
          sabores,
          is_promo: formProduto.is_promo,
          preco_promo: precoPromo || undefined,
        };

        if (imagemUrl !== undefined) {
          updates.imagem_url = imagemUrl;
        }

        await produtosService.editar(editandoId, updates);
        setSucesso('Produto atualizado com sucesso!');
      } else {
        // --- CRIAR ---
        const novoProduto = await produtosService.criar({
          marca: marcaFinal,
          nome: formProduto.nome,
          preco,
          estoque,
          sabores,
          is_promo: formProduto.is_promo,
          preco_promo: precoPromo || undefined,
          imagem_url: null,
        });

        if (imagemArquivo) {
          setUploadandoImagem(true);
          try {
            const url = await imagemService.upload(imagemArquivo, novoProduto.id);
            await produtosService.editar(novoProduto.id, { imagem_url: url });
          } catch (imgErr) {
            console.error('Erro ao fazer upload da imagem:', imgErr);
            setErro('Produto criado, mas houve erro ao enviar a imagem. Edite o produto para adicionar a imagem.');
          } finally {
            setUploadandoImagem(false);
          }
        }

        setSucesso('Produto criado com sucesso!');
      }

      await carregarProdutos();
      await carregarMarcas();
      fecharModal();
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err);
      setErro(err.message || 'Erro ao salvar produto');
      setUploadandoImagem(false);
    } finally {
      setSalvando(false);
    }
  };

  // Deletar produto
  const handleDeletarProduto = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja deletar "${nome}"?`)) {
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await produtosService.deletar(id);
      setSucesso('Produto deletado com sucesso!');
      await carregarProdutos();
      await carregarMarcas();
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao deletar produto:', err);
      setErro('Erro ao deletar produto');
    } finally {
      setSalvando(false);
    }
  };

  // Atualizar estoque
  const handleAtualizarEstoque = async (id: string) => {
    const novoEstoque = estoqueEditado[id];

    if (novoEstoque === undefined || novoEstoque === null) {
      setErro('Valor de estoque inválido');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await produtosService.atualizarEstoque(id, novoEstoque);

      setProdutos(produtos.map(p =>
        p.id === id ? { ...p, estoque: novoEstoque } : p
      ));

      setEstoqueEditado({ ...estoqueEditado, [id]: undefined });
      setSucesso('Estoque atualizado com sucesso!');

      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar estoque:', err);
      setErro('Erro ao atualizar estoque');
    } finally {
      setSalvando(false);
    }
  };

  // --- LÓGICA DE PEDIDOS ---

  const handleAtualizarStatusPedido = async (id: string, status: boolean) => {
    try {
      setSalvando(true);
      
      const pedido = pedidos.find(p => p.id === id);
      if (!pedido) return;

      // Se o status não mudou, não faz nada (evita cliques duplos)
      if (pedido.status_checklist === status) return;

      // 1. Atualizar o status do pedido no banco
      await pedidosService.atualizarStatus(id, status);

      // 2. Lógica de Estoque: Baixa ou Reposição
      // Buscamos os produtos atuais para garantir valores reais
      const produtosAtuais = await produtosService.obterTodos();
      
      const promessasEstoque = pedido.itens.map(async (item) => {
        const produto = produtosAtuais.find(p => p.id === item.id);
        
        if (produto) {
          // Se status for true (Checklist), subtrai. Se for false (Reabrir), soma.
          const fator = status ? -1 : 1;
          const novoEstoque = Math.max(0, produto.estoque + (item.quantidade * fator));
          
          await produtosService.atualizarEstoque(item.id, novoEstoque);
          return { id: item.id, estoque: novoEstoque };
        }
        return null;
      });

      const resultadosEstoque = await Promise.all(promessasEstoque);
      
      // 3. Atualizar estados locais para refletir a mudança imediatamente
      const novosProdutos = [...produtos];
      resultadosEstoque.forEach(res => {
        if (res) {
          const index = novosProdutos.findIndex(p => p.id === res.id);
          if (index !== -1) {
            novosProdutos[index].estoque = res.estoque;
          }
        }
      });
      setProdutos(novosProdutos);

      setPedidos(pedidos.map(p => p.id === id ? { ...p, status_checklist: status } : p));
      setSucesso(status ? 'Checklist concluído e estoque baixado!' : 'Pedido reaberto e estoque reposto!');
      
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err);
      setErro('Erro ao atualizar status do pedido e estoque');
    } finally {
      setSalvando(false);
    }
  };

  const handleAtualizarFinanceiroPedido = async (id: string) => {
    const editando = editandoFinanceiro;
    if (!editando || editando.id !== id) return;

    const desconto = parseFloat(editando.desconto) || 0;
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) return;

    const totalFinal = pedido.total - desconto;

    try {
      setSalvando(true);
      await pedidosService.atualizarFinanceiro(id, desconto, totalFinal);
      setPedidos(pedidos.map(p => p.id === id ? { ...p, desconto, total_final: totalFinal } : p));
      setEditandoFinanceiro(null);
      setSucesso('Financeiro do pedido atualizado!');
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar financeiro do pedido:', err);
      setErro('Erro ao atualizar financeiro');
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletarPedido = async (id: string, numero: number) => {
    if (!window.confirm(`Tem certeza que deseja deletar o pedido #${numero}?`)) {
      return;
    }

    try {
      setSalvando(true);
      await pedidosService.deletar(id);
      setPedidos(pedidos.filter(p => p.id !== id));
      setSucesso('Pedido deletado com sucesso!');
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao deletar pedido:', err);
      setErro('Erro ao deletar pedido');
    } finally {
      setSalvando(false);
    }
  };

  const handleExportarProdutos = () => {
    if (produtos.length === 0) {
      alert('Nenhum produto para exportar');
      return;
    }

    const headers = ['Marca', 'Modelo/Puxadas', 'Quantidade', 'Valor Unitário', 'Valor Total Item'];
    
    // Calcular consolidado por marca
    const consolidadoPorMarca: { [key: string]: number } = {};
    let totalGeralItens = 0;
    let valorTotalGeral = 0;

    const rows = produtos.map(p => {
      const valorTotalItem = p.preco * p.estoque;
      
      // Somar para o consolidado
      consolidadoPorMarca[p.marca] = (consolidadoPorMarca[p.marca] || 0) + valorTotalItem;
      totalGeralItens += p.estoque;
      valorTotalGeral += valorTotalItem;

      return [
        p.marca,
        p.nome,
        p.estoque,
        `R$ ${p.preco.toFixed(2).replace('.', ',')}`,
        `R$ ${valorTotalItem.toFixed(2).replace('.', ',')}`
      ];
    });

    // Criar linhas de resumo por marca
    const resumoMarcaRows = Object.entries(consolidadoPorMarca).map(([marca, total]) => {
      return ['', '', '', `TOTAL ${marca}`, `R$ ${total.toFixed(2).replace('.', ',')}`];
    });

    // Linha de total geral
    const totalGeralRow = [
      '', 
      'RESUMO GERAL', 
      `${totalGeralItens} unidades`, 
      'VALOR TOTAL', 
      `R$ ${valorTotalGeral.toFixed(2).replace('.', ',')}`
    ];

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';')),
      '',
      '--- RESUMO POR MARCA ---',
      ...resumoMarcaRows.map(r => r.join(';')),
      '',
      totalGeralRow.join(';')
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `estoque_hc_pods_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportarPedidos = () => {
    if (pedidos.length === 0) {
      alert('Nenhum pedido para exportar');
      return;
    }

    const headers = ['Data', 'Pedido #', 'Cliente', 'Telefone', 'Indicação', 'Itens', 'Total Original', 'Desconto', 'Total Final', 'Status Checklist'];
    
    const rows = pedidos.map(p => {
      const data = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-';
      const itensStr = p.itens.map(i => `${i.nome} x${i.quantidade} (${i.sabor})`).join(' | ');
      return [
        data,
        p.numero_pedido,
        p.nome_cliente,
        p.telefone_cliente,
        p.indicacao || '-',
        itensStr,
        p.total.toFixed(2).replace('.', ','),
        p.desconto.toFixed(2).replace('.', ','),
        p.total_final.toFixed(2).replace('.', ','),
        p.status_checklist ? 'CONCLUÍDO' : 'PENDENTE'
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pedidos_hc_vape_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-black asphalt-texture flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#39FF14] animate-spin mx-auto mb-4" />
          <p className="text-[#39FF14] font-['Orbitron'] font-bold">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-black asphalt-texture flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-morphism p-8 rounded-xl">
          <h1 className="text-3xl font-bold neon-glow font-['Orbitron'] mb-2 text-center">ADMIN</h1>
          <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-center mb-8">Área restrita — HC Vape</p>

          {erro && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-400 text-sm font-['Roboto_Mono']">{erro}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-3 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']" placeholder="admin@exemplo.com" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-3 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={salvando} className="cyber-button w-full disabled:opacity-50 disabled:cursor-not-allowed">
              {salvando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black asphalt-texture">
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-[#39FF14]/30">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold neon-glow font-['Orbitron']">ADMIN</h1>
            <p className="text-xs text-[#C0C0C0] font-['Roboto_Mono']">{usuarioEmail}</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="px-4 py-2 bg-[#39FF14]/10 border border-[#39FF14]/50 text-[#39FF14] rounded-lg font-['Orbitron'] font-bold text-sm hover:bg-[#39FF14]/20 transition-all duration-300">Ver Catálogo</a>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-['Orbitron'] font-bold text-sm hover:bg-red-500/30 transition-all duration-300">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {erro && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 font-['Roboto_Mono']">{erro}</p>
            <button onClick={() => setErro(null)} className="ml-auto"><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        {sucesso && (
          <div className="p-4 bg-[#39FF14]/20 border border-[#39FF14] rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#39FF14] flex items-center justify-center flex-shrink-0">
              <span className="text-black text-xs font-bold">✓</span>
            </div>
            <p className="text-[#39FF14] font-['Roboto_Mono']">{sucesso}</p>
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-4 border-b border-[#39FF14]/20 pb-1">
          <button onClick={() => setAbaAtiva('produtos')} className={`flex items-center gap-2 px-6 py-3 font-['Orbitron'] font-bold transition-all duration-300 border-b-2 ${abaAtiva === 'produtos' ? 'text-[#39FF14] border-[#39FF14]' : 'text-[#808080] border-transparent hover:text-[#C0C0C0]'}`}>
            <Box className="w-4 h-4" /> Produtos
          </button>
          <button onClick={() => setAbaAtiva('pedidos')} className={`flex items-center gap-2 px-6 py-3 font-['Orbitron'] font-bold transition-all duration-300 border-b-2 ${abaAtiva === 'pedidos' ? 'text-[#39FF14] border-[#39FF14]' : 'text-[#808080] border-transparent hover:text-[#C0C0C0]'}`}>
            <ShoppingBag className="w-4 h-4" /> Pedidos
            {pedidos.filter(p => !p.status_checklist).length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                {pedidos.filter(p => !p.status_checklist).length}
              </span>
            )}
          </button>
        </div>

        {abaAtiva === 'produtos' ? (
          <>
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold neon-glow font-['Orbitron']">Produtos ({produtos.length})</h2>
                <div className="flex gap-3">
                  <button onClick={handleExportarProdutos} className="flex items-center gap-2 px-4 py-2 bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] rounded-lg font-['Orbitron'] font-bold hover:bg-[#39FF14]/30 transition-all duration-300">
                    <Download className="w-4 h-4" /> Exportar Estoque
                  </button>
                  <button onClick={abrirModalNovo} className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black rounded-lg font-['Orbitron'] font-bold hover:shadow-[0_0_15px_rgba(57,255,20,0.5)] transition-all duration-300">
                    <Plus className="w-4 h-4" /> Novo Produto
                  </button>
                </div>
              </div>

              {produtos.length === 0 ? (
                <div className="glass-morphism p-12 rounded-xl text-center">
                  <p className="text-[#808080] font-['Roboto_Mono']">Nenhum produto cadastrado</p>
                </div>
              ) : (
                <div className="glass-morphism rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#39FF14]/30 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        <th className="py-3 px-4">Img</th>
                        <th className="py-3 px-4">Marca</th>
                        <th className="py-3 px-4">Nome</th>
                        <th className="py-3 px-4">Preço</th>
                        <th className="py-3 px-4">Estoque</th>
                        <th className="py-3 px-4">Novo Est.</th>
                        <th className="py-3 px-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((produto) => (
                        <tr key={produto.id} className="border-b border-[#39FF14]/10 hover:bg-[#39FF14]/5 transition-colors duration-200 text-sm">
                          <td className="py-3 px-4">
                            {produto.imagem_url ? <img src={produto.imagem_url} alt={produto.nome} className="w-10 h-10 object-cover rounded border border-[#39FF14]/30" /> : <ImageOff className="w-6 h-6 text-[#606060]" />}
                          </td>
                          <td className="py-3 px-4 text-[#C0C0C0] font-['Roboto_Mono']">{produto.marca}</td>
                          <td className="py-3 px-4 text-[#E0E0E0] font-['Roboto_Mono']">{produto.nome} {produto.is_promo && <Zap className="inline w-3 h-3 text-red-400" />}</td>
                          <td className="py-3 px-4 text-[#39FF14] font-bold">R$ {produto.preco.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${produto.estoque > 0 ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-red-500/20 text-red-400'}`}>{produto.estoque}</span>
                          </td>
                          <td className="py-3 px-4">
                            <input type="number" min="0" value={estoqueEditado[produto.id] ?? produto.estoque} onChange={(e) => setEstoqueEditado({ ...estoqueEditado, [produto.id]: parseInt(e.target.value) || 0 })} className="w-16 bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-1 py-0.5 rounded focus:border-[#39FF14] outline-none" />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <button onClick={() => handleAtualizarEstoque(produto.id)} disabled={salvando || estoqueEditado[produto.id] === undefined} className="p-1.5 bg-[#39FF14] text-black rounded disabled:opacity-50"><Save className="w-3 h-3" /></button>
                              <button onClick={() => abrirModalEditar(produto)} className="p-1.5 bg-blue-500/20 border border-blue-500 text-blue-400 rounded"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeletarProduto(produto.id, produto.nome)} className="p-1.5 bg-red-500/20 border border-red-500 text-red-400 rounded"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          /* SEÇÃO DE PEDIDOS COM DASHBOARD */
          <section className="space-y-8">
            {/* Dashboard de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-morphism p-5 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/5">
                <p className="text-[10px] font-bold text-[#39FF14] uppercase font-['Orbitron'] mb-1">Faturamento Total</p>
                <h3 className="text-2xl font-bold text-[#E0E0E0] font-['Roboto_Mono']">
                  R$ {pedidos.reduce((acc, p) => acc + p.total_final, 0).toFixed(2)}
                </h3>
                <p className="text-[10px] text-[#808080] mt-1">Líquido (após descontos)</p>
              </div>

              <div className="glass-morphism p-5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <p className="text-[10px] font-bold text-blue-400 uppercase font-['Orbitron'] mb-1">Itens Vendidos</p>
                <h3 className="text-2xl font-bold text-[#E0E0E0] font-['Roboto_Mono']">
                  {pedidos.reduce((acc, p) => acc + p.itens.reduce((sum, i) => sum + i.quantidade, 0), 0)} un
                </h3>
                <p className="text-[10px] text-[#808080] mt-1">Total de pods em pedidos</p>
              </div>

              <div className="glass-morphism p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                <p className="text-[10px] font-bold text-yellow-500 uppercase font-['Orbitron'] mb-1">Status Pedidos</p>
                <div className="flex gap-3 items-baseline">
                  <h3 className="text-2xl font-bold text-[#E0E0E0] font-['Roboto_Mono']">
                    {pedidos.filter(p => !p.status_checklist).length}
                  </h3>
                  <span className="text-xs text-yellow-500 font-bold">Pendentes</span>
                </div>
                <p className="text-[10px] text-[#808080] mt-1">{pedidos.filter(p => p.status_checklist).length} Concluídos</p>
              </div>

              <div className="glass-morphism p-5 rounded-xl border border-red-500/20 bg-red-500/5">
                <p className="text-[10px] font-bold text-red-400 uppercase font-['Orbitron'] mb-1">Top Indicação</p>
                <h3 className="text-xl font-bold text-[#E0E0E0] font-['Roboto_Mono'] truncate">
                  {(() => {
                    const counts: { [key: string]: number } = {};
                    pedidos.forEach(p => { if(p.indicacao) counts[p.indicacao] = (counts[p.indicacao] || 0) + 1 });
                    const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
                    return top ? `${top[0]} (${top[1]})` : 'Nenhuma';
                  })()}
                </h3>
                <p className="text-[10px] text-[#808080] mt-1">Origem com mais vendas</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold neon-glow font-['Orbitron']">Lista de Pedidos</h2>
              <button onClick={handleExportarPedidos} className="flex items-center gap-2 px-4 py-2 bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] rounded-lg font-['Orbitron'] font-bold hover:bg-[#39FF14]/30 transition-all duration-300">
                <Download className="w-4 h-4" /> Exportar Vendas
              </button>
            </div>

            <div className="grid gap-6">
              {pedidos.map((pedido) => (
                <div key={pedido.id} className={`glass-morphism p-6 rounded-xl border transition-all duration-300 ${pedido.status_checklist ? 'border-[#39FF14]/20 opacity-80' : 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${pedido.status_checklist ? 'bg-[#39FF14]/20' : 'bg-yellow-500/20'}`}>
                        <ShoppingBag className={`w-6 h-6 ${pedido.status_checklist ? 'text-[#39FF14]' : 'text-yellow-500'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-[#E0E0E0] font-['Orbitron']">Pedido #{pedido.numero_pedido}</h3>
                          {pedido.status_checklist ? <span className="px-2 py-0.5 bg-[#39FF14]/20 text-[#39FF14] rounded text-[10px] font-bold">CONCLUÍDO</span> : <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded text-[10px] font-bold">PENDENTE</span>}
                        </div>
                        <p className="text-xs text-[#808080] font-['Roboto_Mono']">{pedido.created_at ? new Date(pedido.created_at).toLocaleString('pt-BR') : '-'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAtualizarStatusPedido(pedido.id, !pedido.status_checklist)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-['Orbitron'] font-bold text-xs transition-all duration-300 ${pedido.status_checklist ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-[#39FF14] text-black'}`}>
                        {pedido.status_checklist ? 'Reabrir' : 'Checklist'}
                      </button>
                      <button onClick={() => handleDeletarPedido(pedido.id, pedido.numero_pedido)} className="p-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4 text-sm font-['Roboto_Mono']">
                      <div className="bg-black/30 p-4 rounded-lg border border-[#39FF14]/10">
                        <h4 className="text-[10px] font-bold text-[#39FF14] uppercase mb-2">Itens</h4>
                        {pedido.itens.map((item, idx) => (
                          <div key={idx} className="flex justify-between border-b border-[#39FF14]/5 py-1">
                            <span>{item.quantidade}x {item.nome} ({item.sabor})</span>
                            <span className="text-[#39FF14]">R$ {(item.preco_unitario * item.quantidade).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between px-2">
                        <div><h4 className="text-[10px] text-[#808080] uppercase">Cliente</h4><p className="text-[#E0E0E0]">{pedido.nome_cliente}</p></div>
                        <div className="text-right"><h4 className="text-[10px] text-[#808080] uppercase">WhatsApp</h4><p className="text-[#39FF14]">{pedido.telefone_cliente}</p></div>
                      </div>
                      <div className="px-2">
                        <h4 className="text-[10px] text-[#808080] uppercase">Indicação</h4>
                        <p className="text-blue-400 font-bold">{pedido.indicacao || 'Nenhuma'}</p>
                      </div>
                    </div>

                    <div className="bg-black/30 p-4 rounded-lg border border-[#39FF14]/20 flex flex-col justify-center space-y-2">
                      <div className="flex justify-between text-xs"><span>Subtotal</span><span>R$ {pedido.total.toFixed(2)}</span></div>
                      <div className="flex justify-between items-center text-xs">
                        <span>Desconto</span>
                        {editandoFinanceiro?.id === pedido.id ? (
                          <div className="flex gap-1"><input type="number" value={editandoFinanceiro.desconto} onChange={(e) => setEditandoFinanceiro({ ...editandoFinanceiro, desconto: e.target.value })} className="w-16 bg-black border border-[#39FF14]/50 px-1 py-0.5 text-right outline-none" /><button onClick={() => handleAtualizarFinanceiroPedido(pedido.id)} className="p-0.5 bg-[#39FF14] text-black rounded"><Save className="w-3 h-3" /></button></div>
                        ) : (
                          <div className="flex gap-1 text-red-400"><span>- R$ {pedido.desconto.toFixed(2)}</span><button onClick={() => setEditandoFinanceiro({ id: pedido.id, desconto: pedido.desconto.toString() })}><Edit2 className="w-3 h-3" /></button></div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-[#39FF14]/20 flex justify-between font-bold text-[#39FF14]"><span className="font-['Orbitron']">TOTAL</span><span className="text-2xl font-['Roboto_Mono']">R$ {pedido.total_final.toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Modal Produto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-morphism p-6 rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold neon-glow font-['Orbitron']">{editandoId ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={fecharModal} className="p-2 hover:bg-[#39FF14]/20 rounded-lg"><X className="w-6 h-6 text-[#39FF14]" /></button>
            </div>
            <form onSubmit={handleSalvarProduto} className="space-y-4">
              <div className="border border-[#39FF14]/30 rounded-xl p-4 bg-black/30">
                <label className="flex items-center gap-2 text-sm font-bold text-[#C0C0C0] mb-3 font-['Orbitron']"><ImagePlus className="w-4 h-4 text-[#39FF14]" /> Imagem</label>
                {(imagemPreview || (imagemUrlAtual && !removerImagem)) ? (
                  <div className="relative mb-3"><img src={imagemPreview || imagemUrlAtual || ''} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-[#39FF14]/50" /><button type="button" onClick={handleRemoverImagem} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full"><X className="w-4 h-4" /></button></div>
                ) : (
                  <div onClick={() => inputImagemRef.current?.click()} className="w-full h-32 border-2 border-dashed border-[#39FF14]/40 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#39FF14] transition-all"><ImagePlus className="w-8 h-8 text-[#39FF14]/50 mb-2" /><p className="text-[#808080] text-xs">Clique para selecionar</p></div>
                )}
                <input ref={inputImagemRef} type="file" accept="image/*" onChange={handleSelecionarImagem} className="hidden" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#C0C0C0] uppercase font-['Orbitron']">Marca</label>
                <select value={marcaCustomizada ? '' : formProduto.marca} onChange={(e) => { setFormProduto({ ...formProduto, marca: e.target.value }); setMarcaCustomizada(''); }} className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg outline-none font-['Roboto_Mono']">
                  <option value="">Selecione uma marca</option>
                  {marcas.map(marca => <option key={marca} value={marca}>{marca}</option>)}
                  <option value="">─ Outra marca ─</option>
                </select>
                {formProduto.marca === '' && <input type="text" value={marcaCustomizada} onChange={(e) => setMarcaCustomizada(e.target.value)} placeholder="Digite a marca" className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg outline-none font-['Roboto_Mono']" />}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#C0C0C0] uppercase font-['Orbitron']">Nome</label>
                <input type="text" value={formProduto.nome} onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })} className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg outline-none font-['Roboto_Mono']" placeholder="ex: IGNITE 8.000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#C0C0C0] uppercase font-['Orbitron']">Preço (R$)</label>
                  <input type="number" step="0.01" value={formProduto.preco} onChange={(e) => setFormProduto({ ...formProduto, preco: e.target.value })} className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg outline-none font-['Roboto_Mono']" placeholder="115.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#C0C0C0] uppercase font-['Orbitron']">Estoque</label>
                  <input type="number" value={formProduto.estoque} onChange={(e) => setFormProduto({ ...formProduto, estoque: e.target.value })} className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg outline-none font-['Roboto_Mono']" placeholder="50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#C0C0C0] uppercase font-['Orbitron']">Sabores (vírgula)</label>
                <textarea value={formProduto.sabores} onChange={(e) => setFormProduto({ ...formProduto, sabores: e.target.value })} className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg outline-none font-['Roboto_Mono'] h-20 resize-none" placeholder="Limão, Manga, Banana" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formProduto.is_promo} onChange={(e) => setFormProduto({ ...formProduto, is_promo: e.target.checked })} className="accent-[#39FF14]" />
                <label className="text-xs font-bold text-[#C0C0C0] uppercase font-['Orbitron']">Promoção?</label>
              </div>
              {formProduto.is_promo && (
                <input type="number" step="0.01" value={formProduto.preco_promo} onChange={(e) => setFormProduto({ ...formProduto, preco_promo: e.target.value })} className="w-full bg-black/60 border border-red-500/50 text-[#E0E0E0] px-4 py-2 rounded-lg outline-none font-['Roboto_Mono']" placeholder="Preço Promo" />
              )}
              <button type="submit" disabled={salvando || uploadandoImagem} className="cyber-button w-full flex items-center justify-center gap-2">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : editandoId ? 'Atualizar' : 'Criar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
