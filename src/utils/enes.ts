/**
 * Módulo ENES/ENEB (adenda SIGEN 04) — leitura e validação de ficheiros.
 * Não assume nenhum layout oficial: tudo vem do formato configurado em EN01.
 */
import type {
  EnesCampo,
  EnesFormato,
  EnesImportacao,
  EnesLinhaImportada,
  StudentResult,
  EnesCorrespondencia,
} from '../types/sigen';

export const ENES_CAMPOS: { campo: EnesCampo; label: string; obrigatorio: boolean }[] = [
  { campo: 'alunoRef', label: 'Identificador do aluno (n.º de processo)', obrigatorio: true },
  { campo: 'nome', label: 'Nome do aluno', obrigatorio: true },
  { campo: 'codigoEscola', label: 'Código da escola', obrigatorio: false },
  { campo: 'curso', label: 'Curso', obrigatorio: false },
  { campo: 'provaCodigo', label: 'Código da prova', obrigatorio: true },
  { campo: 'fase', label: 'Fase', obrigatorio: true },
  { campo: 'data', label: 'Data da prova', obrigatorio: false },
  { campo: 'classificacao', label: 'Classificação', obrigatorio: true },
];

export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

export const delimitadorReal = (d: EnesFormato['delimitador']) => (d === 'TAB' ? '\t' : d);

/** Formatos não homologados só podem ser usados em testes (adenda §2). */
export const formatoUtilizavel = (f: EnesFormato) => f.estado === 'Ativo (testes)' || f.estado === 'Homologado';
export const formatoPermiteProducao = (f: EnesFormato) => f.estado === 'Homologado';

export async function checksumSha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

const normalizarFase = (v: string): string | null => {
  const t = v.trim().toLowerCase();
  if (['1', '1f', '1.ª fase', '1ª fase', '1a fase', 'fase 1'].includes(t)) return '1.ª Fase';
  if (['2', '2f', '2.ª fase', '2ª fase', '2a fase', 'fase 2'].includes(t)) return '2.ª Fase';
  if (['ee', 'época especial', 'epoca especial'].includes(t)) return 'Época Especial';
  return null;
};

const normalizarClassificacao = (v: string): string | null => {
  const t = v.trim();
  if (/^\d{1,3}$/.test(t) && Number(t) >= 0 && Number(t) <= 200) return String(Number(t));
  if (/^faltou$/i.test(t)) return 'Faltou';
  if (/^anulada$/i.test(t)) return 'Anulada';
  return null;
};

/** Divide uma linha respeitando aspas ("a;b" conta como um campo). */
const dividir = (linha: string, delim: string): string[] => {
  const out: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === delim && !aspas) {
      out.push(atual);
      atual = '';
    } else atual += c;
  }
  out.push(atual);
  return out.map((x) => x.trim());
};

export interface ResultadoAnalise {
  linhas: EnesLinhaImportada[];
  erros: EnesImportacao['erros'];
  avisos: string[];
}

export function analisarFicheiro(
  nomeFicheiro: string,
  bytes: ArrayBuffer,
  formato: EnesFormato,
  contexto: { faseLote: string; codigoEscola: string; provasConhecidas: Set<string> }
): ResultadoAnalise {
  const erros: ResultadoAnalise['erros'] = [];
  const avisos: string[] = [];
  const linhas: EnesLinhaImportada[] = [];

  // Tipo e tamanho
  const ext = nomeFicheiro.slice(nomeFicheiro.lastIndexOf('.')).toLowerCase();
  if (ext !== formato.extensao) erros.push({ linha: 0, campo: 'ficheiro', erro: `Extensão ${ext || '(nenhuma)'} — o formato espera ${formato.extensao}.` });
  if (bytes.byteLength === 0) erros.push({ linha: 0, campo: 'ficheiro', erro: 'Ficheiro vazio.' });
  if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) erros.push({ linha: 0, campo: 'ficheiro', erro: 'Ficheiro acima de 5 MB.' });
  if (erros.length) return { linhas, erros, avisos };

  // Codificação
  let texto: string;
  try {
    texto = new TextDecoder(formato.codificacao, { fatal: formato.codificacao === 'utf-8' }).decode(bytes);
  } catch {
    erros.push({ linha: 0, campo: 'codificação', erro: `O ficheiro não está em ${formato.codificacao}.` });
    return { linhas, erros, avisos };
  }
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);

  // Mapeamento obrigatório
  for (const c of ENES_CAMPOS.filter((x) => x.obrigatorio)) {
    if (!formato.mapaColunas[c.campo]) erros.push({ linha: 0, campo: c.campo, erro: `Campo "${c.label}" sem coluna mapeada no formato (EN01).` });
  }
  if (erros.length) return { linhas, erros, avisos };

  const delim = delimitadorReal(formato.delimitador);
  const todas = texto.split(/\r?\n/);
  const cabecalho = dividir(todas[0] ?? '', delim);
  const faltam = formato.cabecalhos.filter((h) => !cabecalho.includes(h));
  if (faltam.length) erros.push({ linha: 1, campo: 'cabeçalho', erro: `Colunas em falta: ${faltam.join(', ')}.` });
  const extra = cabecalho.filter((h) => h && !formato.cabecalhos.includes(h));
  if (extra.length) avisos.push(`Colunas não previstas ignoradas: ${extra.join(', ')}.`);
  if (faltam.length) return { linhas, erros, avisos };

  const idx = (campo: EnesCampo) => {
    const col = formato.mapaColunas[campo];
    return col ? cabecalho.indexOf(col) : -1;
  };
  const vistos = new Map<string, number>();

  todas.slice(1).forEach((raw, i) => {
    const n = i + 2;
    if (!raw.trim()) return;
    const v = dividir(raw, delim);
    if (v.length !== cabecalho.length) {
      erros.push({ linha: n, campo: 'estrutura', erro: `Esperadas ${cabecalho.length} colunas, encontradas ${v.length}.` });
      return;
    }
    const get = (c: EnesCampo) => (idx(c) >= 0 ? v[idx(c)] : '');
    const alunoRef = get('alunoRef');
    const nome = get('nome');
    const provaCodigo = get('provaCodigo');
    const faseBruta = get('fase');
    const classBruta = get('classificacao');
    const codigoEscola = get('codigoEscola');

    let ok = true;
    const falha = (campo: string, erro: string) => {
      erros.push({ linha: n, campo, erro });
      ok = false;
    };
    if (!alunoRef) falha('alunoRef', 'Identificador do aluno em falta.');
    if (!nome) falha('nome', 'Nome em falta.');
    if (!provaCodigo) falha('provaCodigo', 'Código de prova em falta.');
    else if (contexto.provasConhecidas.size && !contexto.provasConhecidas.has(provaCodigo))
      falha('provaCodigo', `Prova ${provaCodigo} não existe no calendário deste ano/fase.`);
    const fase = normalizarFase(faseBruta);
    if (!fase) falha('fase', `Fase "${faseBruta}" não reconhecida.`);
    else if (fase !== contexto.faseLote) falha('fase', `Linha da ${fase}, mas o lote é da ${contexto.faseLote}.`);
    const classificacao = normalizarClassificacao(classBruta);
    if (classificacao === null) falha('classificacao', `Classificação "${classBruta}" não admissível (0–200, Faltou, Anulada).`);
    if (codigoEscola && codigoEscola !== contexto.codigoEscola)
      falha('codigoEscola', `Aluno de outra escola (${codigoEscola}).`);
    const chave = `${alunoRef}|${provaCodigo}|${fase}`;
    if (alunoRef && provaCodigo && vistos.has(chave)) falha('duplicado', `Repete a linha ${vistos.get(chave)}.`);
    else vistos.set(chave, n);

    if (ok) {
      const linha: EnesLinhaImportada = {
        linha: n,
        alunoRef,
        nome,
        provaCodigo,
        fase: fase!,
        classificacao: classificacao!,
      };
      if (codigoEscola) linha.codigoEscola = codigoEscola;
      if (get('curso')) linha.curso = get('curso');
      if (get('data')) linha.data = get('data');
      linhas.push(linha);
    }
  });

  if (!linhas.length && !erros.length) erros.push({ linha: 0, campo: 'ficheiro', erro: 'O ficheiro não tem linhas de dados.' });
  return { linhas, erros, avisos };
}

/** Procura o resultado local correspondente a uma linha importada. */
export function corresponder(
  l: Pick<EnesLinhaImportada, 'alunoRef' | 'provaCodigo' | 'classificacao'>,
  resultados: StudentResult[],
  ctx: { institutionId: string; anoLetivo: string; fase: string }
): { resultado?: StudentResult; correspondencia: EnesCorrespondencia } {
  const r = resultados.find(
    (x) =>
      x.institutionId === ctx.institutionId &&
      x.anoLetivo === ctx.anoLetivo &&
      x.fase === ctx.fase &&
      x.provaCodigo === l.provaCodigo &&
      x.alunoRef === l.alunoRef
  );
  if (!r) return { correspondencia: 'Sem correspondência' };
  return { resultado: r, correspondencia: String(r.resultado) === l.classificacao ? 'Correspondente' : 'Divergente' };
}

/** Exemplo fictício e anonimizado, gerado a partir do próprio formato (para testes). */
export function gerarExemplo(formato: EnesFormato, codigoEscola: string, provas: string[]): string {
  const delim = delimitadorReal(formato.delimitador);
  const valores: Record<EnesCampo, string[]> = {
    alunoRef: ['TESTE-0001', 'TESTE-0002', 'TESTE-0003'],
    nome: ['Aluno Fictício Um', 'Aluno Fictício Dois', 'Aluno Fictício Três'],
    codigoEscola: [codigoEscola, codigoEscola, codigoEscola],
    curso: ['Ciências e Tecnologias', 'Línguas e Humanidades', 'Ciências Socioeconómicas'],
    provaCodigo: [provas[0] ?? '639', provas[1] ?? provas[0] ?? '635', provas[0] ?? '639'],
    fase: [formato.fase, formato.fase, formato.fase],
    data: ['2026-06-15', '2026-06-18', '2026-06-15'],
    classificacao: ['142', '97', 'Faltou'],
  };
  const inverso = Object.fromEntries(Object.entries(formato.mapaColunas).map(([c, col]) => [col, c])) as Record<string, EnesCampo>;
  const linhas = [formato.cabecalhos.join(delim)];
  for (let i = 0; i < 3; i++) {
    linhas.push(formato.cabecalhos.map((h) => (inverso[h] ? valores[inverso[h]][i] : '')).join(delim));
  }
  return linhas.join('\r\n');
}
