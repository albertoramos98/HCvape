import { useState, useEffect, useRef } from 'react';
import { LogOut, Save, AlertCircle, Loader2, Plus, Trash2, Edit2, X, Zap, ImagePlus, ImageOff } from 'lucide-react';
import { authService, produtosService, imagemService, Produto, utils } from '@/lib/supabase';

/**
 * Página Admin - Gerenciamento Completo de Estoque + Promoções + Imagens
 * Design: Cyberpunk Dark Mode com Neon Verde
 * Acesso: Protegido por autenticação Supabase
 * CRUD: Criar, Ler, Atualizar, Deletar produtos + Promoções + Upload de Imagens
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
  const [marcas, setMarcas] = useState<string[]>([]);
  const [estoqueEditado, setEstoqueEditado] = useState<EstoqueEditado>({});
  const [salvando, setSalvando] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState<string>('');

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
          await carregarProdutos();
          await carregarMarcas();
        }
      } catch (err) {
        console.error('Erro ao verificar autenticação:', err);
      } finally {
        setCarregando(false);
      }
    };

    verificarAuth();
  }, []);

  // Carregar produtos
  const carregarProdutos = async () => {
    try {
      setErro(null);
      const dados = await produtosService.obterTodos();
      setProdutos(dados);
      setEstoqueEditado({});
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setErro('Erro ao carregar produtos');
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
      await carregarProdutos();
      await carregarMarcas();
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

  // Tela de Login
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-black asphalt-texture flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-morphism p-8 rounded-xl">
          <h1 className="text-3xl font-bold neon-glow font-['Orbitron'] mb-2 text-center">
            ADMIN
          </h1>
          <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-center mb-8">
            Área restrita — HC Vape
          </p>

          {erro && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-400 text-sm font-['Roboto_Mono']">{erro}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-3 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                placeholder="admin@exemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-3 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="cyber-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Painel Admin
  return (
    <div className="min-h-screen bg-black asphalt-texture">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-[#39FF14]/30">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold neon-glow font-['Orbitron']">ADMIN</h1>
            <p className="text-xs text-[#C0C0C0] font-['Roboto_Mono']">{usuarioEmail}</p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="px-4 py-2 bg-[#39FF14]/10 border border-[#39FF14]/50 text-[#39FF14] rounded-lg font-['Orbitron'] font-bold text-sm hover:bg-[#39FF14]/20 transition-all duration-300"
            >
              Ver Catálogo
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-['Orbitron'] font-bold text-sm hover:bg-red-500/30 transition-all duration-300"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Alertas */}
        {erro && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 font-['Roboto_Mono']">{erro}</p>
            <button onClick={() => setErro(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-400" />
            </button>
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

        {/* Cabeçalho da seção de produtos */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold neon-glow font-['Orbitron']">
              Produtos ({produtos.length})
            </h2>
            <button
              onClick={abrirModalNovo}
              className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black rounded-lg font-['Orbitron'] font-bold hover:shadow-[0_0_15px_rgba(57,255,20,0.5)] transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              Novo Produto
            </button>
          </div>

          {/* Tabela de Produtos */}
          {produtos.length === 0 ? (
            <div className="glass-morphism p-12 rounded-xl text-center">
              <p className="text-[#808080] font-['Roboto_Mono']">Nenhum produto cadastrado</p>
              <button
                onClick={abrirModalNovo}
                className="mt-4 px-6 py-2 bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] rounded-lg font-['Orbitron'] font-bold hover:bg-[#39FF14]/30 transition-all duration-300"
              >
                Criar primeiro produto
              </button>
            </div>
          ) : (
            <div className="glass-morphism rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#39FF14]/30">
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Img
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Marca
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Nome
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Preço
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Estoque
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Novo Est.
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Promo
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-[#39FF14] font-['Orbitron'] uppercase">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((produto) => (
                      <tr
                        key={produto.id}
                        className="border-b border-[#39FF14]/10 hover:bg-[#39FF14]/5 transition-colors duration-200"
                      >
                        {/* Miniatura da imagem */}
                        <td className="py-3 px-4">
                          {produto.imagem_url ? (
                            <img
                              src={produto.imagem_url}
                              alt={produto.nome}
                              className="w-12 h-12 object-cover rounded-lg border border-[#39FF14]/30 hover:border-[#39FF14] transition-all duration-300"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-dashed border-[#39FF14]/20 flex items-center justify-center">
                              <ImageOff className="w-4 h-4 text-[#606060]" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#C0C0C0] font-['Roboto_Mono'] text-sm">
                          {produto.marca}
                        </td>
                        <td className="py-3 px-4 text-[#E0E0E0] font-['Roboto_Mono']">
                          {produto.nome}
                        </td>
                        <td className="py-3 px-4 text-[#39FF14] font-['Roboto_Mono'] font-bold">
                          R$ {produto.preco.toFixed(2)}
                          {produto.is_promo && produto.preco_promo && (
                            <div className="text-xs text-red-400 line-through">
                              R$ {produto.preco_promo.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-['Roboto_Mono']">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-bold ${
                              produto.estoque > 0
                                ? 'bg-[#39FF14]/20 text-[#39FF14]'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {produto.estoque}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="0"
                            value={estoqueEditado[produto.id] ?? produto.estoque}
                            onChange={(e) =>
                              setEstoqueEditado({
                                ...estoqueEditado,
                                [produto.id]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20 bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-2 py-1 rounded focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                          />
                        </td>
                        <td className="py-3 px-4">
                          {produto.is_promo ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold">
                              <Zap className="w-3 h-3" />
                              Ativo
                            </span>
                          ) : (
                            <span className="text-[#808080] text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => handleAtualizarEstoque(produto.id)}
                              disabled={
                                salvando ||
                                estoqueEditado[produto.id] === undefined ||
                                estoqueEditado[produto.id] === produto.estoque
                              }
                              className="flex items-center gap-1 px-2 py-1 bg-[#39FF14] text-black rounded text-xs font-['Orbitron'] font-bold hover:shadow-[0_0_10px_rgba(57,255,20,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Save className="w-3 h-3" />
                              Salvar
                            </button>
                            <button
                              onClick={() => abrirModalEditar(produto)}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500 text-blue-400 rounded text-xs font-['Orbitron'] font-bold hover:bg-blue-500/30 transition-all duration-300"
                            >
                              <Edit2 className="w-3 h-3" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeletarProduto(produto.id, produto.nome)}
                              className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500 text-red-400 rounded text-xs font-['Orbitron'] font-bold hover:bg-red-500/30 transition-all duration-300"
                            >
                              <Trash2 className="w-3 h-3" />
                              Deletar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Estatísticas */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-morphism p-6 rounded-xl text-center">
            <p className="text-[#C0C0C0] font-['Orbitron'] font-bold text-xs mb-2">Total</p>
            <p className="text-4xl font-bold neon-glow font-['Roboto_Mono']">
              {produtos.length}
            </p>
          </div>
          <div className="glass-morphism p-6 rounded-xl text-center">
            <p className="text-[#C0C0C0] font-['Orbitron'] font-bold text-xs mb-2">Em Estoque</p>
            <p className="text-4xl font-bold text-[#39FF14] font-['Roboto_Mono']">
              {produtos.filter(p => p.estoque > 0).length}
            </p>
          </div>
          <div className="glass-morphism p-6 rounded-xl text-center">
            <p className="text-[#C0C0C0] font-['Orbitron'] font-bold text-xs mb-2">Esgotados</p>
            <p className="text-4xl font-bold text-red-400 font-['Roboto_Mono']">
              {produtos.filter(p => p.estoque <= 0).length}
            </p>
          </div>
          <div className="glass-morphism p-6 rounded-xl text-center">
            <p className="text-[#C0C0C0] font-['Orbitron'] font-bold text-xs mb-2">Com Imagem</p>
            <p className="text-4xl font-bold text-blue-400 font-['Roboto_Mono']">
              {produtos.filter(p => p.imagem_url).length}
            </p>
          </div>
        </section>
      </main>

      {/* Modal Criar/Editar Produto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-morphism p-6 rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold neon-glow font-['Orbitron']">
                {editandoId ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button
                onClick={fecharModal}
                className="p-2 hover:bg-[#39FF14]/20 rounded-lg transition-all duration-300"
              >
                <X className="w-6 h-6 text-[#39FF14]" />
              </button>
            </div>

            <form onSubmit={handleSalvarProduto} className="space-y-4">

              {/* ── SEÇÃO DE IMAGEM ── */}
              <div className="border border-[#39FF14]/30 rounded-xl p-4 bg-black/30">
                <label className="flex items-center gap-2 text-sm font-bold text-[#C0C0C0] mb-3 font-['Orbitron']">
                  <ImagePlus className="w-4 h-4 text-[#39FF14]" />
                  Imagem do Produto
                  <span className="text-[#606060] font-normal text-xs">(opcional)</span>
                </label>

                {/* Preview da imagem */}
                {(imagemPreview || (imagemUrlAtual && !removerImagem)) ? (
                  <div className="relative mb-3">
                    <img
                      src={imagemPreview || imagemUrlAtual || ''}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg border border-[#39FF14]/50"
                    />
                    <button
                      type="button"
                      onClick={handleRemoverImagem}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-300 shadow-lg"
                      title="Remover imagem"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {imagemArquivo && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-[#39FF14] text-xs px-2 py-1 rounded font-['Roboto_Mono']">
                        Nova imagem selecionada
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => inputImagemRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-[#39FF14]/40 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#39FF14] hover:bg-[#39FF14]/5 transition-all duration-300 mb-3"
                  >
                    <ImagePlus className="w-10 h-10 text-[#39FF14]/50 mb-2" />
                    <p className="text-[#808080] text-sm font-['Roboto_Mono']">
                      Clique para selecionar imagem
                    </p>
                    <p className="text-[#606060] text-xs font-['Roboto_Mono'] mt-1">
                      JPG, PNG, WebP — máx. 5MB
                    </p>
                  </div>
                )}

                <input
                  ref={inputImagemRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelecionarImagem}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => inputImagemRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-[#39FF14]/10 border border-[#39FF14]/50 text-[#39FF14] rounded-lg text-xs font-['Orbitron'] font-bold hover:bg-[#39FF14]/20 transition-all duration-300"
                  >
                    <ImagePlus className="w-3 h-3" />
                    {imagemPreview || (imagemUrlAtual && !removerImagem) ? 'Trocar' : 'Selecionar'}
                  </button>

                  {(imagemPreview || (imagemUrlAtual && !removerImagem)) && (
                    <button
                      type="button"
                      onClick={handleRemoverImagem}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-xs font-['Orbitron'] font-bold hover:bg-red-500/20 transition-all duration-300"
                    >
                      <ImageOff className="w-3 h-3" />
                      Remover
                    </button>
                  )}
                </div>
              </div>

              {/* Marca com Combobox */}
              <div>
                <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                  Marca
                </label>
                <div className="space-y-2">
                  <select
                    value={marcaCustomizada ? '' : formProduto.marca}
                    onChange={(e) => {
                      setFormProduto({ ...formProduto, marca: e.target.value });
                      setMarcaCustomizada('');
                    }}
                    className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                  >
                    <option value="">Selecione uma marca</option>
                    {marcas.map(marca => (
                      <option key={marca} value={marca}>
                        {marca}
                      </option>
                    ))}
                    <option value="">─ Outra marca ─</option>
                  </select>

                  {formProduto.marca === '' && (
                    <input
                      type="text"
                      value={marcaCustomizada}
                      onChange={(e) => setMarcaCustomizada(e.target.value)}
                      placeholder="Digite uma nova marca"
                      className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                  Nome do Produto
                </label>
                <input
                  type="text"
                  value={formProduto.nome}
                  onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })}
                  className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                  placeholder="ex: IGNITE 8.000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formProduto.preco}
                    onChange={(e) => setFormProduto({ ...formProduto, preco: e.target.value })}
                    className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                    placeholder="115.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                    Estoque
                  </label>
                  <input
                    type="number"
                    value={formProduto.estoque}
                    onChange={(e) => setFormProduto({ ...formProduto, estoque: e.target.value })}
                    className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                    placeholder="50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                  Sabores (separados por vírgula)
                </label>
                <textarea
                  value={formProduto.sabores}
                  onChange={(e) => setFormProduto({ ...formProduto, sabores: e.target.value })}
                  className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-2 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono'] h-20 resize-none"
                  placeholder="Limão com Manga, Banana e Cereja, Mirtilo com Limão"
                />
              </div>

              {/* Campos de Promoção */}
              <div className="border-t border-[#39FF14]/30 pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formProduto.is_promo}
                    onChange={(e) => setFormProduto({ ...formProduto, is_promo: e.target.checked })}
                    className="w-4 h-4 accent-[#39FF14]"
                  />
                  <span className="text-sm font-bold text-[#C0C0C0] font-['Orbitron']">
                    🔥 Produto em Promoção?
                  </span>
                </label>
              </div>

              {formProduto.is_promo && (
                <div>
                  <label className="block text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                    Preço Promocional (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formProduto.preco_promo}
                    onChange={(e) => setFormProduto({ ...formProduto, preco_promo: e.target.value })}
                    className="w-full bg-black/60 border border-red-500/50 text-[#E0E0E0] px-4 py-2 rounded-lg focus:border-red-500 focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                    placeholder="99.00"
                  />
                  <p className="text-xs text-red-400 mt-1 font-['Roboto_Mono']">
                    Deve ser menor que o preço original
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={salvando || uploadandoImagem}
                className="cyber-button w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadandoImagem ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando imagem...
                  </>
                ) : salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editandoId ? 'Atualizar Produto' : 'Criar Produto'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
