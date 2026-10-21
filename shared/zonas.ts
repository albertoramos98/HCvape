// =========================================================================
// HC VAPE - TABELA DA VERDADE E NORMALIZAÇÃO DE ZONAS / REGIÕES
// Compartilhado entre Frontend, Backend e Validações
// Zonas ativas: recife, norte, sul_oeste (com legados sul e oeste)
// =========================================================================

export type ZonaId = 'recife' | 'norte' | 'sul_oeste' | 'sul' | 'oeste';

export interface ZonaInfo {
  id: ZonaId;
  nome: string;
  badge: string;
  descricao: string;
  cor: string;
  sigla: string;
}

export const ZONAS_DISPONIVEIS: ZonaInfo[] = [
  { 
    id: 'recife', 
    nome: 'Recife', 
    badge: 'Atendimento Rápido', 
    descricao: 'Disponibilidade e estoque para a região de Recife',
    cor: '#76FF03',
    sigla: 'REC'
  },
  { 
    id: 'norte', 
    nome: 'Zona Norte', 
    badge: 'Zona Norte', 
    descricao: 'Disponibilidade e estoque para a Zona Norte',
    cor: '#38bdf8',
    sigla: 'ZN'
  },
  { 
    id: 'sul_oeste', 
    nome: 'Zona Sul / Oeste', 
    badge: 'Zona Sul/Oeste', 
    descricao: 'Disponibilidade e estoque para a Zona Sul e Oeste',
    cor: '#a855f7',
    sigla: 'ZS/ZO'
  }
];

/**
 * Normaliza qualquer string de zona (rótulo, sigla, texto livre) para o ZonaId canônico
 */
export function normalizarZonaId(zonaInput?: string | null): ZonaId | null {
  if (!zonaInput) return null;
  
  const limpo = zonaInput
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (limpo === 'recife' || limpo === 'rec' || limpo.includes('recife')) {
    return 'recife';
  }
  if (limpo === 'norte' || limpo.includes('norte')) {
    return 'norte';
  }
  if (limpo === 'sul_oeste' || limpo === 'suloeste' || (limpo.includes('sul') && limpo.includes('oeste'))) {
    return 'sul_oeste';
  }
  if (limpo === 'sul') {
    return 'sul_oeste';
  }
  if (limpo === 'oeste') {
    return 'sul_oeste';
  }

  return null;
}
