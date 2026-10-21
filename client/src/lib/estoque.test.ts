import { describe, it, expect } from 'vitest';
import { 
  normalizarNomeSabor, 
  casarSabor, 
  obterEstoqueProdutoPorZona, 
  normalizarZonaId,
  ProdutoBasico
} from './estoque';

describe('Helpers de Normalização e Casamento de Sabores', () => {
  it('deve normalizar texto removendo acentos, espaços extras e convertendo para minúsculas', () => {
    expect(normalizarNomeSabor('Morango  kiwi + Fresh mint')).toBe('morango kiwi + fresh mint');
    expect(normalizarNomeSabor('  Melancia   ICE  ')).toBe('melancia ice');
    expect(normalizarNomeSabor('Mirtilo com Limão')).toBe('mirtilo com limao');
    expect(normalizarNomeSabor('')).toBe('');
  });

  it('deve casar sabor exato prioritariamente', () => {
    const lista = ['Menta Ice', 'Uva Ice', 'Manga Ice'];
    expect(casarSabor(lista, 'Menta Ice')).toBe('Menta Ice');
    expect(casarSabor(lista, 'Uva Ice')).toBe('Uva Ice');
  });

  it('deve casar sabor por aproximação normalizada (maiúsculas, espaços e acentos)', () => {
    const lista = ['Limão com Manga', 'Melancia Congelada'];
    expect(casarSabor(lista, '  limao  com   manga  ')).toBe('Limão com Manga');
    expect(casarSabor(lista, 'melancia congelada')).toBe('Melancia Congelada');
  });

  it('deve retornar null se o sabor não existir na lista', () => {
    const lista = ['Menta Ice', 'Uva Ice'];
    expect(casarSabor(lista, 'Banana Ice')).toBeNull();
  });
});

describe('Mapeamento e Normalização de Zonas', () => {
  it('deve mapear variações de nomes e siglas para IDs canônicos', () => {
    expect(normalizarZonaId('Recife')).toBe('recife');
    expect(normalizarZonaId('REC')).toBe('recife');
    expect(normalizarZonaId('Zona Norte')).toBe('norte');
    expect(normalizarZonaId('Zona Sul/Oeste')).toBe('sul_oeste');
    expect(normalizarZonaId('sul')).toBe('sul_oeste');
    expect(normalizarZonaId('oeste')).toBe('sul_oeste');
  });

  it('deve retornar null para zonas inválidas ou desconhecidas', () => {
    expect(normalizarZonaId('Sao Paulo')).toBeNull();
    expect(normalizarZonaId('')).toBeNull();
    expect(normalizarZonaId(null)).toBeNull();
  });
});

describe('Cálculo Centralizado de Estoque por Zona', () => {
  const produtoControlado: ProdutoBasico = {
    id: 'prod-1',
    marca: 'IGNITE',
    nome: 'IGNITE V150',
    estoque: 15,
    sabores: ['Menta Ice', 'Uva Ice', 'Manga Ice'],
    zonas: ['recife', 'sul_oeste'],
    estoque_zonas: {
      recife: {
        estoque: 10,
        sabores_estoque: {
          'Menta Ice': 6,
          'Uva Ice': 4,
          'Manga Ice': 0
        }
      },
      sul_oeste: {
        estoque: 5,
        sabores_estoque: {
          'Menta Ice': 2,
          'Uva Ice': 3,
          'Manga Ice': 0
        }
      }
    }
  };

  it('deve calcular corretamente os saldos da zona Recife', () => {
    const info = obterEstoqueProdutoPorZona(produtoControlado, 'recife');
    expect(info.possuiEstoqueNaZona).toBe(true);
    expect(info.estoque).toBe(10);
    expect(info.saboresEstoque['Menta Ice']).toBe(6);
    expect(info.saboresEstoque['Uva Ice']).toBe(4);
    expect(info.saboresDisponiveis).toEqual(['Menta Ice', 'Uva Ice']);
    expect(info.isIlimitado).toBe(false);
  });

  it('deve calcular corretamente os saldos da zona Sul/Oeste', () => {
    const info = obterEstoqueProdutoPorZona(produtoControlado, 'sul_oeste');
    expect(info.possuiEstoqueNaZona).toBe(true);
    expect(info.estoque).toBe(5);
    expect(info.saboresDisponiveis).toEqual(['Menta Ice', 'Uva Ice']);
  });

  it('deve retornar zerado para zona não atendida pelo produto', () => {
    const info = obterEstoqueProdutoPorZona(produtoControlado, 'norte');
    expect(info.possuiEstoqueNaZona).toBe(false);
    expect(info.estoque).toBe(0);
    expect(info.saboresDisponiveis).toEqual([]);
  });

  it('deve tratar produto com estoque ilimitado sem restrição de saldo', () => {
    const produtoIlimitado: ProdutoBasico = {
      id: 'prod-ilim',
      marca: 'PROMO_BRAND',
      nome: 'POD PROMOCIONAL LIVRE',
      estoque: 999,
      sabores: ['Sabor A', 'Sabor B'],
      estoque_ilimitado: true
    };

    const info = obterEstoqueProdutoPorZona(produtoIlimitado, 'recife');
    expect(info.isIlimitado).toBe(true);
    expect(info.possuiEstoqueNaZona).toBe(true);
    expect(info.estoque).toBe(999);
    expect(info.saboresEstoque['Sabor A']).toBe(999);
    expect(info.saboresDisponiveis).toEqual(['Sabor A', 'Sabor B']);
  });

  it('deve usar fallback gracioso para produtos legados sem estoque_zonas', () => {
    const produtoLegado: ProdutoBasico = {
      id: 'prod-legado',
      marca: 'LEGACY',
      nome: 'POD ANTIGO',
      estoque: 8,
      sabores: ['Sabor Antigo'],
      sabores_estoque: { 'Sabor Antigo': 8 },
      estoque_zonas: {}
    };

    const info = obterEstoqueProdutoPorZona(produtoLegado, 'recife');
    expect(info.possuiEstoqueNaZona).toBe(true);
    expect(info.estoque).toBe(8);
    expect(info.saboresDisponiveis).toEqual(['Sabor Antigo']);
  });
});
