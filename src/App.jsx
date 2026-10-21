import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import {
  CreditCard,
  ArrowDownCircle,
  Receipt,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  Camera,
  Sparkles,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  X,
  Check,
  FileText,
  ShoppingBag,
  Upload,
  Eye,
  Download,
  Search,
  ShoppingCart,
  ShieldCheck,
  ShieldAlert,
  Store,
  PieChart,
  Filter,
  HeartPulse,
  History,
  CheckCheck,
  XCircle,
  PlusCircle,
  Save,
  BrainCircuit,
  ArrowRight,
  Sun,
  Moon,
  QrCode,
  KeyRound,
  Package,
  ExternalLink,
  BarChart3,
  TrendingUp,
  Tags,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO SUPABASE & GEMINI API
// ==========================================
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://kslmyvlewsmjnrhwklfd.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_WjgE2b2iKdZrRopbQieW3A_Cr9R9pGB';
const GEMINI_API_KEY =
  typeof __ENCODED_GEMINI_KEY__ !== 'undefined' && __ENCODED_GEMINI_KEY__
    ? atob(__ENCODED_GEMINI_KEY__)
    : import.meta.env.VITE_GEMINI_API_KEY || '';

const APK_DOWNLOAD_URL =
  'https://github.com/igoracazevedo/iaz-financas/releases/latest/download/SuperFarma-IAZ.apk';

// Lista de modelos Gemini com cotas independentes no Free Tier para rotação automática (anti-429)
const MODELOS_GEMINI_POOL = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
];

const modelosEsgotadosNaSessao = new Set();

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const CATEGORIAS_PADRAO = [
  'Alimentação & Supermercado',
  'Saúde & Farmácia',
  'Pets',
  'Eletrônicos & Eletrodomésticos',
  'Moradia & Contas',
  'Transporte & Combustível',
  'Lazer & Restaurantes',
  'Educação',
  'Vestuário',
  'Tecnologia & Assinaturas',
  'Impostos & Taxas',
  'Outros',
];

const normalizarListaCategorias = (listaSalva) => {
  if (!Array.isArray(listaSalva) || listaSalva.length === 0) {
    return [...CATEGORIAS_PADRAO];
  }
  const limpas = Array.from(
    new Set(listaSalva.map((c) => String(c || '').trim()).filter(Boolean))
  );
  // Garante que a categoria Pets esteja presente caso a lista tenha sido salva antes da criação de Pets
  if (!limpas.some((c) => c.toLowerCase() === 'pets')) {
    const idxFarma = limpas.indexOf('Saúde & Farmácia');
    if (idxFarma >= 0) {
      limpas.splice(idxFarma + 1, 0, 'Pets');
    } else {
      limpas.push('Pets');
    }
  }
  if (!limpas.includes('Outros')) {
    limpas.push('Outros');
  }
  return limpas;
};

const FORMAS_PAGAMENTO = [
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Boleto',
  'Dinheiro',
  'Transferência / TED',
  'Débito Automático',
];

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDateBR = (dateStr) => {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
};

const formatMonthLabel = (yyyyMm) => {
  if (!yyyyMm) return '';
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// Calcula Valor Total (Bruto), Desconto e Valor Pago (Total - Desconto) de uma Nota Fiscal
const calcularValoresNota = (nf) => {
  const valorTotalBruto = Math.max(0, Number(nf?.valor_total) || 0);
  const desconto = Math.max(0, Number(nf?.desconto) || 0);
  const valorPago = Math.max(
    0,
    Number((valorTotalBruto - desconto).toFixed(2))
  );
  return {
    valorTotalBruto,
    desconto,
    valorPago,
    temDesconto: desconto > 0.004,
  };
};

// Mapa de UFs e portais SEFAZ para consulta de Chave de Acesso / QR Code
const UF_POR_CODIGO = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
  41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};

const PORTAL_SEFAZ_UF = {
  CE: 'https://nfce.sefaz.ce.gov.br/pages/consultaNota.jsf',
  SP: 'https://satsp.fazenda.sp.gov.br/COMSAT/Public/ConsultaPublica/ConsultaPublicaCfe.aspx',
  RJ: 'https://consultadfe.fazenda.rj.gov.br/consultaDFe/paginas/consultaChaveAcesso.faces',
  MG: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/consultaarg.xhtml',
  PR: 'http://www.fazenda.pr.gov.br/nfce/consulta',
  RS: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
  SC: 'https://sat.sef.sc.gov.br/tax.NET/Sat.DFe.Web/Consultas/ConsultaPublicaNFe.aspx',
  BA: 'http://nfe.sefaz.ba.gov.br/servicos/nfce/Modulos/Geral/NFCEC_consulta_chave_acesso.aspx',
  PE: 'http://nfce.sefaz.pe.gov.br/nfce-web/consultarNfce',
  DF: 'https://dec.fazenda.df.gov.br/ConsultarNFCe.aspx',
  GO: 'https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe',
  AM: 'https://sistemas.sefaz.am.gov.br/nfceweb/consultarFCE.do',
};

const formatCNPJ = (digits) => {
  const clean = String(digits || '').replace(/\D/g, '');
  if (clean.length !== 14) return clean;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
};

// Decodifica Chave de Acesso de 44 dígitos ou URL de QR Code da Nota Fiscal (NFC-e / NF-e / SAT)
const decodificarChaveOuQrCode = (rawInput) => {
  const texto = String(rawInput || '').trim();
  if (!texto) return null;

  // Procura sequência de 44 dígitos (mesmo se estiver separada por espaços/pontos na chave ou dentro de URL)
  const apenasDigitos = texto.replace(/\D/g, '');
  const match44 = texto.match(/(?:\d[\s.-]*){44}/);
  let chave44 = '';
  if (match44) {
    chave44 = match44[0].replace(/\D/g, '').slice(0, 44);
  } else if (apenasDigitos.length >= 44) {
    chave44 = apenasDigitos.slice(0, 44);
  }

  if (chave44.length !== 44) {
    return {
      valida: false,
      chave44: apenasDigitos.slice(0, 44),
      urlOriginal: texto.startsWith('http') ? texto : '',
    };
  }

  const cUF = chave44.slice(0, 2);
  const uf = UF_POR_CODIGO[cUF] || 'BR';
  const aa = chave44.slice(2, 4);
  const mm = chave44.slice(4, 6);
  const ano = Number(`20${aa}`);
  const mesNum = Number(mm);
  const mesValido = mesNum >= 1 && mesNum <= 12 ? mm : '01';
  const anoMes = `${ano}-${mesValido}`;
  const cnpjRaw = chave44.slice(6, 20);
  const cnpjFormatado = formatCNPJ(cnpjRaw);
  const modelo = chave44.slice(20, 22);
  const serie = String(Number(chave44.slice(22, 25)));
  const numeroNota = String(Number(chave44.slice(25, 34)));

  // Verifica se a URL do QR Code possui dia de emissão ou valor total nos parâmetros (p=chave|2|1|dia|valor...)
  let diaExtraido = '01';
  let valorExtraido = 0;

  if (texto.includes('|')) {
    const partesPipe = texto.split('|');
    if (partesPipe.length >= 5) {
      const possivelDia = Number(partesPipe[3]);
      const possivelValor = Number(String(partesPipe[4]).replace(',', '.'));
      if (possivelDia >= 1 && possivelDia <= 31) {
        diaExtraido = String(possivelDia).padStart(2, '0');
      }
      if (possivelValor > 0 && possivelValor < 1000000) {
        valorExtraido = possivelValor;
      }
    }
  }

  const matchVnf = texto.match(/[?&]vNF=([0-9.,]+)/i);
  if (matchVnf) {
    valorExtraido = Number(matchVnf[1].replace(',', '.')) || valorExtraido;
  }

  return {
    valida: true,
    chave44,
    uf,
    ano,
    mes: mesValido,
    anoMes,
    dataSugerida: `${anoMes}-${diaExtraido}`,
    cnpjRaw,
    cnpjFormatado,
    modelo: modelo === '65' ? 'NFC-e' : modelo === '55' ? 'NF-e' : `Mod ${modelo}`,
    serie,
    numeroNota,
    valorExtraido,
    urlOriginal: texto.startsWith('http') ? texto : '',
    portalSefaz: PORTAL_SEFAZ_UF[uf] || 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx',
  };
};

// Normaliza e preserva a data real da compra na importação de notas (Agosto, Setembro, Outubro, etc.)
const resolverDataEmissaoReal = (
  rawDateFromAI,
  chaveAcesso,
  file = null,
  overrideDate = ''
) => {
  const today = new Date().toISOString().split('T')[0];

  // 1. Se o usuário definiu uma data fixa ou mês fixo para o lote
  if (overrideDate && /^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
    return overrideDate;
  }

  const infoChave = decodificarChaveOuQrCode(chaveAcesso);

  // Tenta extrair e normalizar a data retornada pela IA (suporta YYYY-MM-DD e DD/MM/YYYY)
  let aiDateNormalized = '';
  const rawStr = String(rawDateFromAI || '').trim();
  if (rawStr) {
    const isoMatch = rawStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    const brMatch = rawStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = String(isoMatch[2]).padStart(2, '0');
      const d = String(isoMatch[3]).padStart(2, '0');
      if (y >= 2000 && y <= 2035 && Number(m) >= 1 && Number(m) <= 12) {
        aiDateNormalized = `${y}-${m}-${d}`;
      }
    } else if (brMatch) {
      const d = String(brMatch[1]).padStart(2, '0');
      const m = String(brMatch[2]).padStart(2, '0');
      let y = Number(brMatch[3]);
      if (y < 100) y += 2000;
      if (y >= 2000 && y <= 2035 && Number(m) >= 1 && Number(m) <= 12) {
        aiDateNormalized = `${y}-${m}-${d}`;
      }
    }
  }

  // Se a IA retornou uma data válida que NÃO é a data de hoje (ou seja, estava impressa na nota), confere com a chave e usa ela!
  if (aiDateNormalized && aiDateNormalized !== today) {
    if (infoChave?.valida && !aiDateNormalized.startsWith(infoChave.anoMes)) {
      const diaDaIa = aiDateNormalized.split('-')[2] || '01';
      return `${infoChave.anoMes}-${diaDaIa}`;
    }
    return aiDateNormalized;
  }

  // 2. Se a nota tem chave de acesso de 44 dígitos, usa o Ano-Mês da chave de acesso!
  if (infoChave?.valida) {
    const dia = aiDateNormalized ? aiDateNormalized.split('-')[2] : '01';
    return `${infoChave.anoMes}-${dia}`;
  }

  // 3. Procura data ou nome do mês (agosto, setembro, outubro...) no nome do arquivo
  if (file?.name) {
    const fname = file.name.toLowerCase();
    // Padrão YYYYMMDD ou YYYY-MM-DD no nome do arquivo (ex: Screenshot_20260815, IMG-20260910-WA)
    const fileIsoMatch = fname.match(/(202\d)[-_]?([01]\d)[-_]?([0-3]\d)/);
    if (fileIsoMatch) {
      const [, fy, fm, fd] = fileIsoMatch;
      if (Number(fm) >= 1 && Number(fm) <= 12 && Number(fd) >= 1 && Number(fd) <= 31) {
        return `${fy}-${fm}-${fd}`;
      }
    }
    // Padrão DD-MM-YYYY no nome do arquivo
    const fileBrMatch = fname.match(/([0-3]\d)[-_]([01]\d)[-_](202\d)/);
    if (fileBrMatch) {
      const [, fd, fm, fy] = fileBrMatch;
      if (Number(fm) >= 1 && Number(fm) <= 12 && Number(fd) >= 1 && Number(fd) <= 31) {
        return `${fy}-${fm}-${fd}`;
      }
    }
    // Nome do mês no arquivo (ex: "agosto", "setembro", "outubro")
    const mesesMap = {
      janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04',
      maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
      outubro: '10', novembro: '11', dezembro: '12',
    };
    const currentYear = new Date().getFullYear();
    for (const [nomeMes, numMes] of Object.entries(mesesMap)) {
      if (fname.includes(nomeMes)) {
        return `${currentYear}-${numMes}-01`;
      }
    }
  }

  // 4. Se a imagem era um print recortado sem data impressa, usa a data de criação/modificação do arquivo (file.lastModified)
  if (file?.lastModified) {
    const fileDate = new Date(file.lastModified);
    if (!isNaN(fileDate.getTime())) {
      const fy = fileDate.getFullYear();
      const fm = String(fileDate.getMonth() + 1).padStart(2, '0');
      const fd = String(fileDate.getDate()).padStart(2, '0');
      const fileDateStr = `${fy}-${fm}-${fd}`;
      if (fy >= 2020 && fy <= 2035) {
        return fileDateStr;
      }
    }
  }

  return aiDateNormalized || today;
};

// Helpers para embutir/extrair garantia_meses com compatibilidade total no banco
const GARANTIA_MARKER = '||GARANTIA:';

const encodeCategoriaComGarantia = (categoria, garantiaMeses) => {
  const cleanCat = String(categoria || 'Outros').split(GARANTIA_MARKER)[0];
  const meses = Number(garantiaMeses) || 0;
  return meses > 0 ? `${cleanCat}${GARANTIA_MARKER}${meses}` : cleanCat;
};

const decodeItemGarantia = (item) => {
  const rawCat = String(item.categoria_item || 'Outros');
  const [cleanCat, markerVal] = rawCat.split(GARANTIA_MARKER);
  const garantiaMeses =
    item.garantia_meses !== undefined && item.garantia_meses !== null
      ? Number(item.garantia_meses) || 0
      : Number(markerVal) || 0;
  return {
    ...item,
    categoria_item: cleanCat || 'Outros',
    garantia_meses: garantiaMeses,
  };
};

// Calcula o status de garantia a partir da data_emissao e garantia_meses
const calcularStatusGarantia = (dataEmissaoStr, garantiaMeses) => {
  const meses = Number(garantiaMeses) || 0;
  if (meses <= 0 || !dataEmissaoStr) return null;

  const [y, m, d] = dataEmissaoStr.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;

  const dataFim = new Date(y, m - 1 + meses, d, 23, 59, 59);
  const hoje = new Date();

  const diffMs = dataFim.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dataFimStr = `${String(dataFim.getDate()).padStart(2, '0')}/${String(
    dataFim.getMonth() + 1
  ).padStart(2, '0')}/${dataFim.getFullYear()}`;

  if (diasRestantes <= 0) {
    return {
      expirada: true,
      diasRestantes: 0,
      dataFimStr,
      texto: 'Produto fora da Garantia',
      detalhe: `Garantia de ${meses} ${meses === 1 ? 'mês' : 'meses'} encerrou em ${dataFimStr}`,
    };
  }

  const mesesInteiros = Math.floor(diasRestantes / 30);
  const diasExtras = diasRestantes % 30;
  let tempoTexto = '';
  if (mesesInteiros > 0 && diasExtras > 0) {
    tempoTexto = `Faltam ${mesesInteiros} ${mesesInteiros === 1 ? 'mês' : 'meses'} e ${diasExtras} ${diasExtras === 1 ? 'dia' : 'dias'}`;
  } else if (mesesInteiros > 0) {
    tempoTexto = `Faltam ${mesesInteiros} ${mesesInteiros === 1 ? 'mês' : 'meses'}`;
  } else {
    tempoTexto = `Faltam ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`;
  }

  return {
    expirada: false,
    diasRestantes,
    dataFimStr,
    texto: `${tempoTexto} de garantia`,
    detalhe: `Válida até ${dataFimStr} (${meses}m)`,
  };
};

export default function App() {
  // Aba inicial: Resumo do Mês ('resumo')
  const [activeTab, setActiveTab] = useState('resumo');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // ==========================================
  // CATEGORIAS DINÂMICAS E EDITÁVEIS (INCLUINDO PETS)
  // ==========================================
  const [categoriasDespesa, setCategoriasDespesa] = useState(() => {
    try {
      const saved = localStorage.getItem('iaz_categorias_despesa');
      if (saved) {
        return normalizarListaCategorias(JSON.parse(saved));
      }
    } catch {
      // fallback
    }
    return [...CATEGORIAS_PADRAO];
  });
  const [configCategoriasDbId, setConfigCategoriasDbId] = useState(null);
  const [novaCategoriaInput, setNovaCategoriaInput] = useState('');
  const [editandoCategoriaOriginal, setEditandoCategoriaOriginal] = useState(null);
  const [editandoCategoriaNovoNome, setEditandoCategoriaNovoNome] = useState('');
  const [atualizarHistoricoAoRenomear, setAtualizarHistoricoAoRenomear] = useState(true);

  const CATEGORIAS_DESPESA = categoriasDespesa;

  useEffect(() => {
    try {
      localStorage.setItem(
        'iaz_categorias_despesa',
        JSON.stringify(categoriasDespesa)
      );
    } catch (e) {
      console.error(e);
    }
  }, [categoriasDespesa]);

  // Estados das tabelas ativas
  const [cartoes, setCartoes] = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [notasFiscais, setNotasFiscais] = useState([]);
  const [itensNota, setItensNota] = useState([]);
  const [historicoListas, setHistoricoListas] = useState([]);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Estados de Formulários - Cartões
  const [cartaoForm, setCartaoForm] = useState({
    id: null,
    nome_cartao: '',
    bandeira: 'Mastercard',
    tipo: 'CREDITO',
    limite: '',
    dia_fechamento: 1,
    dia_vencimento: 10,
    ativo: true,
  });

  // Estados de Formulários - Pagamentos
  const emptyPagamento = () => ({
    id: null,
    tipo: 'PAGAMENTO',
    descricao: '',
    categoria: CATEGORIAS_DESPESA[0],
    valor: '',
    data_competencia: `${selectedMonth}-01`,
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'PIX',
    status: 'CONFIRMADO',
    cartao_id: '',
  });

  const [transacaoForm, setTransacaoForm] = useState(() => emptyPagamento());
  const [showTransacaoModal, setShowTransacaoModal] = useState(false);

  // Estados de Leitura e Edição de Notas Fiscais (OCR com Gemini)
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [extractedNota, setExtractedNota] = useState(null);
  const [expandedNotaId, setExpandedNotaId] = useState(null);
  const [viewingComprovante, setViewingComprovante] = useState(null);

  // Estados de Importação de Notas Fiscais em Lote (50+ notas de Supermercado, Farmácia, etc.)
  const [batchQueue, setBatchQueue] = useState([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchCategoryOverride, setBatchCategoryOverride] = useState('AUTO');
  const [batchCartaoId, setBatchCartaoId] = useState('');
  const [batchDateOverride, setBatchDateOverride] = useState('');
  const [batchSkipDuplicates, setBatchSkipDuplicates] = useState(true);
  const [activeGeminiModel, setActiveGeminiModel] = useState(MODELOS_GEMINI_POOL[0]);

  // Tema Claro / Escuro (Dark / Light Mode)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('iaz_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('iaz_dark_mode', String(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark-theme');
        document.body.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
        document.body.classList.remove('dark-theme');
      }
    } catch (e) {
      console.error(e);
    }
  }, [darkMode]);

  // Estados de Importação via QR Code ou Chave de Acesso (44 dígitos)
  const [qrChaveInput, setQrChaveInput] = useState('');
  const [qrDiaCompra, setQrDiaCompra] = useState('01');
  const [qrValorManual, setQrValorManual] = useState('');
  const [qrTextoSefaz, setQrTextoSefaz] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCameraActive, setQrCameraActive] = useState(false);
  const qrVideoRef = React.useRef(null);
  const qrStreamRef = React.useRef(null);

  // Estados para Correção Rápida de Data em Lote no Histórico de Notas
  const [selectedNotasIds, setSelectedNotasIds] = useState([]);
  const [bulkNewDate, setBulkNewDate] = useState('');

  // Filtro da aba Demais Itens (itens fora de Supermercado e Farmácia)
  const [demaisCategoryFilter, setDemaisCategoryFilter] = useState('TODAS_DEMAIS');
  const [demaisSearchQuery, setDemaisSearchQuery] = useState('');
  const [customGeminiKey, setCustomGeminiKey] = useState(() => {
    try {
      return localStorage.getItem('iaz_custom_gemini_key') || '';
    } catch {
      return '';
    }
  });

  const effectiveGeminiKey = customGeminiKey.trim() || GEMINI_API_KEY;

  // Função central com rotação automática de modelos para nunca travar no erro 429 (Free Tier 20 req/dia por modelo)
  const callGeminiWithFallback = async ({ input, response_format }) => {
    const ai = new GoogleGenAI({ apiKey: effectiveGeminiKey });

    // Ordena priorizando modelos que ainda não atingiram limite 429 na sessão
    const candidatos = [
      ...MODELOS_GEMINI_POOL.filter((m) => !modelosEsgotadosNaSessao.has(m)),
      ...MODELOS_GEMINI_POOL.filter((m) => modelosEsgotadosNaSessao.has(m)),
    ];

    let lastError = null;
    for (const modelName of candidatos) {
      try {
        const interaction = await ai.interactions.create({
          model: modelName,
          input,
          response_format,
        });
        setActiveGeminiModel(modelName);
        return interaction;
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || '');
        if (
          msg.includes('429') ||
          msg.toLowerCase().includes('rate limit') ||
          msg.toLowerCase().includes('quota') ||
          msg.includes('404')
        ) {
          console.warn(
            `[Gemini Fallback] Modelo ${modelName} atingiu limite/indisponível. Alternando automaticamente para o próximo modelo...`
          );
          modelosEsgotadosNaSessao.add(modelName);
          continue;
        }
        // Para outros erros transitórios, aguarda 1.5s e tenta o próximo modelo
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw lastError;
  };

  // Estados da Aba de Busca de Itens
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [onlyWithWarranty, setOnlyWithWarranty] = useState(false);

  // ==========================================
  // ESTADOS DE SUPERMERCADO & FARMÁCIA (LISTAS, HISTÓRICO, PREVISÃO IA E CONFERÊNCIA COM NOTA)
  // ==========================================
  const currentListType = activeTab === 'farmacia' ? 'FARMACIA' : 'SUPERMERCADO';
  const defaultCategoryForType =
    currentListType === 'FARMACIA'
      ? 'Saúde & Farmácia'
      : 'Alimentação & Supermercado';

  const [shoppingListSupermercado, setShoppingListSupermercado] = useState(() => {
    try {
      const saved = localStorage.getItem('iaz_shopping_list_supermercado');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [shoppingListFarmacia, setShoppingListFarmacia] = useState(() => {
    try {
      const saved = localStorage.getItem('iaz_shopping_list_farmacia');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeListMeta, setActiveListMeta] = useState({
    SUPERMERCADO: { id: null, titulo: '', analise_ia: '', conferencia: null },
    FARMACIA: { id: null, titulo: '', analise_ia: '', conferencia: null },
  });

  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState(
    'Alimentação & Supermercado'
  );
  const [customListItem, setCustomListItem] = useState({
    descricao_item: '',
    quantidade: 1,
    unidade: 'un',
    valor_unitario: '',
  });

  const [aiListLoading, setAiListLoading] = useState(false);
  const [selectedExistingNotaId, setSelectedExistingNotaId] = useState('');
  const [expandedHistoryListId, setExpandedHistoryListId] = useState(null);

  // Atualiza o filtro padrão ao alternar entre Supermercado e Farmácia
  useEffect(() => {
    if (activeTab === 'lista') {
      setCatalogCategoryFilter('Alimentação & Supermercado');
    } else if (activeTab === 'farmacia') {
      setCatalogCategoryFilter('Saúde & Farmácia');
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'iaz_shopping_list_supermercado',
        JSON.stringify(shoppingListSupermercado)
      );
    } catch (e) {
      console.error(e);
    }
  }, [shoppingListSupermercado]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'iaz_shopping_list_farmacia',
        JSON.stringify(shoppingListFarmacia)
      );
    } catch (e) {
      console.error(e);
    }
  }, [shoppingListFarmacia]);

  const currentShoppingList =
    currentListType === 'FARMACIA' ? shoppingListFarmacia : shoppingListSupermercado;

  const setCurrentShoppingList = (updater) => {
    if (currentListType === 'FARMACIA') {
      setShoppingListFarmacia(updater);
    } else {
      setShoppingListSupermercado(updater);
    }
  };

  const currentMeta = activeListMeta[currentListType];
  const updateCurrentMeta = (patch) => {
    setActiveListMeta((prev) => ({
      ...prev,
      [currentListType]: { ...prev[currentListType], ...patch },
    }));
  };

  const showNotice = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const changeMonth = (offset) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  };

  // ==========================================
  // CARREGAMENTO DE DADOS DO SUPABASE
  // ==========================================
  const fetchAllData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [
        { data: cartoesData, error: e2 },
        { data: transacoesData, error: e3 },
        { data: notasData, error: e4 },
        { data: itensData, error: e5 },
        { data: listasRawData, error: e6 },
      ] = await Promise.all([
        supabase.from('cartoes').select('*').order('created_at', { ascending: false }),
        supabase
          .from('transacoes')
          .select('*')
          .order('data_competencia', { ascending: false }),
        supabase
          .from('notas_fiscais')
          .select('*')
          .order('data_emissao', { ascending: false }),
        supabase.from('itens_nota').select('*').order('created_at', { ascending: true }),
        supabase
          .from('contas_bancarias')
          .select('*')
          .in('tipo_conta', [
            '__LISTA_SUPERMERCADO__',
            '__LISTA_FARMACIA__',
            '__CONFIG_CATEGORIAS__',
          ])
          .order('created_at', { ascending: false }),
      ]);

      if (e2 || e3 || e4 || e5 || e6) {
        throw e2 || e3 || e4 || e5 || e6;
      }

      setCartoes(cartoesData || []);
      setTransacoes(transacoesData || []);
      setNotasFiscais(
        (notasData || []).map((nf) => ({
          ...nf,
          data_emissao: (nf.data_emissao || '').split('T')[0],
        }))
      );
      setItensNota((itensData || []).map(decodeItemGarantia));

      // Carrega configuração de categorias personalizadas salva no banco (sincroniza Web e APK)
      const rowCategorias = (listasRawData || []).find(
        (r) => r.tipo_conta === '__CONFIG_CATEGORIAS__'
      );
      if (rowCategorias) {
        setConfigCategoriasDbId(rowCategorias.id);
        try {
          const parsedCats = JSON.parse(rowCategorias.nome_banco);
          if (Array.isArray(parsedCats) && parsedCats.length > 0) {
            setCategoriasDespesa(normalizarListaCategorias(parsedCats));
          }
        } catch {
          // mantém lista atual
        }
      }

      // Decodifica o histórico de listas de compras salvo no banco
      const parsedListas = (listasRawData || [])
        .filter((row) => row.tipo_conta !== '__CONFIG_CATEGORIAS__')
        .map((row) => {
          try {
            const obj = JSON.parse(row.nome_banco);
            return {
              ...obj,
              db_id: row.id,
              created_at: row.created_at,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      setHistoricoListas(parsedListas);
    } catch (err) {
      console.error('Erro ao buscar dados do Supabase:', err);
      showNotice(`Erro ao carregar dados: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ==========================================
  // DADOS ENRIQUECIDOS DE ITENS
  // ==========================================
  const itensEnriquecidos = useMemo(() => {
    const mapaNotas = new Map(notasFiscais.map((nf) => [nf.id, nf]));
    return itensNota
      .map((item) => {
        const nf = mapaNotas.get(item.nota_id);
        const dataCompra = (nf?.data_emissao || item.created_at || '').split('T')[0];
        const garantiaInfo = calcularStatusGarantia(dataCompra, item.garantia_meses);
        return {
          ...item,
          estabelecimento: nf?.estabelecimento || 'Local não informado',
          cnpj: nf?.cnpj || '',
          data_compra: dataCompra,
          forma_pagamento: nf?.forma_pagamento || '',
          garantiaInfo,
        };
      })
      .sort((a, b) => {
        if (b.data_compra !== a.data_compra) {
          return b.data_compra.localeCompare(a.data_compra);
        }
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
  }, [itensNota, notasFiscais]);

  // ==========================================
  // CÁLCULOS DO RESUMO DO MÊS E PAGAMENTOS (CONSIDERANDO DESCONTO: VALOR PAGO = TOTAL - DESCONTO)
  // ==========================================
  const pagamentosDoMes = useMemo(() => {
    return transacoes.filter((t) => {
      if (t.tipo !== 'PAGAMENTO') return false;
      const dataRef = t.data_competencia || t.data_pagamento || '';
      return dataRef.startsWith(selectedMonth);
    });
  }, [transacoes, selectedMonth]);

  const notasDoMes = useMemo(() => {
    return notasFiscais.filter((nf) =>
      (nf.data_emissao || '').startsWith(selectedMonth)
    );
  }, [notasFiscais, selectedMonth]);

  const resumoMensal = useMemo(() => {
    const totalBrutoNotasMes = notasDoMes.reduce(
      (acc, nf) => acc + calcularValoresNota(nf).valorTotalBruto,
      0
    );

    const totalDescontoNotasMes = notasDoMes.reduce(
      (acc, nf) => acc + calcularValoresNota(nf).desconto,
      0
    );

    // Valor efetivamente pago nas notas do mês = Total Bruto - Desconto
    const totalNotasMes = notasDoMes.reduce(
      (acc, nf) => acc + calcularValoresNota(nf).valorPago,
      0
    );

    const mapaNotasPorTransacao = new Map(
      notasFiscais
        .filter((nf) => nf.transacao_id)
        .map((nf) => [nf.transacao_id, nf])
    );

    const totalPagamentosMes = pagamentosDoMes.reduce((acc, t) => {
      const nfVinculada = mapaNotasPorTransacao.get(t.id);
      if (nfVinculada) {
        return acc + calcularValoresNota(nfVinculada).valorPago;
      }
      return acc + (Number(t.valor) || 0);
    }, 0);

    const idsTransacoesComNota = new Set(
      notasFiscais.map((nf) => nf.transacao_id).filter(Boolean)
    );
    const mapaNotasDoMes = new Map(notasDoMes.map((nf) => [nf.id, nf]));

    const mapaCategorias = new Map();

    // Soma os itens de cada nota do mês aplicando proporcionalmente o desconto da nota (se houver)
    for (const nf of notasDoMes) {
      const itensDestaNota = itensNota.filter((i) => i.nota_id === nf.id);
      const { valorTotalBruto, valorPago } = calcularValoresNota(nf);

      if (itensDestaNota.length > 0) {
        const somaBrutaItens = itensDestaNota.reduce(
          (acc, i) => acc + (Number(i.valor_total) || 0),
          0
        );
        const baseBruta = somaBrutaItens > 0 ? somaBrutaItens : valorTotalBruto;
        const fatorDesconto =
          baseBruta > 0 && valorPago > 0 ? valorPago / baseBruta : 1;

        for (const item of itensDestaNota) {
          const cat = item.categoria_item || 'Outros';
          const valLiquido = (Number(item.valor_total) || 0) * fatorDesconto;
          mapaCategorias.set(cat, (mapaCategorias.get(cat) || 0) + valLiquido);
        }
      } else {
        const transVinc = transacoes.find((t) => t.id === nf.transacao_id);
        const cat = transVinc?.categoria || 'Outros';
        mapaCategorias.set(cat, (mapaCategorias.get(cat) || 0) + valorPago);
      }
    }

    for (const pag of pagamentosDoMes) {
      if (!idsTransacoesComNota.has(pag.id)) {
        const cat = pag.categoria || 'Outros';
        const val = Number(pag.valor) || 0;
        mapaCategorias.set(cat, (mapaCategorias.get(cat) || 0) + val);
      }
    }

    const totalCategorizado = Array.from(mapaCategorias.values()).reduce(
      (a, b) => a + b,
      0
    );

    const gastosPorCategoria = Array.from(mapaCategorias.entries())
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: totalCategorizado > 0 ? (valor / totalCategorizado) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    return {
      totalBrutoNotasMes,
      totalDescontoNotasMes,
      totalNotasMes,
      qtdNotasMes: notasDoMes.length,
      totalPagamentosMes,
      totalCategorizado,
      gastosPorCategoria,
    };
  }, [notasDoMes, pagamentosDoMes, notasFiscais, itensNota, transacoes]);

  // Itens filtrados na aba "Buscar Itens" em ordem decrescente de data
  const resultadosBuscaItens = useMemo(() => {
    const q = searchItemQuery.trim().toLowerCase();
    return itensEnriquecidos.filter((it) => {
      if (onlyWithWarranty && !(Number(it.garantia_meses) > 0)) return false;
      if (!q) return true;
      return (
        String(it.descricao_item || '').toLowerCase().includes(q) ||
        String(it.estabelecimento || '').toLowerCase().includes(q) ||
        String(it.categoria_item || '').toLowerCase().includes(q)
      );
    });
  }, [itensEnriquecidos, searchItemQuery, onlyWithWarranty]);

  // ==========================================
  // ESTATÍSTICAS COMPLETAS DOS ITENS (MAIS COMPRADOS, FREQUÊNCIA, PREÇO MÉDIO E QUANTIDADE MÉDIA)
  // ==========================================
  const [statsSearch, setStatsSearch] = useState('');
  const [statsCategoryFilter, setStatsCategoryFilter] = useState('TODAS');
  const [statsSortBy, setStatsSortBy] = useState('MAIS_COMPRADOS');

  const estatisticasItensCompleta = useMemo(() => {
    const map = new Map();

    for (const it of itensEnriquecidos) {
      const chave = String(it.descricao_item || '').trim().toUpperCase();
      if (!chave) continue;

      const qtd = Number(it.quantidade) > 0 ? Number(it.quantidade) : 1;
      const valTotal = Number(it.valor_total) || 0;
      const valUnit =
        Number(it.valor_unitario) > 0
          ? Number(it.valor_unitario)
          : qtd > 0
          ? valTotal / qtd
          : valTotal;
      const dataCompra = (it.data_compra || '').split('T')[0];

      if (!map.has(chave)) {
        map.set(chave, {
          chave,
          descricao_item: it.descricao_item,
          unidade: it.unidade || 'un',
          categoria_item: it.categoria_item || 'Outros',
          ultimo_valor_unitario: valUnit,
          ultimo_estabelecimento: it.estabelecimento || 'Local não informado',
          ultima_data: dataCompra,
          vezes_comprado: 1,
          soma_quantidade: qtd,
          soma_valor_unitario: valUnit,
          soma_gasto_total: valTotal,
          menor_preco: valUnit,
          maior_preco: valUnit,
          datas_compra: dataCompra ? [dataCompra] : [],
          estabelecimentos_set: new Set(
            it.estabelecimento ? [it.estabelecimento] : []
          ),
        });
      } else {
        const entry = map.get(chave);
        entry.vezes_comprado += 1;
        entry.soma_quantidade += qtd;
        entry.soma_valor_unitario += valUnit;
        entry.soma_gasto_total += valTotal;
        if (valUnit > 0 && (entry.menor_preco === 0 || valUnit < entry.menor_preco)) {
          entry.menor_preco = valUnit;
        }
        if (valUnit > entry.maior_preco) {
          entry.maior_preco = valUnit;
        }
        if (dataCompra) {
          entry.datas_compra.push(dataCompra);
        }
        if (it.estabelecimento) {
          entry.estabelecimentos_set.add(it.estabelecimento);
        }
      }
    }

    return Array.from(map.values()).map((entry) => {
      const vezes = Math.max(1, entry.vezes_comprado);
      const precoMedio = Number((entry.soma_valor_unitario / vezes).toFixed(2));
      const qtdMediaRaw = entry.soma_quantidade / vezes;
      const unidUpper = String(entry.unidade || 'UN').trim().toUpperCase();
      const isFracionado =
        unidUpper === 'KG' ||
        unidUpper === 'G' ||
        unidUpper === 'L' ||
        unidUpper === 'ML' ||
        unidUpper === 'M' ||
        !Number.isInteger(entry.soma_quantidade);

      const quantidadeMedia = isFracionado
        ? Number(qtdMediaRaw.toFixed(2))
        : Math.max(1, Number(qtdMediaRaw.toFixed(1)));

      // Cálculo de frequência de compra (intervalo médio em dias entre compras)
      const datasUnicas = Array.from(new Set(entry.datas_compra))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      let intervaloMedioDias = null;
      let frequenciaTexto = '';

      if (datasUnicas.length >= 2) {
        const primeiraMs = new Date(`${datasUnicas[0]}T12:00:00`).getTime();
        const ultimaMs = new Date(
          `${datasUnicas[datasUnicas.length - 1]}T12:00:00`
        ).getTime();
        const diffDias = Math.max(
          1,
          Math.round((ultimaMs - primeiraMs) / (1000 * 60 * 60 * 24))
        );
        intervaloMedioDias = Math.max(
          1,
          Math.round(diffDias / (datasUnicas.length - 1))
        );

        if (intervaloMedioDias <= 8) {
          frequenciaTexto = `Semanal (~a cada ${intervaloMedioDias}d)`;
        } else if (intervaloMedioDias <= 18) {
          frequenciaTexto = `Quinzenal (~a cada ${intervaloMedioDias}d)`;
        } else if (intervaloMedioDias <= 35) {
          frequenciaTexto = `Mensal (~a cada ${intervaloMedioDias}d)`;
        } else {
          frequenciaTexto = `A cada ~${intervaloMedioDias} dias`;
        }
      } else if (vezes > 1) {
        frequenciaTexto = `${vezes}x comprados (mesmo dia/período)`;
      } else {
        frequenciaTexto = 'Compra única até o momento';
      }

      return {
        chave: entry.chave,
        descricao_item: entry.descricao_item,
        unidade: entry.unidade,
        categoria_item: entry.categoria_item,
        ultimo_valor_unitario: entry.ultimo_valor_unitario,
        ultimo_estabelecimento: entry.ultimo_estabelecimento,
        ultima_data: entry.ultima_data,
        historico_compras: vezes,
        vezes_comprado: vezes,
        quantidade_total: Number(entry.soma_quantidade.toFixed(3)),
        quantidade_media: quantidadeMedia,
        preco_medio: precoMedio,
        menor_preco: Number(entry.menor_preco.toFixed(2)),
        maior_preco: Number(entry.maior_preco.toFixed(2)),
        gasto_total: Number(entry.soma_gasto_total.toFixed(2)),
        intervalo_medio_dias: intervaloMedioDias,
        frequencia_texto: frequenciaTexto,
        estabelecimentos: Array.from(entry.estabelecimentos_set),
      };
    });
  }, [itensEnriquecidos]);

  const estatisticasFiltradas = useMemo(() => {
    let lista = [...estatisticasItensCompleta];

    if (statsCategoryFilter === 'DEMAIS') {
      lista = lista.filter(
        (p) =>
          p.categoria_item !== 'Alimentação & Supermercado' &&
          p.categoria_item !== 'Saúde & Farmácia'
      );
    } else if (statsCategoryFilter !== 'TODAS') {
      lista = lista.filter((p) => p.categoria_item === statsCategoryFilter);
    }

    const q = statsSearch.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (p) =>
          p.descricao_item.toLowerCase().includes(q) ||
          p.estabelecimentos.some((e) => e.toLowerCase().includes(q)) ||
          p.categoria_item.toLowerCase().includes(q)
      );
    }

    lista.sort((a, b) => {
      if (statsSortBy === 'MAIS_COMPRADOS') {
        if (b.vezes_comprado !== a.vezes_comprado) {
          return b.vezes_comprado - a.vezes_comprado;
        }
        return b.gasto_total - a.gasto_total;
      }
      if (statsSortBy === 'MAIOR_GASTO') {
        return b.gasto_total - a.gasto_total;
      }
      if (statsSortBy === 'PRECO_MEDIO') {
        return b.preco_medio - a.preco_medio;
      }
      if (statsSortBy === 'MENOR_CICLO') {
        const cicloA = a.intervalo_medio_dias ?? 999999;
        const cicloB = b.intervalo_medio_dias ?? 999999;
        if (cicloA !== cicloB) return cicloA - cicloB;
        return b.vezes_comprado - a.vezes_comprado;
      }
      return a.descricao_item.localeCompare(b.descricao_item);
    });

    return lista;
  }, [estatisticasItensCompleta, statsCategoryFilter, statsSearch, statsSortBy]);

  const resumoEstatisticas = useMemo(() => {
    const totalItensUnicos = estatisticasFiltradas.length;
    const itensRecorrentes = estatisticasFiltradas.filter(
      (i) => i.vezes_comprado >= 2
    ).length;
    const maisComprado =
      [...estatisticasFiltradas].sort(
        (a, b) =>
          b.vezes_comprado - a.vezes_comprado || b.gasto_total - a.gasto_total
      )[0] || null;
    const maiorGastoItem =
      [...estatisticasFiltradas].sort(
        (a, b) => b.gasto_total - a.gasto_total
      )[0] || null;

    return {
      totalItensUnicos,
      itensRecorrentes,
      maisComprado,
      maiorGastoItem,
    };
  }, [estatisticasFiltradas]);

  // Catálogo de produtos únicos para Supermercado ou Farmácia (usando SEMPRE Preço Médio e Quantidade Média)
  const catalogoProdutos = useMemo(() => {
    let lista = [...estatisticasItensCompleta].sort(
      (a, b) =>
        b.vezes_comprado - a.vezes_comprado ||
        a.descricao_item.localeCompare(b.descricao_item)
    );

    if (catalogCategoryFilter !== 'TODAS') {
      lista = lista.filter((p) => p.categoria_item === catalogCategoryFilter);
    }

    const q = catalogSearch.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (p) =>
        p.descricao_item.toLowerCase().includes(q) ||
        p.ultimo_estabelecimento.toLowerCase().includes(q)
    );
  }, [estatisticasItensCompleta, catalogSearch, catalogCategoryFilter]);

  const historicoListasDoTipo = useMemo(() => {
    return historicoListas.filter((l) => l.tipo === currentListType);
  }, [historicoListas, currentListType]);

  // ==========================================
  // CRUD CARTÕES
  // ==========================================
  const handleSaveCartao = async (e) => {
    e.preventDefault();
    if (!supabase) return showNotice('Configure o Supabase no arquivo .env', 'error');

    const payload = {
      nome_cartao: cartaoForm.nome_cartao.trim(),
      bandeira: cartaoForm.bandeira,
      tipo: cartaoForm.tipo,
      limite: Number(cartaoForm.limite) || 0,
      dia_fechamento: Number(cartaoForm.dia_fechamento) || 1,
      dia_vencimento: Number(cartaoForm.dia_vencimento) || 10,
      ativo: Boolean(cartaoForm.ativo),
    };

    try {
      if (cartaoForm.id) {
        const { error } = await supabase
          .from('cartoes')
          .update(payload)
          .eq('id', cartaoForm.id);
        if (error) throw error;
        showNotice('Cartão atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('cartoes').insert([payload]);
        if (error) throw error;
        showNotice('Cartão cadastrado com sucesso!');
      }
      setCartaoForm({
        id: null,
        nome_cartao: '',
        bandeira: 'Mastercard',
        tipo: 'CREDITO',
        limite: '',
        dia_fechamento: 1,
        dia_vencimento: 10,
        ativo: true,
      });
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao salvar cartão: ${err.message}`, 'error');
    }
  };

  const handleDeleteCartao = async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('cartoes').delete().eq('id', id);
      if (error) throw error;
      showNotice('Cartão removido!');
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao excluir cartão: ${err.message}`, 'error');
    }
  };

  // ==========================================
  // CRUD PAGAMENTOS DO MÊS
  // ==========================================
  const openNewTransacaoModal = () => {
    setTransacaoForm({
      ...emptyPagamento(),
      data_competencia: `${selectedMonth}-${String(new Date().getDate()).padStart(2, '0')}`,
    });
    setShowTransacaoModal(true);
  };

  const openEditTransacaoModal = (t) => {
    setTransacaoForm({
      id: t.id,
      tipo: 'PAGAMENTO',
      descricao: t.descricao || '',
      categoria: t.categoria || CATEGORIAS_DESPESA[0],
      valor: t.valor ?? '',
      data_competencia: t.data_competencia || `${selectedMonth}-01`,
      data_pagamento: t.data_pagamento || '',
      forma_pagamento: t.forma_pagamento || 'PIX',
      status: t.status || 'PENDENTE',
      cartao_id: t.cartao_id || '',
    });
    setShowTransacaoModal(true);
  };

  const handleSaveTransacao = async (e) => {
    e.preventDefault();
    if (!supabase) return showNotice('Configure o Supabase no arquivo .env', 'error');

    const payload = {
      tipo: 'PAGAMENTO',
      descricao: transacaoForm.descricao.trim(),
      categoria: transacaoForm.categoria,
      valor: Number(transacaoForm.valor) || 0,
      data_competencia: transacaoForm.data_competencia || null,
      data_pagamento: transacaoForm.data_pagamento || null,
      forma_pagamento: transacaoForm.forma_pagamento,
      status: transacaoForm.status,
      cartao_id: transacaoForm.cartao_id || null,
    };

    try {
      if (transacaoForm.id) {
        const { error } = await supabase
          .from('transacoes')
          .update(payload)
          .eq('id', transacaoForm.id);
        if (error) throw error;
        showNotice('Pagamento atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('transacoes').insert([payload]);
        if (error) throw error;
        showNotice('Pagamento registrado com sucesso!');
      }
      setShowTransacaoModal(false);
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao salvar pagamento: ${err.message}`, 'error');
    }
  };

  const handleToggleStatusTransacao = async (t) => {
    if (!supabase) return;
    const isConcluido =
      t.status === 'CONFIRMADO' || t.status === 'PAGO' || t.status === 'RECEBIDO';
    const novoStatus = isConcluido ? 'PENDENTE' : 'CONFIRMADO';

    try {
      const { error } = await supabase
        .from('transacoes')
        .update({
          status: novoStatus,
          data_pagamento:
            novoStatus === 'PENDENTE'
              ? null
              : t.data_pagamento || new Date().toISOString().split('T')[0],
        })
        .eq('id', t.id);
      if (error) throw error;
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao atualizar status: ${err.message}`, 'error');
    }
  };

  const handleDeleteTransacao = async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('transacoes').delete().eq('id', id);
      if (error) throw error;
      showNotice('Pagamento excluído!');
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao excluir: ${err.message}`, 'error');
    }
  };

  // ==========================================
  // OCR E EDIÇÃO DE NOTAS FISCAIS COM GEMINI API + GARANTIA
  // ==========================================
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const lowerName = (file.name || '').toLowerCase();
      const isTextOrXml =
        file.type === 'text/xml' ||
        file.type === 'application/xml' ||
        file.type === 'text/plain' ||
        file.type === 'text/html' ||
        lowerName.endsWith('.xml') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.html');

      if (isTextOrXml) {
        const textReader = new FileReader();
        textReader.onload = () => {
          const textContent = String(textReader.result || '');
          const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(textContent)}`;
          resolve({
            base64Data: '',
            textContent,
            dataUrl,
            mimeType: 'text/plain',
          });
        };
        textReader.onerror = reject;
        textReader.readAsText(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const mimeType =
          file.type || (lowerName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        if (mimeType.startsWith('image/')) {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1280;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve({
              base64Data: compressedDataUrl.split(',')[1],
              dataUrl: compressedDataUrl,
              mimeType: 'image/jpeg',
            });
          };
          img.onerror = () => {
            resolve({
              base64Data: result.split(',')[1],
              dataUrl: result,
              mimeType,
            });
          };
          img.src = result;
        } else {
          resolve({
            base64Data: result.split(',')[1],
            dataUrl: result,
            mimeType,
          });
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const NOTA_JSON_SCHEMA = {
    type: 'object',
    properties: {
      estabelecimento: { type: 'string' },
      cnpj: { type: 'string' },
      data_emissao: { type: 'string' },
      valor_total: { type: 'number' },
      desconto: { type: 'number' },
      forma_pagamento: { type: 'string' },
      chave_acesso: { type: 'string' },
      categoria_geral: { type: 'string' },
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descricao_item: { type: 'string' },
            quantidade: { type: 'number' },
            unidade: { type: 'string' },
            valor_unitario: { type: 'number' },
            valor_total: { type: 'number' },
            categoria_item: { type: 'string' },
            garantia_meses: { type: 'number' },
          },
          required: [
            'descricao_item',
            'quantidade',
            'unidade',
            'valor_unitario',
            'valor_total',
            'categoria_item',
            'garantia_meses',
          ],
        },
      },
    },
    required: [
      'estabelecimento',
      'cnpj',
      'data_emissao',
      'valor_total',
      'desconto',
      'forma_pagamento',
      'chave_acesso',
      'categoria_geral',
      'itens',
    ],
  };

  const extrairNotaViaGemini = async (
    base64Data,
    mimeType,
    textContent = '',
    fileHint = ''
  ) => {
    const promptInstrucao = `Analise esta Nota Fiscal / Cupom Fiscal brasileiro (NFC-e, NF-e, DANFE, XML, QR Code ou SAT) e extraia todos os dados estruturados.
Classifique cada item e a categoria geral usando uma destas categorias: ${CATEGORIAS_DESPESA.join(', ')}.
Dica importante: se for supermercado/atacarejo/hortifruti/padaria, use "Alimentação & Supermercado"; se for farmácia/drogaria/medicamentos/higiene, use "Saúde & Farmácia"; se for pet shop/ração/veterinário/produtos para animais, use "Pets".
ATENÇÃO MÁXIMA COM A DATA DE EMISSÃO (data_emissao):
- Procure atentamente a data da compra/emissão/autorização impressa na nota (ex: DD/MM/AAAA no cabeçalho, rodapé, protocolo de autorização ou nos dígitos 3 a 6 AAMM da chave de acesso de 44 dígitos) e retorne no formato YYYY-MM-DD.
- Se a imagem for um print parcial onde a data da compra NÃO está visível no texto da imagem, retorne data_emissao como "" (vazio) — NUNCA invente a data de hoje!
${fileHint ? `Informação auxiliar do arquivo: ${fileHint}` : ''}
Para forma_pagamento, normalize para uma destas: PIX, Cartão de Crédito, Cartão de Débito, Dinheiro, Boleto ou Outros.
Para cada item, preencha garantia_meses (número inteiro de meses de garantia): se for um produto eletrônico, eletrodoméstico, informática ou equipamento durável, informe o tempo de garantia escrito na nota ou 12 meses por padrão; se for alimento/supermercado/farmácia/consumível sem garantia durável, retorne 0.`;

    const inputParts = textContent
      ? [
          {
            type: 'text',
            text: `${promptInstrucao}\n\nCONTEÚDO DO ARQUIVO DA NOTA FISCAL:\n${textContent.slice(0, 60000)}`,
          },
        ]
      : [
          {
            type: mimeType === 'application/pdf' ? 'document' : 'image',
            mime_type: mimeType,
            data: base64Data,
          },
          {
            type: 'text',
            text: promptInstrucao,
          },
        ];

    const interaction = await callGeminiWithFallback({
      input: inputParts,
      response_format: [
        {
          type: 'text',
          mime_type: 'application/json',
          schema: NOTA_JSON_SCHEMA,
        },
      ],
    });

    return JSON.parse(interaction.output_text || '{}');
  };

  // Extrai até 6 notas fiscais em UMA ÚNICA requisição Gemini (economiza 6x a cota da API!)
  const extrairMultiplasNotasEmUmaRequisicao = async (arquivosPreparados) => {
    if (arquivosPreparados.length === 1) {
      const unico = arquivosPreparados[0];
      const fileDateIso = unico.queueItem?.file?.lastModified
        ? new Date(unico.queueItem.file.lastModified).toISOString().split('T')[0]
        : '';
      const nota = await extrairNotaViaGemini(
        unico.base64Data,
        unico.mimeType,
        unico.textContent,
        `Arquivo: ${unico.fileName} (Data do arquivo: ${fileDateIso})`
      );
      return [{ arquivo_index: 0, ...nota }];
    }

    const inputParts = [];
    arquivosPreparados.forEach((arq, idx) => {
      const fileDateIso = arq.queueItem?.file?.lastModified
        ? new Date(arq.queueItem.file.lastModified).toISOString().split('T')[0]
        : '';
      inputParts.push({
        type: 'text',
        text: `\n=== INÍCIO DA NOTA FISCAL [arquivo_index = ${idx}] (Nome: ${arq.fileName} | Data do arquivo: ${fileDateIso}) ===`,
      });
      if (arq.textContent) {
        inputParts.push({
          type: 'text',
          text: arq.textContent.slice(0, 30000),
        });
      } else {
        inputParts.push({
          type: arq.mimeType === 'application/pdf' ? 'document' : 'image',
          mime_type: arq.mimeType,
          data: arq.base64Data,
        });
      }
    });

    inputParts.push({
      type: 'text',
      text: `Você recebeu ${arquivosPreparados.length} Notas/Cupons Fiscais brasileiros acima, numerados com arquivo_index de 0 até ${
        arquivosPreparados.length - 1
      }.
Extraia os dados estruturados de CADA UMA das ${arquivosPreparados.length} notas fiscais separadamente, mantendo exatamente o arquivo_index correspondente.
Classifique cada item e a categoria geral usando uma destas categorias: ${CATEGORIAS_DESPESA.join(', ')}.
Dica: supermercado/atacarejo/padaria = "Alimentação & Supermercado"; farmácia/drogaria/medicamentos = "Saúde & Farmácia".
ATENÇÃO MÁXIMA COM A DATA DE EMISSÃO (data_emissao):
- Extraia a data real da compra impressa em cada nota (convertendo DD/MM/AAAA para YYYY-MM-DD) ou dos dígitos 3 a 6 (AAMM) da chave de acesso.
- Se uma imagem for um recorte onde a data de emissão NÃO aparece escrita no cupom, retorne data_emissao como "" (vazio) para aquela nota — NUNCA invente a data de hoje!
Para garantia_meses use 0 para alimentos/farmácia e 12 para eletrônicos.`,
    });

    const interaction = await callGeminiWithFallback({
      input: inputParts,
      response_format: [
        {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              notas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    arquivo_index: { type: 'number' },
                    ...NOTA_JSON_SCHEMA.properties,
                  },
                  required: ['arquivo_index', ...NOTA_JSON_SCHEMA.required],
                },
              },
            },
            required: ['notas'],
          },
        },
      ],
    });

    const parsed = JSON.parse(interaction.output_text || '{}');
    return Array.isArray(parsed.notas) ? parsed.notas : [];
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!effectiveGeminiKey) {
      showNotice(
        'Configure VITE_GEMINI_API_KEY no arquivo .env para usar a leitura via IA.',
        'error'
      );
      return;
    }

    setOcrLoading(true);
    try {
      const { base64Data, dataUrl, mimeType, textContent } = await fileToBase64(file);
      setPreviewImage(dataUrl);

      const fileDateIso = file.lastModified
        ? new Date(file.lastModified).toISOString().split('T')[0]
        : '';
      const parsed = await extrairNotaViaGemini(
        base64Data,
        mimeType,
        textContent,
        `Arquivo: ${file.name} (Data do arquivo: ${fileDateIso})`
      );

      const dataReal = resolverDataEmissaoReal(
        parsed.data_emissao,
        parsed.chave_acesso,
        file,
        batchDateOverride
      );

      setExtractedNota({
        estabelecimento: parsed.estabelecimento || 'Estabelecimento Não Identificado',
        cnpj: parsed.cnpj || '',
        data_emissao: dataReal,
        valor_total: Number(parsed.valor_total) || 0,
        desconto: Number(parsed.desconto) || 0,
        forma_pagamento: parsed.forma_pagamento || 'PIX',
        chave_acesso: parsed.chave_acesso || '',
        categoria_geral: parsed.categoria_geral || CATEGORIAS_DESPESA[0],
        cartao_id: '',
        status_pagamento: 'CONFIRMADO',
        itens: Array.isArray(parsed.itens)
          ? parsed.itens.map((it) => ({
              ...it,
              garantia_meses: Number(it.garantia_meses) || 0,
            }))
          : [],
      });

      showNotice(
        `Nota lida pela IA! Data identificada: ${formatDateBR(dataReal)}. Revise abaixo.`
      );
    } catch (err) {
      console.error('Erro na leitura OCR via Gemini:', err);
      showNotice(`Falha ao ler nota fiscal: ${err.message}`, 'error');
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleEditNota = (nf) => {
    const transacaoVinculada = transacoes.find((t) => t.id === nf.transacao_id);
    const itensDaNota = itensNota
      .filter((i) => i.nota_id === nf.id)
      .map((i) => ({
        descricao_item: i.descricao_item || '',
        quantidade: Number(i.quantidade) || 1,
        unidade: i.unidade || 'UN',
        valor_unitario: Number(i.valor_unitario) || 0,
        valor_total: Number(i.valor_total) || 0,
        categoria_item: i.categoria_item || CATEGORIAS_DESPESA[0],
        garantia_meses: Number(i.garantia_meses) || 0,
      }));

    setPreviewImage(nf.url_comprovante || null);
    setExtractedNota({
      id: nf.id,
      transacao_id: nf.transacao_id || null,
      estabelecimento: nf.estabelecimento || '',
      cnpj: nf.cnpj || '',
      data_emissao: (nf.data_emissao || new Date().toISOString()).split('T')[0],
      valor_total: Number(nf.valor_total) || 0,
      desconto: Number(nf.desconto) || 0,
      forma_pagamento: nf.forma_pagamento || 'PIX',
      chave_acesso: nf.chave_acesso || '',
      categoria_geral: transacaoVinculada?.categoria || CATEGORIAS_DESPESA[0],
      cartao_id: transacaoVinculada?.cartao_id || '',
      status_pagamento: transacaoVinculada?.status || 'CONFIRMADO',
      itens: itensDaNota,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAttachComprovanteOnly = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await fileToBase64(file);
      setPreviewImage(dataUrl);
      showNotice('Comprovante anexado! Clique em Salvar para gravar na nota.');
    } catch (err) {
      showNotice(`Erro ao anexar comprovante: ${err.message}`, 'error');
    }
  };

  const handleItemChange = (idx, field, value) => {
    if (!extractedNota) return;
    const novosItens = [...extractedNota.itens];
    const itemAtual = { ...novosItens[idx], [field]: value };
    if (field === 'quantidade' || field === 'valor_unitario') {
      const qtd = Number(field === 'quantidade' ? value : itemAtual.quantidade) || 0;
      const unit =
        Number(field === 'valor_unitario' ? value : itemAtual.valor_unitario) || 0;
      itemAtual.valor_total = Number((qtd * unit).toFixed(2));
    }
    novosItens[idx] = itemAtual;
    setExtractedNota({ ...extractedNota, itens: novosItens });
  };

  const handleAddItemNota = () => {
    if (!extractedNota) return;
    setExtractedNota({
      ...extractedNota,
      itens: [
        ...extractedNota.itens,
        {
          descricao_item: '',
          quantidade: 1,
          unidade: 'UN',
          valor_unitario: 0,
          valor_total: 0,
          categoria_item: extractedNota.categoria_geral || CATEGORIAS_DESPESA[0],
          garantia_meses:
            extractedNota.categoria_geral === 'Eletrônicos & Eletrodomésticos' ? 12 : 0,
        },
      ],
    });
  };

  const handleRemoveItemNota = (idx) => {
    if (!extractedNota) return;
    setExtractedNota({
      ...extractedNota,
      itens: extractedNota.itens.filter((_, i) => i !== idx),
    });
  };

  const salvarNotaCompletaNoBanco = async (notaObj, dataUrlImagem) => {
    const { valorTotalBruto, desconto, valorPago } = calcularValoresNota(notaObj);

    const transacaoPayload = {
      tipo: 'PAGAMENTO',
      descricao: `NF: ${notaObj.estabelecimento}`,
      categoria: notaObj.categoria_geral || CATEGORIAS_DESPESA[0],
      valor: valorPago,
      data_competencia: notaObj.data_emissao,
      data_pagamento:
        notaObj.status_pagamento === 'CONFIRMADO' ? notaObj.data_emissao : null,
      forma_pagamento: notaObj.forma_pagamento,
      status: notaObj.status_pagamento || 'CONFIRMADO',
      cartao_id: notaObj.cartao_id || null,
    };

    let transacaoIdFinal = notaObj.transacao_id || null;

    if (notaObj.id && transacaoIdFinal) {
      const { error: errUpdTrans } = await supabase
        .from('transacoes')
        .update(transacaoPayload)
        .eq('id', transacaoIdFinal);
      if (errUpdTrans) throw errUpdTrans;
    } else {
      const { data: novaTransacao, error: errTrans } = await supabase
        .from('transacoes')
        .insert([transacaoPayload])
        .select()
        .single();
      if (errTrans) throw errTrans;
      transacaoIdFinal = novaTransacao.id;
    }

    const notaPayload = {
      estabelecimento: notaObj.estabelecimento,
      cnpj: notaObj.cnpj,
      data_emissao: notaObj.data_emissao,
      valor_total: Number(notaObj.valor_total) || 0,
      desconto: Number(notaObj.desconto) || 0,
      forma_pagamento: notaObj.forma_pagamento,
      chave_acesso: notaObj.chave_acesso,
      url_comprovante: dataUrlImagem || null,
      transacao_id: transacaoIdFinal,
    };

    let notaIdFinal = notaObj.id || null;

    if (notaObj.id) {
      const { error: errUpdNota } = await supabase
        .from('notas_fiscais')
        .update(notaPayload)
        .eq('id', notaObj.id);
      if (errUpdNota) throw errUpdNota;

      await supabase.from('itens_nota').delete().eq('nota_id', notaObj.id);
    } else {
      const { data: novaNota, error: errNota } = await supabase
        .from('notas_fiscais')
        .insert([notaPayload])
        .select()
        .single();
      if (errNota) throw errNota;
      notaIdFinal = novaNota.id;
    }

    if (notaObj.itens && notaObj.itens.length > 0) {
      const itensComColuna = notaObj.itens.map((item) => ({
        nota_id: notaIdFinal,
        descricao_item: item.descricao_item || 'Item',
        quantidade: Number(item.quantidade) || 1,
        unidade: item.unidade || 'UN',
        valor_unitario: Number(item.valor_unitario) || 0,
        valor_total: Number(item.valor_total) || 0,
        categoria_item: encodeCategoriaComGarantia(
          item.categoria_item || notaObj.categoria_geral || 'Outros',
          item.garantia_meses
        ),
        garantia_meses: Number(item.garantia_meses) || 0,
      }));

      const { error: errItens } = await supabase
        .from('itens_nota')
        .insert(itensComColuna);

      if (errItens) {
        const itensSemColunaExtra = notaObj.itens.map((item) => ({
          nota_id: notaIdFinal,
          descricao_item: item.descricao_item || 'Item',
          quantidade: Number(item.quantidade) || 1,
          unidade: item.unidade || 'UN',
          valor_unitario: Number(item.valor_unitario) || 0,
          valor_total: Number(item.valor_total) || 0,
          categoria_item: encodeCategoriaComGarantia(
            item.categoria_item || notaObj.categoria_geral || 'Outros',
            item.garantia_meses
          ),
        }));
        const { error: errFallback } = await supabase
          .from('itens_nota')
          .insert(itensSemColunaExtra);
        if (errFallback) throw errFallback;
      }
    }

    return notaIdFinal;
  };

  const handleConfirmAndSaveNota = async (e) => {
    e.preventDefault();
    if (!supabase || !extractedNota) return;

    setOcrLoading(true);
    try {
      await salvarNotaCompletaNoBanco(extractedNota, previewImage);
      showNotice(
        extractedNota.id
          ? 'Nota fiscal, garantias e pagamento atualizados com sucesso!'
          : 'Nota fiscal, garantias e pagamento lançados com sucesso!'
      );
      setExtractedNota(null);
      setPreviewImage(null);
      fetchAllData();
    } catch (err) {
      console.error('Erro ao salvar nota fiscal:', err);
      showNotice(`Erro ao gravar nota: ${err.message}`, 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleDeleteNota = async (nota) => {
    if (!supabase) return;
    try {
      await supabase.from('itens_nota').delete().eq('nota_id', nota.id);
      await supabase.from('notas_fiscais').delete().eq('id', nota.id);
      if (nota.transacao_id) {
        await supabase.from('transacoes').delete().eq('id', nota.transacao_id);
      }
      showNotice('Nota fiscal e lançamento vinculado removidos!');
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao remover nota: ${err.message}`, 'error');
    }
  };

  // ==========================================
  // IMPORTAÇÃO DE NOTAS FISCAIS EM LOTE (50+ NOTAS DE SUPERMERCADO, FARMÁCIA, ETC.)
  // ==========================================
  const runBatchItems = async (itemsToRun, categoryOverride, cartaoId, skipDuplicates) => {
    if (!supabase) {
      showNotice('Configure o Supabase no .env para salvar as notas.', 'error');
      return;
    }
    if (!effectiveGeminiKey) {
      showNotice('Configure VITE_GEMINI_API_KEY no .env para leitura com IA.', 'error');
      return;
    }

    setBatchProcessing(true);

    // Conjunto de chaves de acesso já existentes para evitar duplicidade se ativo
    const chavesExistentes = new Set(
      notasFiscais
        .map((n) => String(n.chave_acesso || '').replace(/\D/g, ''))
        .filter((ch) => ch.length >= 20)
    );

    let savedCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const today = new Date().toISOString().split('T')[0];

    const gravarNotaExtraidaDoItem = async (queueItem, parsed, dataUrl) => {
      const chaveLimpa = String(parsed.chave_acesso || '').replace(/\D/g, '');
      if (skipDuplicates && chaveLimpa.length >= 20 && chavesExistentes.has(chaveLimpa)) {
        duplicateCount++;
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === queueItem.id
              ? {
                  ...q,
                  status: 'DUPLICADA',
                  estabelecimento: parsed.estabelecimento || 'Nota já cadastrada',
                  data_emissao: parsed.data_emissao || today,
                  valor_total: Number(parsed.valor_total) || 0,
                  qtd_itens: Array.isArray(parsed.itens) ? parsed.itens.length : 0,
                  categoria:
                    categoryOverride !== 'AUTO'
                      ? categoryOverride
                      : parsed.categoria_geral || CATEGORIAS_DESPESA[0],
                }
              : q
          )
        );
        return;
      }

      if (chaveLimpa.length >= 20) {
        chavesExistentes.add(chaveLimpa);
      }

      const catFinal =
        categoryOverride !== 'AUTO'
          ? categoryOverride
          : parsed.categoria_geral || CATEGORIAS_DESPESA[0];

      const dataRealNota = resolverDataEmissaoReal(
        parsed.data_emissao,
        parsed.chave_acesso,
        queueItem.file,
        batchDateOverride
      );

      const notaObj = {
        estabelecimento:
          parsed.estabelecimento || 'Estabelecimento Não Identificado',
        cnpj: parsed.cnpj || '',
        data_emissao: dataRealNota,
        valor_total: Number(parsed.valor_total) || 0,
        desconto: Number(parsed.desconto) || 0,
        forma_pagamento: parsed.forma_pagamento || 'PIX',
        chave_acesso: parsed.chave_acesso || '',
        categoria_geral: catFinal,
        cartao_id: cartaoId || '',
        status_pagamento: 'CONFIRMADO',
        itens: Array.isArray(parsed.itens)
          ? parsed.itens.map((it) => ({
              ...it,
              categoria_item:
                categoryOverride !== 'AUTO'
                  ? categoryOverride
                  : it.categoria_item || catFinal,
              garantia_meses: Number(it.garantia_meses) || 0,
            }))
          : [],
      };

      await salvarNotaCompletaNoBanco(notaObj, dataUrl);
      savedCount++;

      setBatchQueue((prev) =>
        prev.map((q) =>
          q.id === queueItem.id
            ? {
                ...q,
                status: 'SUCESSO',
                estabelecimento: notaObj.estabelecimento,
                data_emissao: notaObj.data_emissao,
                valor_total: notaObj.valor_total,
                qtd_itens: notaObj.itens.length,
                categoria: catFinal,
              }
            : q
        )
      );
    };

    // Agrupa as notas em pacotes de até 6 arquivos por chamada da IA:
    // Assim, 50 notas fiscais gastam apenas ~9 requisições na API (em vez de 50!), evitando 429!
    const CHUNK_SIZE = 6;
    for (let start = 0; start < itemsToRun.length; start += CHUNK_SIZE) {
      const chunk = itemsToRun.slice(start, start + CHUNK_SIZE);
      const chunkIds = new Set(chunk.map((c) => c.id));

      setBatchQueue((prev) =>
        prev.map((q) =>
          chunkIds.has(q.id) ? { ...q, status: 'PROCESSANDO', errorMsg: '' } : q
        )
      );

      try {
        // 1. Converte os arquivos do pacote para base64/texto
        const preparados = await Promise.all(
          chunk.map(async (qItem) => {
            const fileData = await fileToBase64(qItem.file);
            return {
              queueItem: qItem,
              fileName: qItem.fileName,
              ...fileData,
            };
          })
        );

        // 2. Envia o pacote inteiro em UMA ÚNICA requisição com fallback automático de modelos
        const notasExtraidas = await extrairMultiplasNotasEmUmaRequisicao(preparados);

        // 3. Salva cada nota retornada no Supabase
        for (let i = 0; i < preparados.length; i++) {
          const prep = preparados[i];
          const notaCorrespondente =
            notasExtraidas.find((n) => Number(n.arquivo_index) === i) ||
            notasExtraidas[i];

          if (notaCorrespondente && notaCorrespondente.estabelecimento) {
            try {
              await gravarNotaExtraidaDoItem(
                prep.queueItem,
                notaCorrespondente,
                prep.dataUrl
              );
            } catch (dbErr) {
              errorCount++;
              setBatchQueue((prev) =>
                prev.map((q) =>
                  q.id === prep.queueItem.id
                    ? { ...q, status: 'ERRO', errorMsg: dbErr.message }
                    : q
                )
              );
            }
          } else {
            // Caso alguma nota específica do pacote não tenha vindo no array, processa individualmente
            try {
              const individualParsed = await extrairNotaViaGemini(
                prep.base64Data,
                prep.mimeType,
                prep.textContent
              );
              await gravarNotaExtraidaDoItem(
                prep.queueItem,
                individualParsed,
                prep.dataUrl
              );
            } catch (indErr) {
              errorCount++;
              setBatchQueue((prev) =>
                prev.map((q) =>
                  q.id === prep.queueItem.id
                    ? { ...q, status: 'ERRO', errorMsg: indErr.message }
                    : q
                )
              );
            }
          }
        }
      } catch (chunkErr) {
        // Se o pacote inteiro falhou, tenta processar cada item do pacote com fallback de modelo
        for (const qItem of chunk) {
          try {
            const { base64Data, dataUrl, mimeType, textContent } = await fileToBase64(
              qItem.file
            );
            const parsed = await extrairNotaViaGemini(
              base64Data,
              mimeType,
              textContent
            );
            await gravarNotaExtraidaDoItem(qItem, parsed, dataUrl);
          } catch (err) {
            console.error(`Erro no arquivo ${qItem.fileName}:`, err);
            errorCount++;
            setBatchQueue((prev) =>
              prev.map((q) =>
                q.id === qItem.id
                  ? {
                      ...q,
                      status: 'ERRO',
                      errorMsg: err.message || 'Falha ao ler/salvar nota',
                    }
                  : q
              )
            );
          }
        }
      }
    }

    setBatchProcessing(false);
    await fetchAllData();

    if (errorCount === 0) {
      showNotice(
        `Lote concluído! ${savedCount} nota(s) importada(s) com sucesso${
          duplicateCount > 0 ? ` (${duplicateCount} duplicada(s) ignorada(s))` : ''
        }.`
      );
    } else {
      showNotice(
        `Lote finalizado: ${savedCount} salva(s), ${errorCount} com erro. Você pode clicar em "Reprocessar Falhas".`,
        'error'
      );
    }
  };

  const handleBatchFilesUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    const newQueueItems = fileList.map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      fileSizeKB: Math.max(1, Math.round(file.size / 1024)),
      status: 'PENDENTE', // PENDENTE | PROCESSANDO | SUCESSO | DUPLICADA | ERRO
      estabelecimento: '',
      data_emissao: '',
      valor_total: 0,
      qtd_itens: 0,
      categoria: '',
      errorMsg: '',
    }));

    setBatchQueue((prev) => [...prev, ...newQueueItems]);
    e.target.value = '';

    await runBatchItems(
      newQueueItems,
      batchCategoryOverride,
      batchCartaoId,
      batchSkipDuplicates
    );
  };

  const handleRetryFailedBatch = async () => {
    const failedItems = batchQueue.filter((q) => q.status === 'ERRO');
    if (failedItems.length === 0 || batchProcessing) return;
    await runBatchItems(
      failedItems,
      batchCategoryOverride,
      batchCartaoId,
      batchSkipDuplicates
    );
  };

  // ==========================================
  // ATUALIZAÇÃO RÁPIDA DE DATA (INDIVIDUAL E EM LOTE) PARA NOTAS JÁ IMPORTADAS
  // ==========================================
  const handleQuickUpdateNotaDate = async (nf, novaData) => {
    if (!supabase || !novaData) return;
    try {
      const { error: e1 } = await supabase
        .from('notas_fiscais')
        .update({ data_emissao: novaData })
        .eq('id', nf.id);
      if (e1) throw e1;

      if (nf.transacao_id) {
        await supabase
          .from('transacoes')
          .update({ data_competencia: novaData, data_pagamento: novaData })
          .eq('id', nf.transacao_id);
      }
      showNotice(`Data da nota "${nf.estabelecimento}" atualizada para ${formatDateBR(novaData)}!`);
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao atualizar data: ${err.message}`, 'error');
    }
  };

  const handleBulkUpdateNotasDate = async () => {
    if (!supabase || selectedNotasIds.length === 0 || !bulkNewDate) {
      return showNotice('Selecione ao menos 1 nota e informe a nova data.', 'error');
    }
    setLoading(true);
    try {
      const { error: e1 } = await supabase
        .from('notas_fiscais')
        .update({ data_emissao: bulkNewDate })
        .in('id', selectedNotasIds);
      if (e1) throw e1;

      const transIds = notasFiscais
        .filter((n) => selectedNotasIds.includes(n.id) && n.transacao_id)
        .map((n) => n.transacao_id);

      if (transIds.length > 0) {
        await supabase
          .from('transacoes')
          .update({ data_competencia: bulkNewDate, data_pagamento: bulkNewDate })
          .in('id', transIds);
      }

      showNotice(
        `Data de ${selectedNotasIds.length} nota(s) alterada para ${formatDateBR(bulkNewDate)}!`
      );
      setSelectedNotasIds([]);
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao alterar datas em lote: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // IMPORTAÇÃO DE NOTA FISCAL POR QR CODE OU CHAVE DE ACESSO (44 DÍGITOS)
  // ==========================================
  const infoQrDecodificada = useMemo(
    () => decodificarChaveOuQrCode(qrChaveInput),
    [qrChaveInput]
  );

  useEffect(() => {
    if (infoQrDecodificada?.valida) {
      const d = infoQrDecodificada.dataSugerida.split('-')[2] || '01';
      setQrDiaCompra(d);
      if (infoQrDecodificada.valorExtraido > 0 && !qrValorManual) {
        setQrValorManual(String(infoQrDecodificada.valorExtraido));
      }
    }
  }, [infoQrDecodificada?.chave44]);

  const stopQrCamera = () => {
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
    setQrCameraActive(false);
  };

  const startQrCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      qrStreamRef.current = stream;
      setQrCameraActive(true);
      setTimeout(() => {
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = stream;
          qrVideoRef.current.play().catch(() => {});
        }
      }, 150);

      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13'],
        });
        const interval = setInterval(async () => {
          if (!qrStreamRef.current || !qrVideoRef.current) {
            clearInterval(interval);
            return;
          }
          try {
            const barcodes = await detector.detect(qrVideoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              if (rawValue) {
                setQrChaveInput(rawValue);
                clearInterval(interval);
                stopQrCamera();
                showNotice('QR Code / Código de Barras lido com sucesso!');
              }
            }
          } catch {
            // continua escaneando
          }
        }, 450);
      } else {
        showNotice(
          'Aponte a câmera ou use o botão "Foto do QR Code" para leitura via IA.',
          'success'
        );
      }
    } catch (err) {
      showNotice(`Não foi possível acessar a câmera: ${err.message}`, 'error');
    }
  };

  const handleQrImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrLoading(true);
    try {
      // 1. Tenta BarcodeDetector nativo na imagem primeiro
      if ('BarcodeDetector' in window) {
        try {
          const bitmap = await createImageBitmap(file);
          const detector = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128'],
          });
          const codes = await detector.detect(bitmap);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            setQrChaveInput(codes[0].rawValue);
            showNotice('QR Code extraído da imagem com sucesso!');
            setQrLoading(false);
            e.target.value = '';
            return;
          }
        } catch {
          // Segue para leitura via Gemini IA
        }
      }

      // 2. Usa Gemini IA para ler o QR Code / Chave de 44 dígitos e os dados da imagem
      const { base64Data, dataUrl, mimeType } = await fileToBase64(file);
      setPreviewImage(dataUrl);
      const interaction = await callGeminiWithFallback({
        input: [
          {
            type: 'image',
            mime_type: mimeType,
            data: base64Data,
          },
          {
            type: 'text',
            text: 'Extraia a Chave de Acesso de 44 dígitos (ou a URL do QR Code), o nome do estabelecimento, CNPJ, data de emissão (YYYY-MM-DD) e valor total desta imagem de Nota Fiscal / QR Code.',
          },
        ],
        response_format: [
          {
            type: 'text',
            mime_type: 'application/json',
            schema: NOTA_JSON_SCHEMA,
          },
        ],
      });
      const parsed = JSON.parse(interaction.output_text || '{}');
      if (parsed.chave_acesso) {
        setQrChaveInput(parsed.chave_acesso);
      }
      const dataReal = resolverDataEmissaoReal(
        parsed.data_emissao,
        parsed.chave_acesso,
        file
      );
      setExtractedNota({
        estabelecimento: parsed.estabelecimento || 'Estabelecimento',
        cnpj: parsed.cnpj || '',
        data_emissao: dataReal,
        valor_total: Number(parsed.valor_total) || 0,
        desconto: Number(parsed.desconto) || 0,
        forma_pagamento: parsed.forma_pagamento || 'PIX',
        chave_acesso: parsed.chave_acesso || '',
        categoria_geral: parsed.categoria_geral || CATEGORIAS_DESPESA[0],
        cartao_id: '',
        status_pagamento: 'CONFIRMADO',
        itens: Array.isArray(parsed.itens) ? parsed.itens : [],
      });
      showNotice('Dados do QR Code / Chave lidos pela IA! Revise abaixo.');
    } catch (err) {
      showNotice(`Erro ao ler QR Code: ${err.message}`, 'error');
    } finally {
      setQrLoading(false);
      e.target.value = '';
    }
  };

  const handleImportarPorChaveOuQrCode = async () => {
    if (!qrChaveInput.trim()) {
      return showNotice(
        'Informe a Chave de Acesso de 44 dígitos ou escaneie o QR Code.',
        'error'
      );
    }

    setQrLoading(true);
    try {
      const info = decodificarChaveOuQrCode(qrChaveInput);
      let nomeEstabelecimento = '';
      let cnpjFormatado = info?.cnpjFormatado || '';
      let categoriaDetectada = CATEGORIAS_DESPESA[0];

      // 1. Consulta pública automática do CNPJ da chave de acesso na BrasilAPI
      if (info?.cnpjRaw && info.cnpjRaw.length === 14) {
        try {
          const resp = await fetch(
            `https://brasilapi.com.br/api/cnpj/v1/${info.cnpjRaw}`
          );
          if (resp.ok) {
            const cnpjData = await resp.json();
            nomeEstabelecimento =
              cnpjData.nome_fantasia || cnpjData.razao_social || '';
            const cnaeDesc = String(
              cnpjData.cnae_fiscal_descricao || ''
            ).toLowerCase();
            if (
              cnaeDesc.includes('farmac') ||
              cnaeDesc.includes('drogaria') ||
              cnaeDesc.includes('medicamento') ||
              cnaeDesc.includes('perfumaria') ||
              nomeEstabelecimento.toLowerCase().includes('farma') ||
              nomeEstabelecimento.toLowerCase().includes('drog') ||
              nomeEstabelecimento.toLowerCase().includes('pague menos')
            ) {
              categoriaDetectada = 'Saúde & Farmácia';
            } else if (
              cnaeDesc.includes('hipermercado') ||
              cnaeDesc.includes('supermercado') ||
              cnaeDesc.includes('minimercado') ||
              cnaeDesc.includes('alimento') ||
              cnaeDesc.includes('hortifrut') ||
              cnaeDesc.includes('padaria')
            ) {
              categoriaDetectada = 'Alimentação & Supermercado';
            }
          }
        } catch {
          // continua mesmo sem internet/BrasilAPI
        }
      }

      const diaEscolhido = String(Number(qrDiaCompra) || 1).padStart(2, '0');
      const dataPelaChave = info?.valida
        ? `${info.anoMes}-${diaEscolhido}`
        : new Date().toISOString().split('T')[0];

      // 2. Se o usuário também colou o texto/itens copiados da SEFAZ, usa a IA para extrair todos os itens
      if (qrTextoSefaz.trim()) {
        const parsed = await extrairNotaViaGemini(
          '',
          'text/plain',
          qrTextoSefaz,
          `Chave: ${info?.chave44 || qrChaveInput} | Data da Chave: ${dataPelaChave} | Loja pelo CNPJ: ${nomeEstabelecimento}`
        );

        const dataFinal = resolverDataEmissaoReal(
          parsed.data_emissao,
          info?.chave44 || parsed.chave_acesso,
          null,
          info?.valida ? dataPelaChave : ''
        );

        setExtractedNota({
          estabelecimento:
            nomeEstabelecimento ||
            parsed.estabelecimento ||
            `Nota Fiscal #${info?.numeroNota || ''}`,
          cnpj: cnpjFormatado || parsed.cnpj || '',
          data_emissao: dataFinal,
          valor_total:
            Number(qrValorManual) ||
            Number(parsed.valor_total) ||
            info?.valorExtraido ||
            0,
          desconto: Number(parsed.desconto) || 0,
          forma_pagamento: parsed.forma_pagamento || 'PIX',
          chave_acesso: info?.chave44 || parsed.chave_acesso || qrChaveInput.trim(),
          categoria_geral:
            parsed.categoria_geral && parsed.categoria_geral !== 'Outros'
              ? parsed.categoria_geral
              : categoriaDetectada,
          cartao_id: '',
          status_pagamento: 'CONFIRMADO',
          itens: Array.isArray(parsed.itens) ? parsed.itens : [],
        });
        showNotice(
          `Nota e ${
            (parsed.itens || []).length
          } item(ns) extraídos com a data preservada (${formatDateBR(dataFinal)})!`
        );
      } else {
        // Preenche com todos os dados extraídos da Chave de 44 dígitos + CNPJ BrasilAPI
        const valorTotalFinal =
          Number(qrValorManual) || Number(info?.valorExtraido) || 0;
        setExtractedNota({
          estabelecimento:
            nomeEstabelecimento ||
            `Estabelecimento (${info?.uf || 'NF'} #${info?.numeroNota || ''})`,
          cnpj: cnpjFormatado,
          data_emissao: dataPelaChave,
          valor_total: valorTotalFinal,
          desconto: 0,
          forma_pagamento: 'PIX',
          chave_acesso: info?.chave44 || qrChaveInput.trim(),
          categoria_geral: categoriaDetectada,
          cartao_id: '',
          status_pagamento: 'CONFIRMADO',
          itens:
            valorTotalFinal > 0
              ? [
                  {
                    descricao_item: `Compra em ${
                      nomeEstabelecimento || 'Estabelecimento'
                    } (NF #${info?.numeroNota || ''})`,
                    quantidade: 1,
                    unidade: 'UN',
                    valor_unitario: valorTotalFinal,
                    valor_total: valorTotalFinal,
                    categoria_item: categoriaDetectada,
                    garantia_meses: 0,
                  },
                ]
              : [],
        });
        showNotice(
          `Chave decodificada! Loja: ${
            nomeEstabelecimento || cnpjFormatado
          } • Data preservada: ${formatDateBR(dataPelaChave)}. Revise abaixo!`
        );
      }
    } catch (err) {
      showNotice(`Erro ao processar chave/QR Code: ${err.message}`, 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const batchSummary = useMemo(() => {
    const total = batchQueue.length;
    const sucesso = batchQueue.filter((q) => q.status === 'SUCESSO').length;
    const duplicadas = batchQueue.filter((q) => q.status === 'DUPLICADA').length;
    const erro = batchQueue.filter((q) => q.status === 'ERRO').length;
    const processando = batchQueue.filter((q) => q.status === 'PROCESSANDO').length;
    const pendente = batchQueue.filter((q) => q.status === 'PENDENTE').length;
    const concluidos = sucesso + duplicadas + erro;
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    const valorTotalImportado = batchQueue
      .filter((q) => q.status === 'SUCESSO')
      .reduce((acc, q) => acc + calcularValoresNota(q).valorPago, 0);
    const totalItensImportados = batchQueue
      .filter((q) => q.status === 'SUCESSO')
      .reduce((acc, q) => acc + (Number(q.qtd_itens) || 0), 0);

    return {
      total,
      sucesso,
      duplicadas,
      erro,
      processando,
      pendente,
      concluidos,
      percentual,
      valorTotalImportado,
      totalItensImportados,
    };
  }, [batchQueue]);

  // ==========================================
  // FUNÇÕES INTELIGENTES DE LISTA DE COMPRAS (SUPERMERCADO & FARMÁCIA)
  // SEMPRE USANDO PREÇO MÉDIO E QUANTIDADE MÉDIA COMPRADA
  // ==========================================
  const addFromCatalogToShoppingList = (prod, targetListType = null) => {
    const tipoAlvo = targetListType || currentListType;
    const setter =
      tipoAlvo === 'FARMACIA' ? setShoppingListFarmacia : setShoppingListSupermercado;

    const qtdMediaPadrao =
      Number(prod.quantidade_media) > 0 ? Number(prod.quantidade_media) : 1;
    const precoMedioPadrao =
      Number(prod.preco_medio) > 0
        ? Number(prod.preco_medio)
        : Number(prod.ultimo_valor_unitario) || 0;

    setter((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.descricao_item.trim().toUpperCase() === prod.chave
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantidade: Number(
            (Number(updated[existingIdx].quantidade) + qtdMediaPadrao).toFixed(3)
          ),
          valor_unitario: precoMedioPadrao,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          descricao_item: prod.descricao_item,
          quantidade: qtdMediaPadrao,
          unidade: prod.unidade || 'un',
          valor_unitario: precoMedioPadrao,
          estabelecimento_ref: `Preço médio (${prod.vezes_comprado || 1}x) • Qtd média: ${qtdMediaPadrao} ${prod.unidade || 'un'} • ${prod.frequencia_texto || ''}`,
          checked: false,
        },
      ];
    });
    showNotice(
      `"${prod.descricao_item}" adicionado com Qtd Média (${qtdMediaPadrao} ${
        prod.unidade || 'un'
      }) e Preço Médio (${formatCurrency(precoMedioPadrao)})!`
    );
  };

  const handleAddCustomShoppingItem = (e) => {
    e.preventDefault();
    if (!customListItem.descricao_item.trim()) return;
    setCurrentShoppingList((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        descricao_item: customListItem.descricao_item.trim(),
        quantidade: Number(customListItem.quantidade) || 1,
        unidade: customListItem.unidade || 'un',
        valor_unitario: Number(customListItem.valor_unitario) || 0,
        estabelecimento_ref: 'Manual',
        checked: false,
      },
    ]);
    setCustomListItem({
      descricao_item: '',
      quantidade: 1,
      unidade: 'un',
      valor_unitario: '',
    });
  };

  const updateShoppingItem = (id, field, value) => {
    setCurrentShoppingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeShoppingItem = (id) => {
    setCurrentShoppingList((prev) => prev.filter((item) => item.id !== id));
  };

  const resumoListaCompras = useMemo(() => {
    const totalPrevisto = currentShoppingList.reduce(
      (acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0),
      0
    );
    const totalNoCarrinho = currentShoppingList
      .filter((i) => i.checked)
      .reduce(
        (acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0),
        0
      );
    return {
      totalPrevisto,
      totalNoCarrinho,
      faltaPegar: totalPrevisto - totalNoCarrinho,
    };
  }, [currentShoppingList]);

  // 1. SALVAR LISTA NO HISTÓRICO DO BANCO DE DADOS
  const handleSaveListToHistory = async (customConferencia = null) => {
    if (!supabase) return showNotice('Configure o Supabase no .env', 'error');
    if (currentShoppingList.length === 0) {
      return showNotice('Adicione pelo menos 1 item na lista antes de salvar.', 'error');
    }

    const tipoTag =
      currentListType === 'FARMACIA' ? '__LISTA_FARMACIA__' : '__LISTA_SUPERMERCADO__';
    const hoje = new Date().toISOString().split('T')[0];
    const tituloPadrao =
      currentMeta.titulo.trim() ||
      `Lista de ${
        currentListType === 'FARMACIA' ? 'Farmácia' : 'Supermercado'
      } (${formatDateBR(hoje)})`;

    const payloadJson = {
      tipo: currentListType,
      titulo: tituloPadrao,
      data_criacao: hoje,
      status: customConferencia || currentMeta.conferencia ? 'CONFERIDA' : 'ABERTA',
      total_previsto: resumoListaCompras.totalPrevisto,
      analise_ia: currentMeta.analise_ia || '',
      itens: currentShoppingList,
      conferencia: customConferencia || currentMeta.conferencia || null,
    };

    try {
      if (currentMeta.id) {
        const { error } = await supabase
          .from('contas_bancarias')
          .update({
            nome_banco: JSON.stringify(payloadJson),
            tipo_conta: tipoTag,
            saldo_inicial: resumoListaCompras.totalPrevisto,
            ativo: false,
          })
          .eq('id', currentMeta.id);
        if (error) throw error;
        showNotice('Lista atualizada no histórico com sucesso!');
      } else {
        const { data, error } = await supabase
          .from('contas_bancarias')
          .insert([
            {
              nome_banco: JSON.stringify(payloadJson),
              tipo_conta: tipoTag,
              saldo_inicial: resumoListaCompras.totalPrevisto,
              ativo: false,
            },
          ])
          .select()
          .single();
        if (error) throw error;
        updateCurrentMeta({ id: data.id, titulo: tituloPadrao });
        showNotice('Lista salva no histórico com sucesso!');
      }
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao salvar lista no histórico: ${err.message}`, 'error');
    }
  };

  const handleLoadListFromHistory = (hist) => {
    setCurrentShoppingList(hist.itens || []);
    updateCurrentMeta({
      id: hist.db_id,
      titulo: hist.titulo || '',
      analise_ia: hist.analise_ia || '',
      conferencia: hist.conferencia || null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotice(`Lista "${hist.titulo}" carregada!`);
  };

  const handleDeleteHistoryList = async (dbId) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('contas_bancarias').delete().eq('id', dbId);
      if (error) throw error;
      if (currentMeta.id === dbId) {
        updateCurrentMeta({ id: null, titulo: '', analise_ia: '', conferencia: null });
      }
      showNotice('Lista removida do histórico!');
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao excluir lista: ${err.message}`, 'error');
    }
  };

  // 2. PREVISÃO DE LISTA DE COMPRAS E ANÁLISE DE CONSUMO COM IA (SEMPRE COM PREÇO MÉDIO E QUANTIDADE MÉDIA)
  const handlePredictShoppingListWithAI = async () => {
    if (!effectiveGeminiKey) {
      return showNotice('Configure VITE_GEMINI_API_KEY no .env', 'error');
    }

    const statsDaCategoria = estatisticasItensCompleta.filter(
      (i) => i.categoria_item === defaultCategoryForType
    );

    if (statsDaCategoria.length === 0 && historicoListasDoTipo.length === 0) {
      return showNotice(
        `Ainda não há notas ou compras de ${defaultCategoryForType} cadastradas para a IA analisar seu consumo.`,
        'error'
      );
    }

    setAiListLoading(true);
    try {
      const resumoEstatisticasCategoria = statsDaCategoria.slice(0, 120).map((s) => ({
        item: s.descricao_item,
        vezes_comprado: s.vezes_comprado,
        frequencia: s.frequencia_texto,
        quantidade_media: s.quantidade_media,
        unidade: s.unidade,
        preco_medio: s.preco_medio,
        ultima_compra: s.ultima_data,
      }));

      const resumoListasSalvas = historicoListasDoTipo.slice(0, 10).map((l) => ({
        titulo: l.titulo,
        data: l.data_criacao,
        itens: (l.itens || []).map((it) => ({
          item: it.descricao_item,
          qtd: it.quantidade,
          unidade: it.unidade,
        })),
      }));

      const interaction = await callGeminiWithFallback({
        input: `Você é um assistente especialista em análise de consumo doméstico para ${
          currentListType === 'FARMACIA' ? 'Farmácia e Saúde' : 'Supermercado e Alimentação'
        }.
Hoje é ${new Date().toISOString().split('T')[0]}.
Analise as estatísticas históricas de consumo extraídas das Notas Fiscais do usuário (contendo frequência, quantidade_media e preco_medio de cada item):
${JSON.stringify(resumoEstatisticasCategoria)}

E o histórico de listas anteriores:
${JSON.stringify(resumoListasSalvas)}

Tarefa:
1. Faça uma breve análise do padrão de consumo do usuário (quais produtos ele mais consome, frequência/intervalo, e o que provavelmente precisa repor agora).
2. Monte uma previsão de lista de compras ideal com os produtos recomendados, utilizando OBRIGATORIAMENTE a quantidade_media comprada e o preco_medio de cada produto no histórico.`,
        response_format: [
          {
            type: 'text',
            mime_type: 'application/json',
            schema: {
              type: 'object',
              properties: {
                analise_consumo: { type: 'string' },
                itens_previstos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      descricao_item: { type: 'string' },
                      quantidade: { type: 'number' },
                      unidade: { type: 'string' },
                      valor_unitario: { type: 'number' },
                      motivo_ia: { type: 'string' },
                    },
                    required: [
                      'descricao_item',
                      'quantidade',
                      'unidade',
                      'valor_unitario',
                      'motivo_ia',
                    ],
                  },
                },
              },
              required: ['analise_consumo', 'itens_previstos'],
            },
          },
        ],
      });

      const parsed = JSON.parse(interaction.output_text || '{}');
      const mapaStats = new Map(
        estatisticasItensCompleta.map((s) => [s.chave, s])
      );

      const novosItens = (parsed.itens_previstos || []).map((it) => {
        const chave = String(it.descricao_item || '').trim().toUpperCase();
        const statMatch = mapaStats.get(chave);
        const qtdFinal = statMatch
          ? statMatch.quantidade_media
          : Number(it.quantidade) || 1;
        const precoFinal = statMatch
          ? statMatch.preco_medio
          : Number(it.valor_unitario) || 0;

        return {
          id: crypto.randomUUID(),
          descricao_item: it.descricao_item,
          quantidade: qtdFinal,
          unidade: statMatch?.unidade || it.unidade || 'un',
          valor_unitario: precoFinal,
          estabelecimento_ref: `IA (Preço e Qtd Média): ${
            it.motivo_ia || statMatch?.frequencia_texto || 'Reposição sugerida'
          }`,
          checked: false,
        };
      });

      setCurrentShoppingList(novosItens);
      updateCurrentMeta({
        analise_ia: parsed.analise_consumo || '',
        titulo:
          currentMeta.titulo ||
          `Lista Inteligente IA - ${
            currentListType === 'FARMACIA' ? 'Farmácia' : 'Supermercado'
          }`,
      });
      showNotice(
        'Lista inteligente gerada pela IA com Preço Médio e Quantidade Média do seu histórico!'
      );
    } catch (err) {
      console.error('Erro ao prever lista com IA:', err);
      showNotice(`Erro na análise de consumo IA: ${err.message}`, 'error');
    } finally {
      setAiListLoading(false);
    }
  };

  // 3. CONFERÊNCIA INTELIGENTE DA LISTA COM NOTA FISCAL (EQUIVALÊNCIA DE NOMES VIA IA)
  const executarConferenciaComNotaIA = async (dadosNota) => {
    const listaPlanejada = currentShoppingList.map((i) => ({
      id: i.id,
      item_lista: i.descricao_item,
      qtd_planejada: Number(i.quantidade) || 1,
      unidade: i.unidade,
      preco_estimado_unit: Number(i.valor_unitario) || 0,
    }));

    const itensDaNota = (dadosNota.itens || []).map((i) => ({
      item_nota: i.descricao_item,
      qtd_comprada: Number(i.quantidade) || 1,
      unidade: i.unidade,
      preco_pago_unit: Number(i.valor_unitario) || 0,
      valor_total_item: Number(i.valor_total) || 0,
    }));

    const interaction = await callGeminiWithFallback({
      input: `Compare a LISTA DE COMPRAS PLANEJADA pelo usuário com os ITENS DA NOTA FISCAL comprada no estabelecimento "${dadosNota.estabelecimento}".
Lembre-se que as notas fiscais usam abreviações e nomes comerciais variados dependendo do estabelecimento (ex.: "Peito de Frango" na lista equivale a "FILE PEIT REGINA 70" na nota; "Carne Moída" equivale a "CARNE MOIDA PRIM"; "Dipirona" equivale a "DIPIRONA SOD 500MG").
Identifique por equivalência semântica:
1. Quais itens da lista foram comprados (mesmo com nome abreviado/diferente na nota).
2. Quais itens da lista NÃO foram comprados (faltaram).
3. Quais itens da nota fiscal foram comprados de forma extra (não estavam na lista planejada).
4. Gere também um breve insight_consumo comparando o valor planejado vs valor gasto real e hábitos observados.

LISTA PLANEJADA:
${JSON.stringify(listaPlanejada)}

ITENS DA NOTA FISCAL:
${JSON.stringify(itensDaNota)}`,
      response_format: [
        {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              insight_consumo: { type: 'string' },
              comprados: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item_lista: { type: 'string' },
                    item_equivalente_nota: { type: 'string' },
                    qtd_planejada: { type: 'number' },
                    qtd_comprada: { type: 'number' },
                    valor_estimado: { type: 'number' },
                    valor_pago: { type: 'number' },
                  },
                  required: [
                    'item_lista',
                    'item_equivalente_nota',
                    'qtd_planejada',
                    'qtd_comprada',
                    'valor_estimado',
                    'valor_pago',
                  ],
                },
              },
              faltaram: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item_lista: { type: 'string' },
                    qtd_planejada: { type: 'number' },
                    valor_estimado: { type: 'number' },
                  },
                  required: ['item_lista', 'qtd_planejada', 'valor_estimado'],
                },
              },
              extras_fora_da_lista: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item_nota: { type: 'string' },
                    qtd_comprada: { type: 'number' },
                    valor_pago: { type: 'number' },
                  },
                  required: ['item_nota', 'qtd_comprada', 'valor_pago'],
                },
              },
            },
            required: [
              'insight_consumo',
              'comprados',
              'faltaram',
              'extras_fora_da_lista',
            ],
          },
        },
      ],
    });

    const resultado = JSON.parse(interaction.output_text || '{}');

    // Marca automaticamente como checked na lista os itens que foram identificados como comprados
    const nomesCompradosSet = new Set(
      (resultado.comprados || []).map((c) =>
        String(c.item_lista || '').trim().toUpperCase()
      )
    );

    setCurrentShoppingList((prev) =>
      prev.map((item) => ({
        ...item,
        checked:
          nomesCompradosSet.has(item.descricao_item.trim().toUpperCase()) || item.checked,
      }))
    );

    const conferenciaCompleta = {
      data_conferencia: new Date().toISOString().split('T')[0],
      estabelecimento: dadosNota.estabelecimento,
      data_nota: dadosNota.data_emissao,
      valor_bruto_nota: calcularValoresNota(dadosNota).valorTotalBruto,
      desconto_nota: calcularValoresNota(dadosNota).desconto,
      valor_total_nota: calcularValoresNota(dadosNota).valorPago,
      insight_consumo: resultado.insight_consumo || '',
      comprados: resultado.comprados || [],
      faltaram: resultado.faltaram || [],
      extras_fora_da_lista: resultado.extras_fora_da_lista || [],
    };

    updateCurrentMeta({ conferencia: conferenciaCompleta });
    return conferenciaCompleta;
  };

  // Upload de foto/arquivo da Nota Fiscal direto na tela da Lista de Compras
  const handleVerifyListWithUploadedNota = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (currentShoppingList.length === 0) {
      return showNotice('Sua lista está vazia! Adicione itens antes de conferir.', 'error');
    }
    if (!GEMINI_API_KEY) {
      return showNotice('Configure VITE_GEMINI_API_KEY no .env', 'error');
    }

    setAiListLoading(true);
    try {
      const { base64Data, dataUrl, mimeType, textContent } = await fileToBase64(file);
      const parsedNota = await extrairNotaViaGemini(base64Data, mimeType, textContent);
      const today = new Date().toISOString().split('T')[0];

      const notaParaSalvar = {
        estabelecimento: parsedNota.estabelecimento || 'Estabelecimento',
        cnpj: parsedNota.cnpj || '',
        data_emissao: parsedNota.data_emissao || today,
        valor_total: Number(parsedNota.valor_total) || 0,
        desconto: Number(parsedNota.desconto) || 0,
        forma_pagamento: parsedNota.forma_pagamento || 'PIX',
        chave_acesso: parsedNota.chave_acesso || '',
        categoria_geral: defaultCategoryForType,
        cartao_id: '',
        status_pagamento: 'CONFIRMADO',
        itens: Array.isArray(parsedNota.itens)
          ? parsedNota.itens.map((it) => ({
              ...it,
              categoria_item: it.categoria_item || defaultCategoryForType,
              garantia_meses: Number(it.garantia_meses) || 0,
            }))
          : [],
      };

      // 1. Grava a nota fiscal, itens e pagamento no Supabase
      await salvarNotaCompletaNoBanco(notaParaSalvar, dataUrl);

      // 2. Executa a conferência por equivalência semântica via IA
      const conf = await executarConferenciaComNotaIA(notaParaSalvar);

      // 3. Salva a lista conferida no Histórico de Listas de Compras
      await handleSaveListToHistory(conf);

      showNotice(
        'Nota fiscal cadastrada e lista conferida por equivalência com sucesso!'
      );
    } catch (err) {
      console.error('Erro ao conferir lista com nota:', err);
      showNotice(`Erro ao conferir nota: ${err.message}`, 'error');
    } finally {
      setAiListLoading(false);
      e.target.value = '';
    }
  };

  // Conferir a lista atual selecionando uma Nota Fiscal que já foi cadastrada antes
  const handleVerifyListWithExistingNota = async () => {
    if (!selectedExistingNotaId) {
      return showNotice('Selecione uma nota fiscal já cadastrada para comparar.', 'error');
    }
    if (currentShoppingList.length === 0) {
      return showNotice('Sua lista está vazia! Adicione itens antes de conferir.', 'error');
    }

    const nf = notasFiscais.find((n) => n.id === selectedExistingNotaId);
    if (!nf) return;

    const itensDaNota = itensNota.filter((i) => i.nota_id === nf.id);

    setAiListLoading(true);
    try {
      const conf = await executarConferenciaComNotaIA({
        estabelecimento: nf.estabelecimento,
        data_emissao: (nf.data_emissao || '').split('T')[0],
        valor_total: nf.valor_total,
        desconto: nf.desconto,
        itens: itensDaNota,
      });

      await handleSaveListToHistory(conf);
      showNotice('Conferência por equivalência concluída e salva no histórico!');
    } catch (err) {
      showNotice(`Erro ao conferir com nota existente: ${err.message}`, 'error');
    } finally {
      setAiListLoading(false);
    }
  };

  // ==========================================
  // GESTÃO E EDIÇÃO DE CATEGORIAS (COM SINCRONIZAÇÃO NO SUPABASE E ATUALIZAÇÃO DE HISTÓRICO)
  // ==========================================
  const salvarCategoriasNoBancoELocal = async (novaLista) => {
    const listaFinal = Array.from(
      new Set(novaLista.map((c) => String(c || '').trim()).filter(Boolean))
    );
    if (!listaFinal.includes('Outros')) {
      listaFinal.push('Outros');
    }
    setCategoriasDespesa(listaFinal);

    if (!supabase) return;
    try {
      if (configCategoriasDbId) {
        await supabase
          .from('contas_bancarias')
          .update({
            nome_banco: JSON.stringify(listaFinal),
            tipo_conta: '__CONFIG_CATEGORIAS__',
            saldo_inicial: 0,
            ativo: false,
          })
          .eq('id', configCategoriasDbId);
      } else {
        const { data } = await supabase
          .from('contas_bancarias')
          .insert([
            {
              nome_banco: JSON.stringify(listaFinal),
              tipo_conta: '__CONFIG_CATEGORIAS__',
              saldo_inicial: 0,
              ativo: false,
            },
          ])
          .select()
          .single();
        if (data?.id) {
          setConfigCategoriasDbId(data.id);
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar categorias no Supabase:', err);
    }
  };

  const handleAddCategoria = async (e) => {
    e.preventDefault();
    const nova = novaCategoriaInput.trim();
    if (!nova) return;
    if (
      categoriasDespesa.some((c) => c.toLowerCase() === nova.toLowerCase())
    ) {
      return showNotice(`A categoria "${nova}" já existe!`, 'error');
    }

    const novaLista = [...categoriasDespesa];
    const idxOutros = novaLista.indexOf('Outros');
    if (idxOutros >= 0) {
      novaLista.splice(idxOutros, 0, nova);
    } else {
      novaLista.push(nova);
    }

    await salvarCategoriasNoBancoELocal(novaLista);
    setNovaCategoriaInput('');
    showNotice(`Categoria "${nova}" adicionada com sucesso!`);
  };

  const handleStartRenameCategoria = (cat) => {
    setEditandoCategoriaOriginal(cat);
    setEditandoCategoriaNovoNome(cat);
  };

  const handleSaveRenameCategoria = async (catOriginal) => {
    const novoNome = editandoCategoriaNovoNome.trim();
    if (!novoNome) return;
    if (novoNome === catOriginal) {
      setEditandoCategoriaOriginal(null);
      return;
    }

    const novaLista = categoriasDespesa.map((c) =>
      c === catOriginal ? novoNome : c
    );
    await salvarCategoriasNoBancoELocal(novaLista);

    // Se marcado, atualiza os itens de notas e lançamentos que usavam o nome antigo da categoria
    if (atualizarHistoricoAoRenomear && supabase) {
      try {
        const itensParaAtualizar = itensNota.filter(
          (i) => i.categoria_item === catOriginal
        );
        for (const item of itensParaAtualizar) {
          await supabase
            .from('itens_nota')
            .update({
              categoria_item: encodeCategoriaComGarantia(
                novoNome,
                item.garantia_meses
              ),
            })
            .eq('id', item.id);
        }

        await supabase
          .from('transacoes')
          .update({ categoria: novoNome })
          .eq('categoria', catOriginal);

        await fetchAllData();
      } catch (err) {
        console.error('Erro ao atualizar histórico da categoria renomeada:', err);
      }
    }

    setEditandoCategoriaOriginal(null);
    setEditandoCategoriaNovoNome('');
    showNotice(
      `Categoria "${catOriginal}" renomeada para "${novoNome}"${
        atualizarHistoricoAoRenomear ? ' e histórico atualizado!' : '!'
      }`
    );
  };

  const handleDeleteCategoria = async (catParaExcluir) => {
    const protegidas = [
      'Alimentação & Supermercado',
      'Saúde & Farmácia',
      'Outros',
    ];
    if (protegidas.includes(catParaExcluir)) {
      return showNotice(
        `A categoria "${catParaExcluir}" é base do sistema (você pode renomear ou criar outras, mas não removê-la).`,
        'error'
      );
    }

    const novaLista = categoriasDespesa.filter((c) => c !== catParaExcluir);
    await salvarCategoriasNoBancoELocal(novaLista);

    // Reatribui itens/lançamentos que estavam nessa categoria para "Outros"
    if (supabase) {
      try {
        const itensAfetados = itensNota.filter(
          (i) => i.categoria_item === catParaExcluir
        );
        for (const item of itensAfetados) {
          await supabase
            .from('itens_nota')
            .update({
              categoria_item: encodeCategoriaComGarantia(
                'Outros',
                item.garantia_meses
              ),
            })
            .eq('id', item.id);
        }
        await supabase
          .from('transacoes')
          .update({ categoria: 'Outros' })
          .eq('categoria', catParaExcluir);
        await fetchAllData();
      } catch (err) {
        console.error('Erro ao reatribuir itens da categoria excluída:', err);
      }
    }

    showNotice(`Categoria "${catParaExcluir}" removida!`);
  };

  const handleMoveCategoria = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categoriasDespesa.length) return;
    const novaLista = [...categoriasDespesa];
    const [movida] = novaLista.splice(index, 1);
    novaLista.splice(targetIndex, 0, movida);
    await salvarCategoriasNoBancoELocal(novaLista);
  };

  const handleRestoreDefaultCategorias = async () => {
    const combinada = Array.from(
      new Set([...CATEGORIAS_PADRAO, ...categoriasDespesa])
    );
    await salvarCategoriasNoBancoELocal(combinada);
    showNotice('Categorias padrão (incluindo Pets) restauradas!');
  };

  // Resumo estatístico de cada categoria (quantos itens de nota, quantos lançamentos e valor total gasto)
  const resumoUsoCategorias = useMemo(() => {
    const mapa = new Map();
    for (const cat of categoriasDespesa) {
      mapa.set(cat, {
        categoria: cat,
        qtdItensNota: 0,
        qtdTransacoes: 0,
        valorTotalItens: 0,
      });
    }

    for (const it of itensNota) {
      const cat = it.categoria_item || 'Outros';
      if (!mapa.has(cat)) {
        mapa.set(cat, {
          categoria: cat,
          qtdItensNota: 0,
          qtdTransacoes: 0,
          valorTotalItens: 0,
        });
      }
      const entry = mapa.get(cat);
      entry.qtdItensNota += 1;
      entry.valorTotalItens += Number(it.valor_total) || 0;
    }

    for (const t of transacoes) {
      const cat = t.categoria || 'Outros';
      if (!mapa.has(cat)) {
        mapa.set(cat, {
          categoria: cat,
          qtdItensNota: 0,
          qtdTransacoes: 0,
          valorTotalItens: 0,
        });
      }
      mapa.get(cat).qtdTransacoes += 1;
    }

    return Array.from(mapa.values());
  }, [categoriasDespesa, itensNota, transacoes]);

  // ==========================================
  // NAVEGAÇÃO PRINCIPAL:
  // Resumo, Notas, Supermercado, Farmácia, Demais Itens, Busca, Estatísticas e Categorias
  // ==========================================
  const navItems = [
    { id: 'resumo', label: 'Resumo', icon: PieChart },
    { id: 'notas', label: 'Notas', icon: Receipt },
    { id: 'lista', label: 'Supermercado', icon: ShoppingCart },
    { id: 'farmacia', label: 'Farmácia', icon: HeartPulse },
    { id: 'demais', label: 'Demais Itens', icon: Package },
    { id: 'busca', label: 'Busca', icon: Search },
    { id: 'estatisticas', label: 'Estatísticas', icon: BarChart3 },
    { id: 'categorias', label: 'Categorias', icon: Tags },
  ];

  // Itens para a aba "Demais Itens" (tudo que não é Supermercado nem Farmácia, ou filtrado)
  const itensDemaisCategorias = useMemo(() => {
    const q = demaisSearchQuery.trim().toLowerCase();
    return itensEnriquecidos.filter((it) => {
      const cat = it.categoria_item || 'Outros';
      if (demaisCategoryFilter === 'TODAS_DEMAIS') {
        if (
          cat === 'Alimentação & Supermercado' ||
          cat === 'Saúde & Farmácia'
        ) {
          return false;
        }
      } else if (demaisCategoryFilter !== 'TODAS_GERAL') {
        if (cat !== demaisCategoryFilter) return false;
      }

      if (!q) return true;
      return (
        String(it.descricao_item || '').toLowerCase().includes(q) ||
        String(it.estabelecimento || '').toLowerCase().includes(q) ||
        String(cat).toLowerCase().includes(q)
      );
    });
  }, [itensEnriquecidos, demaisCategoryFilter, demaisSearchQuery]);

  const totalDemaisItens = useMemo(
    () =>
      itensDemaisCategorias.reduce(
        (acc, it) => acc + (Number(it.valor_total) || 0),
        0
      ),
    [itensDemaisCategorias]
  );

  return (
    <div
      className={`min-h-screen bg-slate-50 flex flex-col md:flex-row pb-24 md:pb-0 transition-colors ${
        darkMode ? 'dark-theme' : ''
      }`}
    >
      {/* TOAST DE NOTIFICAÇÃO */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 text-white">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <img
            src="./icon-192.png"
            alt="Super&Farma IAZ"
            className="w-11 h-11 rounded-xl object-cover shadow-md border border-emerald-400/30 shrink-0"
          />
          <div>
            <h1 className="font-bold text-lg leading-tight">Super&amp;Farma IAZ</h1>
            <p className="text-xs text-slate-400">Supermercado, Farmácia &amp; IA</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Tema Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Tema Escuro</span>
              </>
            )}
          </button>

          <a
            href={APK_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Baixar APK Android</span>
          </a>

          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Super&amp;Farma IAZ • Android</span>
            <button
              onClick={fetchAllData}
              title="Sincronizar dados"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 md:pl-64">
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
          {/* BARRA SUPERIOR MOBILE COM ÍCONE, TEMA E BOTÃO APK */}
          <div className="flex md:hidden items-center justify-between bg-slate-900 text-white p-3.5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2.5">
              <img
                src="./icon-192.png"
                alt="Super&Farma IAZ"
                className="w-9 h-9 rounded-xl object-cover border border-emerald-400/30"
              />
              <div>
                <h1 className="font-bold text-sm leading-tight">Super&amp;Farma IAZ</h1>
                <p className="text-[11px] text-slate-400">Mercado, Farmácia &amp; Notas IA</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title={darkMode ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-300" />
                )}
              </button>
              <a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>APK</span>
              </a>
            </div>
          </div>

          {/* CABEÇALHO SIMPLES DA TELA ATUAL */}
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {navItems.find((i) => i.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-slate-500">
                Super&amp;Farma IAZ — Notas fiscais, garantias, listas inteligentes e despesas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Tema Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span>Tema Escuro</span>
                  </>
                )}
              </button>
              <a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Baixar APK Android</span>
              </a>
              <button
                onClick={fetchAllData}
                className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600"
                title="Atualizar dados"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </header>

          {/* ==========================================
              ABA 1 (INICIAL): RESUMO DO MÊS
          ========================================== */}
          {activeTab === 'resumo' && (
            <div className="space-y-6">
              {/* CONTROLE DO CALENDÁRIO */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    Período Selecionado
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-2 capitalize">
                    {formatMonthLabel(selectedMonth)}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                    title="Mês anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="text-sm font-semibold text-slate-800 focus:outline-none bg-transparent"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                    title="Próximo mês"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CARDS PRINCIPAIS DO RESUMO DO MÊS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Valor Pago com Notas Fiscais ({selectedMonth})
                    </span>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {formatCurrency(resumoMensal.totalNotasMes)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                      <span>
                        Total Bruto:{' '}
                        <strong>{formatCurrency(resumoMensal.totalBrutoNotasMes)}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-emerald-600 font-semibold">
                        Descontos: - {formatCurrency(resumoMensal.totalDescontoNotasMes)}
                      </span>
                      <span>•</span>
                      <span>{resumoMensal.qtdNotasMes} nota(s)</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total Geral Pago no Mês
                    </span>
                    <p className="text-3xl font-bold text-rose-600 mt-2">
                      {formatCurrency(resumoMensal.totalCategorizado)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Soma líquida (com descontos abatidos) de todas as categorias
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <PieChart className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* GASTO POR CATEGORIA DE GASTO */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Gasto por Categoria ({formatMonthLabel(selectedMonth)})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Distribuição dos seus gastos por categoria no mês selecionado
                    </p>
                  </div>
                </div>

                {resumoMensal.gastosPorCategoria.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                    Nenhum gasto ou nota fiscal registrada em {selectedMonth}.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {resumoMensal.gastosPorCategoria.map((item) => (
                      <div key={item.categoria} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-800">
                            {item.categoria}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-400">
                              {item.percentual.toFixed(1)}%
                            </span>
                            <span className="font-bold text-slate-900">
                              {formatCurrency(item.valor)}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* NOTAS FISCAIS DO MÊS SELECIONADO */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Notas Fiscais de {formatMonthLabel(selectedMonth)} ({notasDoMes.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('notas')}
                    className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
                  >
                    + Escanear nova nota
                  </button>
                </div>

                {notasDoMes.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Nenhuma nota fiscal emitida neste mês.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notasDoMes.map((nf) => {
                      const vals = calcularValoresNota(nf);
                      return (
                        <div
                          key={nf.id}
                          className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50"
                        >
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">
                              {nf.estabelecimento}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDateBR(nf.data_emissao)} • {nf.forma_pagamento || 'PIX'}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="flex flex-wrap sm:justify-end items-center gap-2 text-xs text-slate-500">
                              <span>
                                Total: <strong>{formatCurrency(vals.valorTotalBruto)}</strong>
                              </span>
                              <span>•</span>
                              <span className="text-emerald-600 font-medium">
                                Desconto: - {formatCurrency(vals.desconto)}
                              </span>
                            </div>
                            <p className="font-bold text-slate-900 text-sm mt-0.5">
                              Valor Pago: {formatCurrency(vals.valorPago)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              ABA 2: LEITURA E GESTÃO DE NOTAS FISCAIS + GARANTIAS
          ========================================== */}
          {activeTab === 'notas' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>OCR Inteligente com Gemini 3.8 Flash</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Escanear Nota ou Cupom Fiscal (Mercado, Farmácia & Eletrônicos)
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Tire uma foto ou escolha um arquivo. Para eletrônicos, defina o tempo de garantia em meses para acompanhar o vencimento.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs cursor-pointer transition">
                      {ocrLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Processando IA...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          <span>Tirar Foto</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        disabled={ocrLoading}
                        className="hidden"
                      />
                    </label>

                    <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-xs cursor-pointer transition">
                      {ocrLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Aguarde...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span>Escolher Arquivo / Galeria</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf,.xml,text/xml,application/xml"
                        onChange={handleFileUpload}
                        disabled={ocrLoading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* ==========================================
                    SEÇÃO DE IMPORTAÇÃO POR QR CODE OU CHAVE DE ACESSO (44 DÍGITOS)
                ========================================== */}
                <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full mb-1.5">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Leitor de QR Code & Decodificador de Chave de Acesso (44 dígitos)</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900">
                          Importar Nota Fiscal via QR Code ou Chave de Acesso SEFAZ
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Escaneie o QR Code da nota ou digite/cole os 44 dígitos da Chave de Acesso. O sistema extrai automaticamente o <strong>Ano e Mês real da compra</strong> (dígitos 3 a 6 da chave), o <strong>CNPJ</strong> e consulta a loja na Receita Federal!
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!qrCameraActive ? (
                          <button
                            type="button"
                            onClick={startQrCamera}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Ler QR Code (Câmera)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopQrCamera}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition"
                          >
                            <X className="w-4 h-4" />
                            <span>Fechar Câmera QR</span>
                          </button>
                        )}

                        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-semibold text-xs cursor-pointer transition">
                          <Upload className="w-4 h-4" />
                          <span>Ler QR de Imagem</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleQrImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {qrCameraActive && (
                      <div className="bg-slate-900 rounded-xl p-3 flex flex-col items-center justify-center">
                        <video
                          ref={qrVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full max-w-sm rounded-lg overflow-hidden"
                        />
                        <p className="text-xs text-slate-300 mt-2">
                          Aponte a câmera para o QR Code impresso no cupom fiscal...
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-6">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Chave de Acesso (44 dígitos) ou Link/URL do QR Code SEFAZ
                        </label>
                        <div className="relative">
                          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Cole os 44 números da chave ou URL do QR Code..."
                            value={qrChaveInput}
                            onChange={(e) => setQrChaveInput(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-mono text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Dia da Compra (se não vier no QR)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="Ex: 15"
                          value={qrDiaCompra}
                          onChange={(e) => setQrDiaCompra(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Valor Total R$ (Opcional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={qrValorManual}
                          onChange={(e) => setQrValorManual(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800"
                        />
                      </div>
                    </div>

                    {/* PREVIEW AUTOMÁTICO DA CHAVE DECODIFICADA */}
                    {infoQrDecodificada?.valida && (
                      <div className="bg-white rounded-xl border border-emerald-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Chave 44 dígitos identificada!
                          </span>
                          {infoQrDecodificada.uf && (
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">
                              UF: {infoQrDecodificada.uf}
                            </span>
                          )}
                          {infoQrDecodificada.anoMes && (
                            <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-bold">
                              📅 Emissão na Chave: {infoQrDecodificada.anoMes.split('-')[1]}/{infoQrDecodificada.anoMes.split('-')[0]}
                            </span>
                          )}
                          {infoQrDecodificada.cnpjFormatado && (
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono">
                              CNPJ: {infoQrDecodificada.cnpjFormatado}
                            </span>
                          )}
                        </div>

                        {infoQrDecodificada.urlConsultaSefaz && (
                          <a
                            href={infoQrDecodificada.urlConsultaSefaz}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Abrir Portal SEFAZ ({infoQrDecodificada.uf || 'NFC-e'})</span>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Texto Copiado da Consulta SEFAZ (Opcional — cole aqui os itens da página da SEFAZ para extrair tudo sem foto)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Dica: se abrir a nota no site da SEFAZ, você pode copiar o texto da tela e colar aqui para a IA extrair todos os itens e a data exata!"
                          value={qrTextoSefaz}
                          onChange={(e) => setQrTextoSefaz(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleImportarPorChaveOuQrCode}
                        disabled={qrLoading || (!qrChaveInput.trim() && !qrTextoSefaz.trim())}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs shadow-xs cursor-pointer transition shrink-0"
                      >
                        {qrLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Consultando Chave...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <span>Carregar Dados da Chave / QR Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ==========================================
                    SEÇÃO DE IMPORTAÇÃO DE NOTAS FISCAIS EM LOTE (50+ ARQUIVOS)
                ========================================== */}
                <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
                  <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full mb-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            Super-Lote Anti-Bloqueio 429 (6 notas/chamada • Modelo ativo:{' '}
                            {activeGeminiModel})
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900">
                          Importar Múltiplas Notas Fiscais de Uma Vez (Ex: 50+ Notas)
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Preserva automaticamente a data real da compra (lendo o texto da nota, o Ano/Mês da Chave de 44 dígitos ou a data do arquivo) e alterna entre 6 modelos Gemini.
                        </p>
                      </div>

                      <label
                        className={`inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm shadow-sm transition shrink-0 ${
                          batchProcessing
                            ? 'bg-indigo-400 text-white cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                        }`}
                      >
                        {batchProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>
                              Importando ({batchSummary.concluidos}/{batchSummary.total})...
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5" />
                            <span>Selecionar Notas em Lote (Múltiplos Arquivos)</span>
                          </>
                        )}
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf,.xml,text/xml,application/xml"
                          onChange={handleBatchFilesUpload}
                          disabled={batchProcessing}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* OPÇÕES DO LOTE */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-indigo-200/60">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Categoria das Notas do Lote
                        </label>
                        <select
                          value={batchCategoryOverride}
                          onChange={(e) => setBatchCategoryOverride(e.target.value)}
                          disabled={batchProcessing}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-800"
                        >
                          <option value="AUTO">
                            Detectar Automaticamente via IA (Supermercado / Farmácia / etc.)
                          </option>
                          <option value="Alimentação & Supermercado">
                            Forçar Todas como: Alimentação & Supermercado
                          </option>
                          <option value="Saúde & Farmácia">
                            Forçar Todas como: Saúde & Farmácia
                          </option>
                          {CATEGORIAS_DESPESA.filter(
                            (c) =>
                              c !== 'Alimentação & Supermercado' &&
                              c !== 'Saúde & Farmácia'
                          ).map((cat) => (
                            <option key={cat} value={cat}>
                              Forçar Todas como: {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Data Fixa p/ Lote (Opcional - caso print não mostre data)
                        </label>
                        <input
                          type="date"
                          value={batchDateOverride}
                          onChange={(e) => setBatchDateOverride(e.target.value)}
                          disabled={batchProcessing}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl cursor-pointer w-full">
                          <input
                            type="checkbox"
                            checked={batchSkipDuplicates}
                            onChange={(e) => setBatchSkipDuplicates(e.target.checked)}
                            disabled={batchProcessing}
                            className="rounded text-indigo-600"
                          />
                          <span>Ignorar notas duplicadas (mesma chave)</span>
                        </label>
                      </div>
                    </div>

                    {/* PAINEL DE PROGRESSO E FILA DO LOTE */}
                    {batchQueue.length > 0 && (
                      <div className="bg-white rounded-xl border border-indigo-200 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-900">
                              Progresso do Lote: {batchSummary.concluidos} de{' '}
                              {batchSummary.total} arquivo(s) processado(s) (
                              {batchSummary.percentual}%)
                            </p>
                            <p className="text-[11px] text-slate-500">
                              ✅ <strong>{batchSummary.sucesso}</strong> salva(s) • 📦{' '}
                              <strong>{batchSummary.totalItensImportados}</strong> itens
                              extraídos • 💰 Total importado:{' '}
                              <strong>
                                {formatCurrency(batchSummary.valorTotalImportado)}
                              </strong>
                              {batchSummary.duplicadas > 0 &&
                                ` • ⚠️ ${batchSummary.duplicadas} duplicada(s)`}
                              {batchSummary.erro > 0 &&
                                ` • ❌ ${batchSummary.erro} com erro`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {batchSummary.erro > 0 && !batchProcessing && (
                              <button
                                type="button"
                                onClick={handleRetryFailedBatch}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Reprocessar Falhas ({batchSummary.erro})</span>
                              </button>
                            )}
                            {!batchProcessing && (
                              <button
                                type="button"
                                onClick={() => setBatchQueue([])}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                Limpar Fila
                              </button>
                            )}
                          </div>
                        </div>

                        {/* BARRA DE PROGRESSO */}
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                            style={{ width: `${batchSummary.percentual}%` }}
                          />
                        </div>

                        {/* LISTA DE ARQUIVOS DO LOTE */}
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                          {batchQueue.map((item, idx) => (
                            <div
                              key={item.id}
                              className="p-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-slate-400 font-mono text-[11px] w-6 shrink-0">
                                  #{idx + 1}
                                </span>
                                {item.status === 'PROCESSANDO' && (
                                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                                )}
                                {item.status === 'SUCESSO' && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                                {item.status === 'DUPLICADA' && (
                                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                )}
                                {item.status === 'ERRO' && (
                                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                )}
                                {item.status === 'PENDENTE' && (
                                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">
                                    {item.fileName}{' '}
                                    <span className="font-normal text-slate-400">
                                      ({item.fileSizeKB} KB)
                                    </span>
                                  </p>
                                  {item.status === 'SUCESSO' && (
                                    <p className="text-[11px] text-emerald-700 truncate">
                                      {item.estabelecimento} •{' '}
                                      {formatDateBR(item.data_emissao)} •{' '}
                                      <strong>{formatCurrency(item.valor_total)}</strong> •{' '}
                                      {item.qtd_itens} itens • {item.categoria}
                                    </p>
                                  )}
                                  {item.status === 'DUPLICADA' && (
                                    <p className="text-[11px] text-amber-700 truncate">
                                      Nota já existente no banco ({item.estabelecimento}) — ignorada
                                    </p>
                                  )}
                                  {item.status === 'ERRO' && (
                                    <p className="text-[11px] text-rose-600 truncate">
                                      Erro: {item.errorMsg}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 self-start sm:self-center ${
                                  item.status === 'SUCESSO'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : item.status === 'PROCESSANDO'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : item.status === 'DUPLICADA'
                                    ? 'bg-amber-50 text-amber-700'
                                    : item.status === 'ERRO'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {extractedNota && (
                  <form
                    onSubmit={handleConfirmAndSaveNota}
                    className="mt-6 pt-6 border-t border-slate-200 space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>
                          {extractedNota.id
                            ? `Editando Nota Fiscal: ${extractedNota.estabelecimento}`
                            : 'Revisão dos Dados Extraídos'}
                        </span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setExtractedNota(null);
                          setPreviewImage(null);
                        }}
                        className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1 flex flex-col gap-2">
                        {previewImage ? (
                          <img
                            src={previewImage}
                            alt="Cupom Fiscal"
                            className="w-full max-h-64 object-contain rounded-xl border border-slate-200 bg-slate-50"
                          />
                        ) : (
                          <div className="w-full h-44 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-xs text-slate-400 p-4 text-center">
                            <FileText className="w-6 h-6 mb-1 text-slate-300" />
                            <span>Nenhum comprovante anexado</span>
                          </div>
                        )}
                        <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {previewImage
                              ? 'Trocar Imagem / PDF da Nota'
                              : 'Anexar Imagem / PDF da Nota'}
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleAttachComprovanteOnly}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Estabelecimento / Loja
                          </label>
                          <input
                            type="text"
                            required
                            value={extractedNota.estabelecimento}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                estabelecimento: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            CNPJ
                          </label>
                          <input
                            type="text"
                            value={extractedNota.cnpj}
                            onChange={(e) =>
                              setExtractedNota({ ...extractedNota, cnpj: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Data de Emissão (Início da Garantia)
                          </label>
                          <input
                            type="date"
                            required
                            value={extractedNota.data_emissao}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                data_emissao: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Forma de Pagamento
                          </label>
                          <select
                            value={extractedNota.forma_pagamento}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                forma_pagamento: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                          >
                            {FORMAS_PAGAMENTO.map((fp) => (
                              <option key={fp} value={fp}>
                                {fp}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Valor Total Bruto (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={extractedNota.valor_total}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                valor_total: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Desconto (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={extractedNota.desconto}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                desconto: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                          />
                        </div>

                        <div className="sm:col-span-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-slate-700">
                            Valor Total: <strong>{formatCurrency(extractedNota.valor_total)}</strong> • Desconto:{' '}
                            <strong className="text-emerald-700">
                              - {formatCurrency(extractedNota.desconto)}
                            </strong>
                          </span>
                          <span className="font-bold text-emerald-800 text-sm">
                            Valor Pago (Total - Desconto):{' '}
                            {formatCurrency(calcularValoresNota(extractedNota).valorPago)}
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Categoria do Lançamento
                          </label>
                          <select
                            value={extractedNota.categoria_geral}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                categoria_geral: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                          >
                            {CATEGORIAS_DESPESA.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Chave de Acesso (44 dígitos - Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="44 números da nota..."
                            value={extractedNota.chave_acesso || ''}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                chave_acesso: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Itens da Nota & Garantia em Meses ({extractedNota.itens.length})
                        </h5>
                        <button
                          type="button"
                          onClick={handleAddItemNota}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar Item</span>
                        </button>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-2 min-w-[160px]">Item</th>
                              <th className="py-2.5 px-2 w-18">Qtd</th>
                              <th className="py-2.5 px-2 w-16">Unid</th>
                              <th className="py-2.5 px-2 w-24">V. Unit</th>
                              <th className="py-2.5 px-2 w-24">Total</th>
                              <th className="py-2.5 px-2 w-32">Garantia (meses)</th>
                              <th className="py-2.5 px-2 min-w-[150px]">Categoria</th>
                              <th className="py-2.5 px-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {extractedNota.itens.map((it, idx) => (
                              <tr key={idx}>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={it.descricao_item}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'descricao_item', e.target.value)
                                    }
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-slate-800 font-medium"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={it.quantidade}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'quantidade', e.target.value)
                                    }
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-slate-700"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={it.unidade}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'unidade', e.target.value)
                                    }
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-slate-700"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={it.valor_unitario}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'valor_unitario', e.target.value)
                                    }
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-slate-700"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={it.valor_total}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'valor_total', e.target.value)
                                    }
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 font-semibold text-slate-900"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="120"
                                      placeholder="0"
                                      value={it.garantia_meses ?? 0}
                                      onChange={(e) =>
                                        handleItemChange(
                                          idx,
                                          'garantia_meses',
                                          e.target.value
                                        )
                                      }
                                      className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-slate-800 font-semibold"
                                    />
                                    <span className="text-[11px] text-slate-400">m</span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-2">
                                  <select
                                    value={it.categoria_item}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'categoria_item', e.target.value)
                                    }
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700"
                                  >
                                    {CATEGORIAS_DESPESA.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItemNota(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                    title="Remover item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={ocrLoading}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {extractedNota.id
                            ? 'Salvar Alterações da Nota'
                            : 'Confirmar e Gerar Pagamento no Mês'}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {itensEnriquecidos.some((i) => Number(i.garantia_meses) > 0) && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <span>Controle de Garantia de Eletrônicos e Produtos</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {itensEnriquecidos
                      .filter((i) => Number(i.garantia_meses) > 0)
                      .map((item) => {
                        const g = item.garantiaInfo;
                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
                              g?.expirada
                                ? 'bg-rose-50/60 border-rose-200'
                                : 'bg-slate-50/70 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900 text-sm">
                                  {item.descricao_item}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Comprado em {formatDateBR(item.data_compra)} •{' '}
                                  {item.estabelecimento} • {formatCurrency(item.valor_total)}
                                </p>
                              </div>
                              {g?.expirada ? (
                                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                              ) : (
                                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                              )}
                            </div>

                            {g && (
                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                                <span
                                  className={
                                    g.expirada
                                      ? 'font-bold text-rose-600'
                                      : 'font-semibold text-emerald-700'
                                  }
                                >
                                  {g.texto}
                                </span>
                                <span className="text-slate-500">{g.detalhe}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Histórico de Notas e Cupons Fiscais ({notasFiscais.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Você pode alterar a data de compra diretamente em cada nota ou selecionar várias notas abaixo para ajustar o mês/data em lote.
                    </p>
                  </div>

                  {/* BARRA DE AJUSTE RÁPIDO DE DATA EM LOTE */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedNotasIds.length === notasFiscais.length) {
                          setSelectedNotasIds([]);
                        } else {
                          setSelectedNotasIds(notasFiscais.map((n) => n.id));
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      {selectedNotasIds.length === notasFiscais.length && notasFiscais.length > 0
                        ? 'Desmarcar Todas'
                        : `Selecionar Todas (${selectedNotasIds.length})`}
                    </button>

                    <input
                      type="date"
                      value={bulkNewDate}
                      onChange={(e) => setBulkNewDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                    />

                    <button
                      type="button"
                      disabled={loading || selectedNotasIds.length === 0 || !bulkNewDate}
                      onClick={handleBulkUpdateNotasDate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer transition"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5" />
                      )}
                      <span>Aplicar Data ({selectedNotasIds.length})</span>
                    </button>
                  </div>
                </div>

                {notasFiscais.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    Nenhuma nota fiscal escaneada até o momento.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notasFiscais.map((nf) => {
                      const itensDaNota = itensNota.filter((i) => i.nota_id === nf.id);
                      const isExpanded = expandedNotaId === nf.id;
                      const isSelected = selectedNotasIds.includes(nf.id);

                      return (
                        <div key={nf.id} className="p-4 sm:px-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedNotasIds((prev) => [...prev, nf.id]);
                                  } else {
                                    setSelectedNotasIds((prev) =>
                                      prev.filter((id) => id !== nf.id)
                                    );
                                  }
                                }}
                                className="mt-3 w-4 h-4 rounded text-indigo-600 cursor-pointer shrink-0"
                                title="Selecionar nota para alterar data em lote"
                              />
                              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 mt-0.5">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 text-sm">
                                  {nf.estabelecimento}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                  {nf.cnpj && <span>CNPJ: {nf.cnpj}</span>}
                                  <span>
                                    • Emissão:{' '}
                                    <strong className="text-slate-700">
                                      {formatDateBR(nf.data_emissao)}
                                    </strong>
                                  </span>
                                  <span>• {nf.forma_pagamento || 'PIX'}</span>
                                  <span>• {itensDaNota.length} item(ns)</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {itensDaNota
                                    .filter((i) => Number(i.garantia_meses) > 0)
                                    .map((i) => {
                                      const g = calcularStatusGarantia(
                                        nf.data_emissao,
                                        i.garantia_meses
                                      );
                                      if (!g) return null;
                                      return (
                                        <span
                                          key={i.id}
                                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                                            g.expirada
                                              ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold'
                                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium'
                                          }`}
                                        >
                                          {i.descricao_item}: {g.texto}
                                        </span>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2">
                              {(() => {
                                const vals = calcularValoresNota(nf);
                                return (
                                  <div className="text-right mr-1">
                                    <div className="flex flex-wrap justify-end items-center gap-1.5 text-[11px] text-slate-500">
                                      <span>
                                        Total: <strong>{formatCurrency(vals.valorTotalBruto)}</strong>
                                      </span>
                                      <span>•</span>
                                      <span className="text-emerald-600 font-medium">
                                        Desconto: - {formatCurrency(vals.desconto)}
                                      </span>
                                    </div>
                                    <p className="font-bold text-slate-900 text-sm">
                                      Valor Pago: {formatCurrency(vals.valorPago)}
                                    </p>
                                  </div>
                                );
                              })()}

                              {nf.url_comprovante && (
                                <button
                                  onClick={() => setViewingComprovante(nf)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                                  title="Visualizar imagem/documento da nota fiscal"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Ver Nota</span>
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  setExpandedNotaId(isExpanded ? null : nf.id)
                                }
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Ver itens da nota"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>

                              <button
                                onClick={() => handleEditNota(nf)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Editar dados, itens e garantia da nota fiscal"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteNota(nf)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Excluir nota e lançamento"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && itensDaNota.length > 0 && (
                            <div className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-200/70 overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="text-slate-500 border-b border-slate-200">
                                  <tr>
                                    <th className="py-1.5 px-2">Descrição</th>
                                    <th className="py-1.5 px-2">Qtd</th>
                                    <th className="py-1.5 px-2">Unitário</th>
                                    <th className="py-1.5 px-2">Total</th>
                                    <th className="py-1.5 px-2">Garantia</th>
                                    <th className="py-1.5 px-2">Categoria</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/50">
                                  {itensDaNota.map((item) => {
                                    const g = calcularStatusGarantia(
                                      nf.data_emissao,
                                      item.garantia_meses
                                    );
                                    return (
                                      <tr key={item.id}>
                                        <td className="py-1.5 px-2 font-medium text-slate-800">
                                          {item.descricao_item}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-600">
                                          {item.quantidade} {item.unidade}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-600">
                                          {formatCurrency(item.valor_unitario)}
                                        </td>
                                        <td className="py-1.5 px-2 font-semibold text-slate-900">
                                          {formatCurrency(item.valor_total)}
                                        </td>
                                        <td className="py-1.5 px-2">
                                          {g ? (
                                            <span
                                              className={
                                                g.expirada
                                                  ? 'text-rose-600 font-bold'
                                                  : 'text-emerald-700 font-medium'
                                              }
                                            >
                                              {g.texto} ({g.detalhe})
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2">
                                          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-600">
                                            {item.categoria_item}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              ABA 3: BUSCA DE ITENS E HISTÓRICO DE PREÇOS / GARANTIAS
          ========================================== */}
          {activeTab === 'busca' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar qualquer item das notas (ex: Carne, TV, Dipirona, Banana, Loja...)"
                      value={searchItemQuery}
                      onChange={(e) => setSearchItemQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-100 px-3.5 py-2.5 rounded-xl cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={onlyWithWarranty}
                      onChange={(e) => setOnlyWithWarranty(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Apenas itens com garantia</span>
                  </label>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>
                    Exibindo <strong>{resultadosBuscaItens.length}</strong> registro(s) de
                    compra em <strong>ordem decrescente de data</strong>
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                {resultadosBuscaItens.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    Nenhum item encontrado para a busca informada.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {resultadosBuscaItens.map((it) => {
                      const g = it.garantiaInfo;
                      return (
                        <div
                          key={it.id}
                          className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-900 text-sm">
                                {it.descricao_item}
                              </p>
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium">
                                {it.categoria_item}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatDateBR(it.data_compra)}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 text-slate-700">
                                <Store className="w-3.5 h-3.5 text-slate-400" />
                                {it.estabelecimento}
                              </span>
                              <span>
                                • Qtd: {it.quantidade} {it.unidade}
                              </span>
                            </div>

                            {g && (
                              <div className="pt-1">
                                <span
                                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${
                                    g.expirada
                                      ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
                                  }`}
                                >
                                  {g.expirada ? (
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                  ) : (
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  )}
                                  <span>{g.texto}</span>
                                  <span className="font-normal opacity-80">
                                    ({g.detalhe})
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                            <p className="text-xs text-slate-500">
                              Unitário:{' '}
                              <strong className="text-slate-800">
                                {formatCurrency(it.valor_unitario)}
                              </strong>{' '}
                              /{it.unidade}
                            </p>
                            <p className="text-sm font-bold text-emerald-600">
                              Total: {formatCurrency(it.valor_total)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              ABAS 4 & 5: LISTA INTELIGENTE DE SUPERMERCADO OU FARMÁCIA
              (COM IA DE PREVISÃO DE CONSUMO, HISTÓRICO E CONFERÊNCIA DE NOTA FISCAL POR EQUIVALÊNCIA)
          ========================================== */}
          {(activeTab === 'lista' || activeTab === 'farmacia') && (
            <div className="space-y-6">
              {/* BANNER DE IA: PREVISÃO DE LISTA BASEADA NO CONSUMO */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full mb-1.5">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      <span>
                        IA de Análise de Consumo —{' '}
                        {currentListType === 'FARMACIA' ? 'Farmácia' : 'Supermercado'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Previsão Inteligente de Compras ({defaultCategoryForType})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      A IA analisa suas notas fiscais e compras anteriores para prever o que você precisa repor e estimar os preços.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchCategoryOverride('AUTO');
                        setActiveTab('notas');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-semibold cursor-pointer transition"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Importar Notas em Lote (50+)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePredictShoppingListWithAI}
                      disabled={aiListLoading}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer transition shrink-0"
                    >
                      {aiListLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analisando Consumo...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>
                            Prever Lista de{' '}
                            {currentListType === 'FARMACIA' ? 'Farmácia' : 'Supermercado'} com IA
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {currentMeta.analise_ia && (
                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-indigo-800">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Análise do seu Hábito de Consumo pela IA:</span>
                    </p>
                    <p className="leading-relaxed">{currentMeta.analise_ia}</p>
                  </div>
                )}
              </div>

              {/* RESUMO DA PRÉVIA DA LISTA DE COMPRAS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Prévia Total das Compras
                  </span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(resumoListaCompras.totalPrevisto)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentShoppingList.length} item(ns) na lista
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-700">
                    Já no Carrinho / Comprados
                  </span>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {formatCurrency(resumoListaCompras.totalNoCarrinho)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentShoppingList.filter((i) => i.checked).length} item(ns) marcados
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-medium uppercase tracking-wider text-amber-700">
                    Falta Pegar
                  </span>
                  <p className="text-2xl font-bold text-amber-600 mt-1">
                    {formatCurrency(resumoListaCompras.faltaPegar)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentShoppingList.filter((i) => !i.checked).length} item(ns) pendentes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* CATÁLOGO DE ITENS JÁ CADASTRADOS NAS NOTAS */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 self-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Itens Cadastrados nas Notas ({catalogoProdutos.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Inicia filtrando por{' '}
                      <strong>
                        {currentListType === 'FARMACIA'
                          ? 'Saúde & Farmácia'
                          : 'Alimentação & Supermercado'}
                      </strong>
                      , com opção de selecionar outras categorias
                    </p>
                  </div>

                  {/* FILTRO DE CATEGORIA + BUSCA POR TEXTO */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={catalogCategoryFilter}
                        onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50 text-slate-800"
                      >
                        <option value={defaultCategoryForType}>
                          Somente {defaultCategoryForType}
                        </option>
                        <option value="TODAS">
                          Todas as Categorias (Incluir Outros Itens)
                        </option>
                        {CATEGORIAS_DESPESA.filter(
                          (c) => c !== defaultCategoryForType
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            Categoria: {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar produto pelo nome..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                    {catalogoProdutos.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Nenhum item encontrado nesta categoria.
                      </div>
                    ) : (
                      catalogoProdutos.map((prod) => (
                        <div
                          key={prod.chave}
                          className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate">
                              {prod.descricao_item}
                            </p>
                            <p className="text-[11px] text-slate-600 truncate">
                              Preço Médio:{' '}
                              <strong className="text-emerald-700">
                                {formatCurrency(prod.preco_medio)}
                              </strong>{' '}
                              /{prod.unidade} • Qtd Média:{' '}
                              <strong>
                                {prod.quantidade_media} {prod.unidade}
                              </strong>
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              Comprado {prod.vezes_comprado}x ({prod.frequencia_texto}) • Últ:{' '}
                              {formatDateBR(prod.ultima_data)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addFromCatalogToShoppingList(prod)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
                            title="Adicionar com Preço Médio e Quantidade Média"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Lista</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* ADICIONAR ITEM AVULSO MANUAL */}
                  <form
                    onSubmit={handleAddCustomShoppingItem}
                    className="pt-3 border-t border-slate-100 space-y-2.5"
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      Ou adicione um item avulso manualmente:
                    </p>
                    <input
                      type="text"
                      placeholder={
                        currentListType === 'FARMACIA'
                          ? 'Ex: Dipirona 500mg, Vitamina C...'
                          : 'Ex: Arroz 5kg, Leite Integral...'
                      }
                      value={customListItem.descricao_item}
                      onChange={(e) =>
                        setCustomListItem({
                          ...customListItem,
                          descricao_item: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Qtd"
                        value={customListItem.quantidade}
                        onChange={(e) =>
                          setCustomListItem({
                            ...customListItem,
                            quantidade: e.target.value,
                          })
                        }
                        className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Unid (un, kg)"
                        value={customListItem.unidade}
                        onChange={(e) =>
                          setCustomListItem({
                            ...customListItem,
                            unidade: e.target.value,
                          })
                        }
                        className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$ Unit."
                        value={customListItem.valor_unitario}
                        onChange={(e) =>
                          setCustomListItem({
                            ...customListItem,
                            valor_unitario: e.target.value,
                          })
                        }
                        className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      + Adicionar Item Avulso
                    </button>
                  </form>
                </div>

                {/* MINHA LISTA ATUAL + SALVAR NO HISTÓRICO + CONFERÊNCIA COM NOTA FISCAL */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <input
                          type="text"
                          placeholder={`Título da Lista de ${
                            currentListType === 'FARMACIA' ? 'Farmácia' : 'Supermercado'
                          } (ex: Compras do Mês)...`}
                          value={currentMeta.titulo}
                          onChange={(e) => updateCurrentMeta({ titulo: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                        />

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveListToHistory()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar no Histórico</span>
                          </button>

                          {currentShoppingList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentShoppingList([]);
                                updateCurrentMeta({
                                  id: null,
                                  titulo: '',
                                  analise_ia: '',
                                  conferencia: null,
                                });
                              }}
                              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              Nova / Limpar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {currentShoppingList.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 text-sm">
                        Sua lista está vazia. Use o botão <strong>Prever Lista com IA</strong> ou selecione produtos ao lado!
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {currentShoppingList.map((item) => {
                          const subtotal =
                            (Number(item.quantidade) || 0) *
                            (Number(item.valor_unitario) || 0);
                          return (
                            <div
                              key={item.id}
                              className={`p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                item.checked ? 'bg-emerald-50/40' : ''
                              }`}
                            >
                              <label className="flex items-start gap-3 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={(e) =>
                                    updateShoppingItem(
                                      item.id,
                                      'checked',
                                      e.target.checked
                                    )
                                  }
                                  className="mt-1 rounded text-emerald-600"
                                />
                                <div>
                                  <p
                                    className={`font-semibold text-sm ${
                                      item.checked
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-900'
                                    }`}
                                  >
                                    {item.descricao_item}
                                  </p>
                                  {item.estabelecimento_ref && (
                                    <p className="text-[11px] text-slate-400">
                                      {item.estabelecimento_ref}
                                    </p>
                                  )}
                                </div>
                              </label>

                              <div className="flex items-center justify-between sm:justify-end gap-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.quantidade}
                                    onChange={(e) =>
                                      updateShoppingItem(
                                        item.id,
                                        'quantidade',
                                        e.target.value
                                      )
                                    }
                                    className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center font-medium"
                                  />
                                  <span className="text-xs text-slate-500">
                                    {item.unidade}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-slate-400">× R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.valor_unitario}
                                    onChange={(e) =>
                                      updateShoppingItem(
                                        item.id,
                                        'valor_unitario',
                                        e.target.value
                                      )
                                    }
                                    className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-medium"
                                  />
                                </div>

                                <div className="w-24 text-right font-bold text-slate-900 text-xs">
                                  {formatCurrency(subtotal)}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeShoppingItem(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* CONFERÊNCIA FINAL COM NOTA FISCAL (EQUIVALÊNCIA SEMÂNTICA IA) */}
                    {currentShoppingList.length > 0 && (
                      <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <CheckCheck className="w-4 h-4 text-emerald-600" />
                            <span>
                              Finalizar e Conferir Lista com a Nota Fiscal da Compra (IA)
                            </span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Envie a foto/arquivo da nota fiscal ou selecione uma nota já salva. A IA reconhece itens equivalentes mesmo com nomes diferentes!
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <label className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-2xs">
                            {aiListLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Camera className="w-4 h-4" />
                            )}
                            <span>Fotografar Nota e Conferir</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleVerifyListWithUploadedNota}
                              disabled={aiListLoading}
                              className="hidden"
                            />
                          </label>

                          <label className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shadow-2xs">
                            {aiListLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span>Escolher Arquivo da Nota e Conferir</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleVerifyListWithUploadedNota}
                              disabled={aiListLoading}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {notasFiscais.length > 0 && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-200/80">
                            <select
                              value={selectedExistingNotaId}
                              onChange={(e) => setSelectedExistingNotaId(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                            >
                              <option value="">
                                Ou selecione uma Nota Fiscal já cadastrada para conferir...
                              </option>
                              {notasFiscais.map((nf) => (
                                <option key={nf.id} value={nf.id}>
                                  {formatDateBR(nf.data_emissao)} - {nf.estabelecimento} (
                                  {formatCurrency(nf.valor_total)})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleVerifyListWithExistingNota}
                              disabled={aiListLoading || !selectedExistingNotaId}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                            >
                              Conferir com esta Nota
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* RESULTADO DA CONFERÊNCIA POR EQUIVALÊNCIA DA LISTA ATUAL */}
                  {currentMeta.conferencia && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Relatório de Conferência IA
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm mt-1">
                            Nota: {currentMeta.conferencia.estabelecimento} (
                            {formatDateBR(currentMeta.conferencia.data_nota)}) — Total Pago:{' '}
                            {formatCurrency(currentMeta.conferencia.valor_total_nota)}
                          </h4>
                        </div>
                      </div>

                      {currentMeta.conferencia.insight_consumo && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                          <strong>Análise da Compra:</strong>{' '}
                          {currentMeta.conferencia.insight_consumo}
                        </div>
                      )}

                      {/* 1. ITENS DA LISTA QUE FORAM COMPRADOS (EQUIVALENTES) */}
                      <div>
                        <h5 className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            Itens da Lista Comprados — Equivalência Identificada (
                            {currentMeta.conferencia.comprados?.length || 0})
                          </span>
                        </h5>
                        {(currentMeta.conferencia.comprados || []).length === 0 ? (
                          <p className="text-xs text-slate-400">
                            Nenhum item da lista foi identificado nesta nota.
                          </p>
                        ) : (
                          <div className="divide-y divide-emerald-100 bg-emerald-50/40 border border-emerald-200 rounded-xl">
                            {currentMeta.conferencia.comprados.map((c, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-900">
                                    {c.item_lista}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="bg-white border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-medium">
                                    Na Nota: {c.item_equivalente_nota}
                                  </span>
                                </div>
                                <div className="text-slate-600 shrink-0">
                                  Qtd: {c.qtd_comprada} • Pago:{' '}
                                  <strong className="text-emerald-700">
                                    {formatCurrency(c.valor_pago)}
                                  </strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. ITENS DA LISTA QUE NÃO FORAM COMPRADOS (FALTARAM) */}
                      <div>
                        <h5 className="text-xs font-bold text-rose-600 flex items-center gap-1.5 mb-2">
                          <XCircle className="w-4 h-4" />
                          <span>
                            Não Comprados / Faltaram na Nota (
                            {currentMeta.conferencia.faltaram?.length || 0})
                          </span>
                        </h5>
                        {(currentMeta.conferencia.faltaram || []).length === 0 ? (
                          <p className="text-xs text-emerald-600 font-medium">
                            Tudo o que estava na lista foi comprado!
                          </p>
                        ) : (
                          <div className="divide-y divide-rose-100 bg-rose-50/40 border border-rose-200 rounded-xl">
                            {currentMeta.conferencia.faltaram.map((f, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 px-3 flex items-center justify-between text-xs"
                              >
                                <span className="font-semibold text-rose-800">
                                  {f.item_lista} (Qtd planejada: {f.qtd_planejada})
                                </span>
                                <span className="text-rose-600">
                                  Est: {formatCurrency(f.valor_estimado)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 3. ITENS EXTRAS COMPRADOS NA NOTA FORA DA LISTA */}
                      {(currentMeta.conferencia.extras_fora_da_lista || []).length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-indigo-700 flex items-center gap-1.5 mb-2">
                            <PlusCircle className="w-4 h-4" />
                            <span>
                              Comprados Fora da Lista Planejada (
                              {currentMeta.conferencia.extras_fora_da_lista.length})
                            </span>
                          </h5>
                          <div className="divide-y divide-indigo-100 bg-indigo-50/40 border border-indigo-200 rounded-xl">
                            {currentMeta.conferencia.extras_fora_da_lista.map(
                              (ex, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 px-3 flex items-center justify-between text-xs"
                                >
                                  <span className="font-medium text-slate-800">
                                    {ex.item_nota} (Qtd: {ex.qtd_comprada})
                                  </span>
                                  <span className="font-semibold text-indigo-700">
                                    {formatCurrency(ex.valor_pago)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* HISTÓRICO DE LISTAS DE COMPRAS SALVAS (SUPERMERCADO OU FARMÁCIA) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        Histórico de Listas de Compras —{' '}
                        {currentListType === 'FARMACIA' ? 'Farmácia' : 'Supermercado'} (
                        {historicoListasDoTipo.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Suas listas salvas e relatórios de conferência com notas fiscais
                      </p>
                    </div>
                  </div>
                </div>

                {historicoListasDoTipo.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Nenhuma lista salva no histórico de{' '}
                    {currentListType === 'FARMACIA' ? 'Farmácia' : 'Supermercado'} ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {historicoListasDoTipo.map((hist) => {
                      const isExp = expandedHistoryListId === hist.db_id;
                      const conf = hist.conferencia;
                      return (
                        <div key={hist.db_id} className="p-4 sm:px-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-slate-900 text-sm">
                                  {hist.titulo}
                                </p>
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                    hist.status === 'CONFERIDA'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {hist.status === 'CONFERIDA'
                                    ? 'Conferida com Nota Fiscal'
                                    : 'Planejada / Aberta'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Criada em {formatDateBR(hist.data_criacao)} •{' '}
                                {(hist.itens || []).length} item(ns) • Previsto:{' '}
                                <strong>{formatCurrency(hist.total_previsto)}</strong>
                                {conf
                                  ? ` • Nota (${conf.estabelecimento}): ${formatCurrency(
                                      conf.valor_total_nota
                                    )}`
                                  : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleLoadListFromHistory(hist)}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                              >
                                Abrir na Tela
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedHistoryListId(isExp ? null : hist.db_id)
                                }
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Ver detalhes da lista"
                              >
                                {isExp ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHistoryList(hist.db_id)}
                                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Excluir do histórico"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {isExp && (
                            <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-3 text-xs">
                              {conf && (
                                <div className="space-y-2 pb-3 border-b border-slate-200">
                                  <p className="font-bold text-slate-800">
                                    Resumo da Conferência ({conf.estabelecimento}):
                                  </p>
                                  <p className="text-emerald-700">
                                    ✅ Comprados da lista:{' '}
                                    {(conf.comprados || [])
                                      .map(
                                        (c) =>
                                          `${c.item_lista} (= ${c.item_equivalente_nota})`
                                      )
                                      .join(', ') || 'Nenhum'}
                                  </p>
                                  {(conf.faltaram || []).length > 0 && (
                                    <p className="text-rose-600">
                                      ❌ Faltaram comprar:{' '}
                                      {conf.faltaram.map((f) => f.item_lista).join(', ')}
                                    </p>
                                  )}
                                  {(conf.extras_fora_da_lista || []).length > 0 && (
                                    <p className="text-indigo-700">
                                      ➕ Comprados fora da lista:{' '}
                                      {conf.extras_fora_da_lista
                                        .map((x) => x.item_nota)
                                        .join(', ')}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div>
                                <p className="font-bold text-slate-700 mb-1.5">
                                  Itens Planejados na Lista:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {(hist.itens || []).map((it, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200/80"
                                    >
                                      <span>
                                        {it.checked ? '✅ ' : '⬜ '}
                                        {it.descricao_item} ({it.quantidade} {it.unidade})
                                      </span>
                                      <span className="font-semibold">
                                        {formatCurrency(
                                          (Number(it.quantidade) || 0) *
                                            (Number(it.valor_unitario) || 0)
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              ABA 5: DEMAIS ITENS (ELETRÔNICOS, CASA, DESPESAS & GARANTIAS)
          ========================================== */}
          {activeTab === 'demais' && (
            <div className="space-y-6">
              {/* CABEÇALHO E FILTROS DE DEMAIS ITENS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full mb-1.5">
                      <Package className="w-3.5 h-3.5" />
                      <span>Fora de Supermercado & Farmácia</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Demais Itens Comprados & Despesas Gerais
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Eletrônicos, eletrodomésticos, casa, vestuário, serviços e lançamentos avulsos fora de Supermercado e Farmácia.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={openNewTransacaoModal}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xs cursor-pointer transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Novo Lançamento Avulso</span>
                    </button>
                  </div>
                </div>

                {/* FILTRO POR CATEGORIA */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <Filter className="w-4 h-4 text-slate-400 mr-1" />
                  <button
                    type="button"
                    onClick={() => setDemaisCategoryFilter('TODAS_DEMAIS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                      demaisCategoryFilter === 'TODAS_DEMAIS'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todas as Categorias
                  </button>
                  {CATEGORIAS_DESPESA.filter(
                    (c) => c !== 'Alimentação & Supermercado' && c !== 'Saúde & Farmácia'
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDemaisCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition ${
                        demaisCategoryFilter === cat
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* ITENS DE NOTAS FISCAIS FORA DE SUPERMERCADO E FARMÁCIA */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Itens de Notas Fiscais (Eletrônicos, Casa, Lazer, etc.)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Itens extraídos das suas notas que não pertencem a Supermercado ou Farmácia
                    </p>
                  </div>
                </div>

                {(() => {
                  const demaisItensLista = itensEnriquecidos.filter((i) => {
                    const isSup =
                      i.categoria_item === 'Alimentação & Supermercado' ||
                      i.categoria_nota === 'Alimentação & Supermercado';
                    const isFarma =
                      i.categoria_item === 'Saúde & Farmácia' ||
                      i.categoria_nota === 'Saúde & Farmácia';
                    if (isSup || isFarma) return false;
                    if (
                      demaisCategoryFilter !== 'TODAS_DEMAIS' &&
                      i.categoria_item !== demaisCategoryFilter
                    ) {
                      return false;
                    }
                    return true;
                  });

                  if (demaisItensLista.length === 0) {
                    return (
                      <div className="p-10 text-center text-slate-400 text-sm">
                        Nenhum item encontrado nesta categoria fora de Supermercado e Farmácia.
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-100">
                      {demaisItensLista.map((item) => {
                        const g = item.garantiaInfo;
                        return (
                          <div
                            key={item.id}
                            className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">
                                  {item.descricao_item}
                                </span>
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-medium">
                                  {item.categoria_item}
                                </span>
                                {g && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${
                                      g.expirada
                                        ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
                                    }`}
                                  >
                                    {g.expirada ? (
                                      <ShieldAlert className="w-3.5 h-3.5" />
                                    ) : (
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {g.texto} ({g.detalhe})
                                    </span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                Loja: <strong>{item.estabelecimento}</strong> • Compra em:{' '}
                                <strong>{formatDateBR(item.data_compra)}</strong> • Qtd:{' '}
                                {item.quantidade} {item.unidade || 'UN'} (Unit:{' '}
                                {formatCurrency(item.valor_unitario)})
                              </p>
                            </div>

                            <div className="text-left sm:text-right shrink-0">
                              <p className="font-bold text-slate-900 text-sm">
                                {formatCurrency(item.valor_total)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* DESPESAS E LANÇAMENTOS DO MÊS SELECIONADO */}
              <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Lançamentos e Despesas do Mês ({selectedMonth})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total geral no mês:{' '}
                      <strong>{formatCurrency(resumoMensal.totalPagamentosMes)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {pagamentosDoMes
                    .filter((t) =>
                      demaisCategoryFilter === 'TODAS_DEMAIS'
                        ? true
                        : t.categoria === demaisCategoryFilter
                    )
                    .map((t) => {
                      const isConcluido =
                        t.status === 'CONFIRMADO' ||
                        t.status === 'PAGO' ||
                        t.status === 'RECEBIDO';

                      return (
                        <div
                          key={t.id}
                          className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleToggleStatusTransacao(t)}
                              title="Alternar status"
                              className={`mt-0.5 p-2 rounded-xl border cursor-pointer transition ${
                                isConcluido
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : 'bg-amber-50 border-amber-200 text-amber-600'
                              }`}
                            >
                              {isConcluido ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </button>

                            <div>
                              <p className="font-semibold text-slate-900 text-sm">
                                {t.descricao}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                                  {t.categoria}
                                </span>
                                <span>• {t.forma_pagamento || 'PIX'}</span>
                                <span>• Data: {formatDateBR(t.data_competencia)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <div className="text-left sm:text-right">
                              <p className="font-bold text-sm text-rose-600">
                                - {formatCurrency(t.valor)}
                              </p>
                              <span
                                className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  isConcluido
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditTransacaoModal(t)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransacao(t.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>
          )}

          {/* ==========================================
              ABA 7: ESTATÍSTICAS DOS ITENS (MAIS COMPRADOS, FREQUÊNCIA, PREÇO MÉDIO & QTD MÉDIA)
          ========================================== */}
          {activeTab === 'estatisticas' && (
            <div className="space-y-6">
              {/* CARDS DE DESTAQUE DAS ESTATÍSTICAS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Item Mais Comprado
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-1.5 truncate">
                    {resumoEstatisticas.maisComprado
                      ? resumoEstatisticas.maisComprado.descricao_item
                      : 'Nenhum item'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {resumoEstatisticas.maisComprado
                      ? `Comprado ${resumoEstatisticas.maisComprado.vezes_comprado}x • ${resumoEstatisticas.maisComprado.frequencia_texto}`
                      : '-'}
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                    Produtos Únicos Analisados
                  </span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {resumoEstatisticas.totalItensUnicos}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {resumoEstatisticas.itensRecorrentes} item(ns) com compra recorrente (2+ vezes)
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Maior Gasto Acumulado
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-1.5 truncate">
                    {resumoEstatisticas.maiorGastoItem
                      ? resumoEstatisticas.maiorGastoItem.descricao_item
                      : '-'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {resumoEstatisticas.maiorGastoItem
                      ? `Total gasto: ${formatCurrency(
                          resumoEstatisticas.maiorGastoItem.gasto_total
                        )} (${resumoEstatisticas.maiorGastoItem.vezes_comprado}x)`
                      : '-'}
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Regra das Listas de Compras
                  </span>
                  <p className="text-sm font-bold text-emerald-700 mt-1.5">
                    Preço Médio &amp; Qtd Média
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Suas listas de Supermercado e Farmácia usam automaticamente estas médias
                  </p>
                </div>
              </div>

              {/* BARRA DE BUSCA, FILTRO DE CATEGORIA E ORDENAÇÃO */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-emerald-600" />
                      <span>
                        Ranking de Itens Mais Comprados, Frequência e Preço Médio
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Acompanhe com que frequência cada produto é comprado, a quantidade média por compra e o preço médio histórico.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={statsCategoryFilter}
                      onChange={(e) => setStatsCategoryFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-800"
                    >
                      <option value="TODAS">Todas as Categorias</option>
                      <option value="Alimentação & Supermercado">
                        Somente Supermercado
                      </option>
                      <option value="Saúde & Farmácia">Somente Farmácia</option>
                      <option value="DEMAIS">Demais Itens</option>
                    </select>

                    <select
                      value={statsSortBy}
                      onChange={(e) => setStatsSortBy(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-800"
                    >
                      <option value="MAIS_COMPRADOS">
                        Ordenar: Mais Comprados (Frequência)
                      </option>
                      <option value="MENOR_CICLO">
                        Ordenar: Menor Intervalo de Dias
                      </option>
                      <option value="MAIOR_GASTO">
                        Ordenar: Maior Gasto Acumulado
                      </option>
                      <option value="PRECO_MEDIO">
                        Ordenar: Maior Preço Médio
                      </option>
                      <option value="ALFABETICA">Ordenar: Nome (A-Z)</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar estatísticas por nome do produto, categoria ou estabelecimento..."
                    value={statsSearch}
                    onChange={(e) => setStatsSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* TABELA / LISTA DE ESTATÍSTICAS DOS ITENS */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                {estatisticasFiltradas.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    Nenhum item encontrado para gerar estatísticas.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {estatisticasFiltradas.map((stat, idx) => {
                      const isFarma = stat.categoria_item === 'Saúde & Farmácia';
                      return (
                        <div
                          key={stat.chave}
                          className="p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 transition"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              #{idx + 1}
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-slate-900 text-sm">
                                  {stat.descricao_item}
                                </p>
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-medium">
                                  {stat.categoria_item}
                                </span>
                                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                                  🔄 Comprado {stat.vezes_comprado}x
                                </span>
                                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                                  ⏱️ {stat.frequencia_texto}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                <span>
                                  📦 Qtd Média por Compra:{' '}
                                  <strong className="text-slate-800">
                                    {stat.quantidade_media} {stat.unidade}
                                  </strong>{' '}
                                  (Total acumulado: {stat.quantidade_total} {stat.unidade})
                                </span>
                                <span>•</span>
                                <span>
                                  Última compra:{' '}
                                  <strong>{formatDateBR(stat.ultima_data)}</strong>
                                </span>
                                {stat.estabelecimentos.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-xs">
                                      Lojas: {stat.estabelecimentos.join(', ')}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                            <div className="text-left sm:text-right">
                              <p className="text-xs text-slate-500">
                                Preço Médio:{' '}
                                <strong className="text-emerald-700 text-sm">
                                  {formatCurrency(stat.preco_medio)}
                                </strong>{' '}
                                /{stat.unidade}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Mín: {formatCurrency(stat.menor_preco)} • Máx:{' '}
                                {formatCurrency(stat.maior_preco)} • Gasto Total:{' '}
                                <strong className="text-slate-700">
                                  {formatCurrency(stat.gasto_total)}
                                </strong>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                addFromCatalogToShoppingList(
                                  stat,
                                  isFarma ? 'FARMACIA' : 'SUPERMERCADO'
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shrink-0 shadow-2xs"
                              title={`Adicionar à lista de ${
                                isFarma ? 'Farmácia' : 'Supermercado'
                              } com Preço Médio e Quantidade Média`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                + Lista {isFarma ? 'Farmácia' : 'Mercado'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 8: GERENCIAR CATEGORIAS (INCLUINDO PETS) */}
          {/* ============================================================== */}
          {activeTab === 'categorias' && (
            <div className="space-y-6">
              {/* Cabeçalho e formulário de Nova Categoria */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Tags className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Gerenciar Categorias de Despesa
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Adicione, edite o nome, reordene ou remova categorias. A categoria{' '}
                        <strong className="text-indigo-600">Pets</strong> já está incluída e
                        disponível em todas as telas e na IA!
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRestoreDefaultCategorias}
                    disabled={salvandoCategorias}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shrink-0"
                    title="Garantir que todas as categorias padrão (incluindo Pets) estejam presentes"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Padrões</span>
                  </button>
                </div>

                {/* Formulário para Adicionar Nova Categoria */}
                <form
                  onSubmit={handleAddCategoria}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-slate-100"
                >
                  <div className="relative flex-1">
                    <Tags className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Nome da nova categoria (ex: Pets, Jardim, Assinaturas...)"
                      value={novaCategoriaInput}
                      onChange={(e) => setNovaCategoriaInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={salvandoCategorias || !novaCategoriaInput.trim()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Categoria</span>
                  </button>
                </form>

                {/* Opção de atualizar histórico ao renomear */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200/70">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={atualizarHistoricoAoRenomear}
                      onChange={(e) => setAtualizarHistoricoAoRenomear(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Ao renomear uma categoria, atualizar automaticamente os itens de notas e
                      lançamentos já cadastrados
                    </span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {categoriasDespesa.length} categorias ativas
                  </span>
                </div>
              </div>

              {/* Lista de Categorias com edição inline, reordenação e exclusão */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Categorias Cadastradas ({resumoUsoCategorias.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Clique no lápis para renomear ou use as setas para alterar a ordem de exibição
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {resumoUsoCategorias.map((item, idx) => {
                    const isEditing = editandoCategoriaOriginal === item.categoria;
                    const isProtected =
                      item.categoria === 'Supermercado' ||
                      item.categoria === 'Farmácia' ||
                      item.categoria === 'Outros';
                    const isPets = item.categoria.toLowerCase() === 'pets';

                    return (
                      <div
                        key={item.categoria}
                        className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveCategoria(idx, -1)}
                              disabled={idx === 0 || salvandoCategorias}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCategoria(idx, 1)}
                              disabled={
                                idx === resumoUsoCategorias.length - 1 || salvandoCategorias
                              }
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1 max-w-md">
                              <input
                                type="text"
                                value={editandoCategoriaNovoNome}
                                onChange={(e) => setEditandoCategoriaNovoNome(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-xl border border-indigo-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRenameCategoria(item.categoria)}
                                disabled={salvandoCategorias}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditandoCategoriaOriginal(null);
                                  setEditandoCategoriaNovoNome('');
                                }}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">
                                  {item.categoria}
                                </span>
                                {isPets && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    🐾 Pets
                                  </span>
                                )}
                                {isProtected && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    Sistema
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                                <span>
                                  Itens em notas: <strong>{item.qtdItens}</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Lançamentos avulsos: <strong>{item.qtdTransacoes}</strong>
                                </span>
                                {item.totalItens > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-700 font-medium">
                                      Total em itens: {formatCurrency(item.totalItens)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleStartRenameCategoria(item.categoria)}
                              disabled={salvandoCategorias}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer"
                              title="Renomear categoria"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategoria(item.categoria)}
                              disabled={salvandoCategorias || isProtected}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 disabled:opacity-30 disabled:pointer-events-none text-xs font-medium cursor-pointer"
                              title={
                                isProtected
                                  ? 'Categoria principal do sistema não pode ser removida'
                                  : 'Remover categoria da lista'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL DE VISUALIZAÇÃO DO COMPROVANTE / NOTA FISCAL */}
      {viewingComprovante && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {viewingComprovante.estabelecimento}
                </h3>
                {(() => {
                  const vals = calcularValoresNota(viewingComprovante);
                  return (
                    <p className="text-xs text-slate-500">
                      Emissão: {formatDateBR(viewingComprovante.data_emissao)} • Total:{' '}
                      {formatCurrency(vals.valorTotalBruto)} • Desconto: -{' '}
                      {formatCurrency(vals.desconto)} •{' '}
                      <strong className="text-emerald-700">
                        Valor Pago: {formatCurrency(vals.valorPago)}
                      </strong>
                    </p>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingComprovante.url_comprovante}
                  download={`nota-${viewingComprovante.estabelecimento}.jpg`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </a>
                <button
                  onClick={() => setViewingComprovante(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 bg-slate-50 flex items-center justify-center">
              {viewingComprovante.url_comprovante?.startsWith('data:application/pdf') ? (
                <iframe
                  src={viewingComprovante.url_comprovante}
                  title="Documento Nota Fiscal"
                  className="w-full h-[70vh] rounded-lg border border-slate-200"
                />
              ) : (
                <img
                  src={viewingComprovante.url_comprovante}
                  alt="Comprovante da Nota Fiscal"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xs"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO / EDITAR PAGAMENTO */}
      {showTransacaoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTransacao}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">
                {transacaoForm.id ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTransacaoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Eletrônico, Energia, Internet..."
                  value={transacaoForm.descricao}
                  onChange={(e) =>
                    setTransacaoForm({ ...transacaoForm, descricao: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={transacaoForm.valor}
                    onChange={(e) =>
                      setTransacaoForm({ ...transacaoForm, valor: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Categoria
                  </label>
                  <select
                    value={transacaoForm.categoria}
                    onChange={(e) =>
                      setTransacaoForm({ ...transacaoForm, categoria: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {CATEGORIAS_DESPESA.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Data de Competência
                  </label>
                  <input
                    type="date"
                    required
                    value={transacaoForm.data_competencia}
                    onChange={(e) =>
                      setTransacaoForm({
                        ...transacaoForm,
                        data_competencia: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Data de Pagamento
                  </label>
                  <input
                    type="date"
                    value={transacaoForm.data_pagamento}
                    onChange={(e) =>
                      setTransacaoForm({
                        ...transacaoForm,
                        data_pagamento: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={transacaoForm.forma_pagamento}
                    onChange={(e) =>
                      setTransacaoForm({
                        ...transacaoForm,
                        forma_pagamento: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {FORMAS_PAGAMENTO.map((fp) => (
                      <option key={fp} value={fp}>
                        {fp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    value={transacaoForm.status}
                    onChange={(e) =>
                      setTransacaoForm({ ...transacaoForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="CONFIRMADO">CONFIRMADO (Pago)</option>
                    <option value="PENDENTE">PENDENTE</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTransacaoModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
              >
                Salvar Lançamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MENU INFERIOR MOBILE (SOMENTE ÍCONES • LAYOUT MODERNO) */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md transition-colors ${
          darkMode
            ? 'bg-slate-900/95 border-slate-800'
            : 'bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]'
        }`}
      >
        <div className="max-w-md mx-auto grid grid-cols-8 items-center px-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                aria-label={item.label}
                className="relative flex items-center justify-center py-1 cursor-pointer group"
              >
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200 ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105'
                      : darkMode
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                {active && (
                  <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
