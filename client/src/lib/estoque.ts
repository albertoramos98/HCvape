// =========================================================================
// HC VAPE - MÓDULO CENTRALIZADO DE CÁLCULO E VALIDAÇÃO DE ESTOQUE
// Fonte única da verdade no cliente: estoque_zonas
// =========================================================================

import { normalizarZonaId, ZONAS_DISPONIVEIS } from '../../../shared/zonas';
import type { ZonaId } from '../../../shared/zonas';

export { normalizarZonaId, ZONAS_DISPONIVEIS };
export type { ZonaId };

export interface EstoqueZona {
  estoque: number;
  sabores_estoque?: { [sabor: string]: number };
}

export type EstoqueZonasMap = Partial<Record<string, EstoqueZona>>;

export interface ProdutoEstoqueInfo {
  estoque: number;
  saboresEstoque: { [sabor: string]: number };
  saboresDisponiveis: string[];
  possuiEstoqueNaZona: boolean;
  isIlimitado: boolean;
}

export interface ProdutoBasico {
  id: string;
  nome: string;
  marca: string;
  estoque: number;
  sabores: string[];
  sabores_estoque?: { [sabor: string]: number } | null;
  zonas?: string[] | null;
  estoque_zonas?: EstoqueZonasMap | null;
  estoque_ilimitado?: boolean | null;
  is_promo?: boolean | null;
  ativo?: boolean | null;
}

/**
 * Normaliza o nome do sabor para casamento semântico resiliente:
 * - Remove acentos
 * - Converte para minúsculas
 * - Colapsa espaços múltiplos em espaço único
 * - Remove espaços das pontas
 */
export function normalizarNomeSabor(sabor: string): string {
  if (!sabor) return '';
  return sabor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Localiza o sabor correspondente na lista de sabores cadastrados:
 * 1º Passo: Casamento Exato
 * 2º Passo: Casamento Normalizado (sem acentos, minúsculas, espaços colapsados)
 */
export function casarSabor(saboresDisponiveis: string[], saborBuscado: string): string | null {
  if (!saborBuscado || !saboresDisponiveis || saboresDisponiveis.length === 0) {
    return null;
  }

  // 1º Passo: Match exato
  if (saboresDisponiveis.includes(saborBuscado)) {
    return saborBuscado;
  }

  // 2º Passo: Match normalizado
  const buscadoNorm = normalizarNomeSabor(saborBuscado);
  for (const s of saboresDisponiveis) {
    if (normalizarNomeSabor(s) === buscadoNorm) {
      return s;
    }
  }

  return null;
}

/**
 * Centralizador oficial de leitura de estoque por zona para Home, Admin e HeroBanner.
 * Considera 'estoque_zonas' como a fonte única da verdade.
 */
export function obterEstoqueProdutoPorZona(
  produto: ProdutoBasico,
  zonaInput: ZonaId | string | null | undefined
): ProdutoEstoqueInfo {
  // 1. Produtos com estoque ilimitado
  if (produto.estoque_ilimitado) {
    const mapaIlimitado: { [sabor: string]: number } = {};
    produto.sabores.forEach(s => {
      mapaIlimitado[s] = 999;
    });

    return {
      estoque: 999,
      saboresEstoque: mapaIlimitado,
      saboresDisponiveis: [...produto.sabores],
      possuiEstoqueNaZona: true,
      isIlimitado: true
    };
  }

  const zonaNormalizada = normalizarZonaId(zonaInput);
  const zona = zonaNormalizada || (zonaInput && produto.estoque_zonas?.[zonaInput] ? (zonaInput as any) : null);

  // 2. Se o produto tiver lista restrita de zonas e a zona solicitada não estiver atendida
  if (zona && produto.zonas && Array.isArray(produto.zonas) && produto.zonas.length > 0) {
    const atende = produto.zonas.some(z => {
      const zNorm = normalizarZonaId(z) || z;
      if (!zNorm) return false;
      if (zona === 'recife') {
        return zNorm === 'recife' || zNorm === 'norte' || zNorm === 'sul_oeste' || zNorm === 'sul' || zNorm === 'oeste';
      }
      return zNorm === zona;
    });

    if (!atende) {
      return {
        estoque: 0,
        saboresEstoque: {},
        saboresDisponiveis: [],
        possuiEstoqueNaZona: false,
        isIlimitado: false
      };
    }
  }

  // 3. Se nenhuma zona foi especificada, usar estoque geral consolidado da fonte única
  if (!zona) {
    let estoqueTotal = 0;
    const saboresConsolidados: { [sabor: string]: number } = {};

    if (produto.estoque_zonas && Object.keys(produto.estoque_zonas).length > 0) {
      Object.values(produto.estoque_zonas).forEach(zData => {
        if (!zData) return;
        const zSabores = zData.sabores_estoque || {};
        Object.entries(zSabores).forEach(([sabor, qtd]) => {
          saboresConsolidados[sabor] = (saboresConsolidados[sabor] || 0) + (Number(qtd) || 0);
          estoqueTotal += (Number(qtd) || 0);
        });
      });
    } else {
      // Fallback para produto legado sem estoque_zonas
      estoqueTotal = produto.estoque || 0;
      Object.assign(saboresConsolidados, produto.sabores_estoque || {});
    }

    const saboresDisponiveis = produto.sabores.filter(s => (saboresConsolidados[s] ?? 0) > 0);

    return {
      estoque: estoqueTotal,
      saboresEstoque: saboresConsolidados,
      saboresDisponiveis,
      possuiEstoqueNaZona: estoqueTotal > 0 && (produto.sabores.length === 0 || saboresDisponiveis.length > 0),
      isIlimitado: false
    };
  }

  // 4. Leitura a partir de 'estoque_zonas' para a zona especificada
  if (produto.estoque_zonas && Object.keys(produto.estoque_zonas).length > 0) {
    let zonaData = produto.estoque_zonas[zona];

    // Mapeamentos de zonas subdivididas de Recife
    if (!zonaData && zona === 'recife') {
      zonaData = produto.estoque_zonas['recife'] 
        || produto.estoque_zonas['sul_oeste'] 
        || produto.estoque_zonas['norte']
        || produto.estoque_zonas['sul']
        || produto.estoque_zonas['oeste'];
    }

    if (zonaData) {
      const saboresZona = zonaData.sabores_estoque || {};
      const temControleSabores = Object.keys(saboresZona).length > 0;

      const saboresDisponiveis = produto.sabores.filter(sabor => {
        const chaveReal = casarSabor(Object.keys(saboresZona), sabor);
        if (chaveReal && temControleSabores) {
          return (saboresZona[chaveReal] ?? 0) > 0;
        }
        return (zonaData?.estoque ?? 0) > 0;
      });

      const totalCalculado = temControleSabores
        ? Object.values(saboresZona).reduce((acc, v) => acc + (Number(v) || 0), 0)
        : (zonaData.estoque ?? 0);

      return {
        estoque: totalCalculado,
        saboresEstoque: saboresZona,
        saboresDisponiveis,
        possuiEstoqueNaZona: totalCalculado > 0 && (produto.sabores.length === 0 || saboresDisponiveis.length > 0),
        isIlimitado: false
      };
    } else {
      // Zona não possui configuração cadastrada no produto
      return {
        estoque: 0,
        saboresEstoque: {},
        saboresDisponiveis: [],
        possuiEstoqueNaZona: false,
        isIlimitado: false
      };
    }
  }

  // 5. Fallback para produtos legados sem estoque_zonas
  const saboresLegados = produto.sabores_estoque || {};
  const disponiveisLegados = produto.sabores.filter(s => (saboresLegados[s] ?? 0) > 0);

  return {
    estoque: produto.estoque || 0,
    saboresEstoque: saboresLegados,
    saboresDisponiveis: disponiveisLegados,
    possuiEstoqueNaZona: (produto.estoque || 0) > 0 && (produto.sabores.length === 0 || disponiveisLegados.length > 0),
    isIlimitado: false
  };
}
