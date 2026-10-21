// =========================================================================
// HC VAPE - TABELA DA VERDADE E NORMALIZAÇÃO DE ZONAS / REGIÕES
// Compartilhado entre Frontend, Backend e Validações
// =========================================================================

export type ZonaId = 'recife' | 'gravata' | 'norte' | 'sul_oeste' | 'sul' | 'oeste';

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
    descricao: 'Disponibilidade e estoque para toda a região de Recife',
    cor: '#76FF03',
    sigla: 'REC'
  },
  { 
    id: 'gravata', 
    nome: 'Gravatá', 
    badge: 'Atendimento Gravatá', 
    descricao: 'Disponibilidade e estoque para a região de Gravatá',
    cor: '#f59e0b',
    sigla: 'GV'
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
  if (limpo === 'gravata' || limpo === 'gv' || limpo.includes('gravata')) {
    return 'gravata';
  }
  if (limpo === 'norte' || limpo.includes('norte')) {
    return 'norte';
  }
  if (limpo === 'sul_oeste' || limpo === 'suloeste' || (limpo.includes('sul') && limpo.includes('oeste'))) {
    return 'sul_oeste';
  }
  if (limpo === 'sul') {
    return 'sul';
  }
  if (limpo === 'oeste') {
    return 'oeste';
  }

  return null;
}
