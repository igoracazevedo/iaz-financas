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
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO SUPABASE & GEMINI API
// ==========================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY =
  typeof __ENCODED_GEMINI_KEY__ !== 'undefined' && __ENCODED_GEMINI_KEY__
    ? atob(__ENCODED_GEMINI_KEY__)
    : import.meta.env.VITE_GEMINI_API_KEY || '';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const CATEGORIAS_DESPESA = [
  'Alimentação & Supermercado',
  'Eletrônicos & Eletrodomésticos',
  'Moradia & Contas',
  'Transporte & Combustível',
  'Saúde & Farmácia',
  'Lazer & Restaurantes',
  'Educação',
  'Vestuário',
  'Tecnologia & Assinaturas',
  'Impostos & Taxas',
  'Outros',
];

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

  // Estados das tabelas ativas
  const [cartoes, setCartoes] = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [notasFiscais, setNotasFiscais] = useState([]);
  const [itensNota, setItensNota] = useState([]);

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

  // Estados da Aba de Busca de Itens
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [onlyWithWarranty, setOnlyWithWarranty] = useState(false);

  // Estados da Aba Lista de Supermercado (inicia filtrando apenas 'Alimentação & Supermercado')
  const [shoppingList, setShoppingList] = useState(() => {
    try {
      const saved = localStorage.getItem('iaz_shopping_list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
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

  useEffect(() => {
    try {
      localStorage.setItem('iaz_shopping_list', JSON.stringify(shoppingList));
    } catch (e) {
      console.error(e);
    }
  }, [shoppingList]);

  const showNotice = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
      ]);

      if (e2 || e3 || e4 || e5) {
        throw e2 || e3 || e4 || e5;
      }

      setCartoes(cartoesData || []);
      setTransacoes(transacoesData || []);
      setNotasFiscais(notasData || []);
      setItensNota((itensData || []).map(decodeItemGarantia));
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
  // DADOS ENRIQUECIDOS DE ITENS (PARA BUSCA, GARANTIA, SUPERMERCADO E RESUMO)
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
  // CÁLCULOS DO RESUMO DO MÊS E PAGAMENTOS
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
    const totalNotasMes = notasDoMes.reduce(
      (acc, nf) => acc + (Number(nf.valor_total) || 0),
      0
    );

    const totalPagamentosMes = pagamentosDoMes.reduce(
      (acc, t) => acc + (Number(t.valor) || 0),
      0
    );

    // Gasto por categoria no mês selecionado:
    // Prioriza a soma detalhada por categoria dos itens das notas do mês + pagamentos avulsos sem nota vinculada
    const idsTransacoesComNota = new Set(
      notasFiscais.map((nf) => nf.transacao_id).filter(Boolean)
    );
    const idsNotasDoMes = new Set(notasDoMes.map((nf) => nf.id));

    const mapaCategorias = new Map();

    // 1. Soma itens das notas fiscais do mês por categoria_item
    let somaItensNotasMes = 0;
    for (const item of itensNota) {
      if (idsNotasDoMes.has(item.nota_id)) {
        const cat = item.categoria_item || 'Outros';
        const val = Number(item.valor_total) || 0;
        somaItensNotasMes += val;
        mapaCategorias.set(cat, (mapaCategorias.get(cat) || 0) + val);
      }
    }

    // Caso alguma nota não tenha itens detalhados cadastrados, usa a categoria da transação vinculada
    for (const nf of notasDoMes) {
      const temItens = itensNota.some((i) => i.nota_id === nf.id);
      if (!temItens) {
        const transVinc = transacoes.find((t) => t.id === nf.transacao_id);
        const cat = transVinc?.categoria || 'Outros';
        const val = Number(nf.valor_total) || 0;
        mapaCategorias.set(cat, (mapaCategorias.get(cat) || 0) + val);
      }
    }

    // 2. Soma pagamentos avulsos do mês (que não vieram de nota fiscal)
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

  // Catálogo de produtos únicos para a Lista de Supermercado (com filtro de categoria que inicia em 'Alimentação & Supermercado')
  const catalogoSupermercado = useMemo(() => {
    const map = new Map();
    for (const it of itensEnriquecidos) {
      const chave = String(it.descricao_item || '').trim().toUpperCase();
      if (!chave) continue;
      if (!map.has(chave)) {
        map.set(chave, {
          chave,
          descricao_item: it.descricao_item,
          unidade: it.unidade || 'un',
          ultimo_valor_unitario:
            Number(it.valor_unitario) || Number(it.valor_total) || 0,
          ultimo_estabelecimento: it.estabelecimento,
          ultima_data: it.data_compra,
          categoria_item: it.categoria_item || 'Outros',
          historico_compras: 1,
        });
      } else {
        map.get(chave).historico_compras += 1;
      }
    }

    let lista = Array.from(map.values()).sort((a, b) =>
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
  }, [itensEnriquecidos, catalogSearch, catalogCategoryFilter]);

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
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const mimeType = file.type || 'image/jpeg';
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!GEMINI_API_KEY) {
      showNotice(
        'Configure VITE_GEMINI_API_KEY no arquivo .env para usar a leitura via IA.',
        'error'
      );
      return;
    }

    setOcrLoading(true);
    try {
      const { base64Data, dataUrl, mimeType } = await fileToBase64(file);
      setPreviewImage(dataUrl);

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const interaction = await ai.interactions.create({
        model: 'gemini-3.8-flash',
        input: [
          {
            type: mimeType === 'application/pdf' ? 'document' : 'image',
            mime_type: mimeType,
            data: base64Data,
          },
          {
            type: 'text',
            text: `Analise esta Nota Fiscal / Cupom Fiscal brasileiro (NFC-e, NF-e, DANFE ou SAT) e extraia todos os dados estruturados.
Classifique cada item e a categoria geral usando uma destas categorias: ${CATEGORIAS_DESPESA.join(', ')}.
Para data_emissao, retorne no formato YYYY-MM-DD.
Para forma_pagamento, normalize para uma destas: PIX, Cartão de Crédito, Cartão de Débito, Dinheiro, Boleto ou Outros.
Para cada item, preencha garantia_meses (número inteiro de meses de garantia): se for um produto eletrônico, eletrodoméstico, informática ou equipamento durável, informe o tempo de garantia escrito na nota ou 12 meses por padrão; se for alimento/supermercado/consumível sem garantia durável, retorne 0.`,
          },
        ],
        response_format: [
          {
            type: 'text',
            mime_type: 'application/json',
            schema: {
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
            },
          },
        ],
      });

      const parsed = JSON.parse(interaction.output_text || '{}');
      const today = new Date().toISOString().split('T')[0];

      setExtractedNota({
        estabelecimento: parsed.estabelecimento || 'Estabelecimento Não Identificado',
        cnpj: parsed.cnpj || '',
        data_emissao: parsed.data_emissao || today,
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

      showNotice('Nota fiscal lida pela IA! Revise os dados e o tempo de garantia abaixo.');
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

  const handleConfirmAndSaveNota = async (e) => {
    e.preventDefault();
    if (!supabase || !extractedNota) return;

    setOcrLoading(true);
    try {
      const transacaoPayload = {
        tipo: 'PAGAMENTO',
        descricao: `NF: ${extractedNota.estabelecimento}`,
        categoria: extractedNota.categoria_geral || CATEGORIAS_DESPESA[0],
        valor: Number(extractedNota.valor_total) || 0,
        data_competencia: extractedNota.data_emissao,
        data_pagamento:
          extractedNota.status_pagamento === 'CONFIRMADO'
            ? extractedNota.data_emissao
            : null,
        forma_pagamento: extractedNota.forma_pagamento,
        status: extractedNota.status_pagamento,
        cartao_id: extractedNota.cartao_id || null,
      };

      let transacaoIdFinal = extractedNota.transacao_id || null;

      if (extractedNota.id && transacaoIdFinal) {
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
        estabelecimento: extractedNota.estabelecimento,
        cnpj: extractedNota.cnpj,
        data_emissao: extractedNota.data_emissao,
        valor_total: Number(extractedNota.valor_total) || 0,
        desconto: Number(extractedNota.desconto) || 0,
        forma_pagamento: extractedNota.forma_pagamento,
        chave_acesso: extractedNota.chave_acesso,
        url_comprovante: previewImage || null,
        transacao_id: transacaoIdFinal,
      };

      let notaIdFinal = extractedNota.id || null;

      if (extractedNota.id) {
        const { error: errUpdNota } = await supabase
          .from('notas_fiscais')
          .update(notaPayload)
          .eq('id', extractedNota.id);
        if (errUpdNota) throw errUpdNota;

        await supabase.from('itens_nota').delete().eq('nota_id', extractedNota.id);
      } else {
        const { data: novaNota, error: errNota } = await supabase
          .from('notas_fiscais')
          .insert([notaPayload])
          .select()
          .single();
        if (errNota) throw errNota;
        notaIdFinal = novaNota.id;
      }

      if (extractedNota.itens && extractedNota.itens.length > 0) {
        const itensComColuna = extractedNota.itens.map((item) => ({
          nota_id: notaIdFinal,
          descricao_item: item.descricao_item || 'Item',
          quantidade: Number(item.quantidade) || 1,
          unidade: item.unidade || 'UN',
          valor_unitario: Number(item.valor_unitario) || 0,
          valor_total: Number(item.valor_total) || 0,
          categoria_item: encodeCategoriaComGarantia(
            item.categoria_item || extractedNota.categoria_geral || 'Outros',
            item.garantia_meses
          ),
          garantia_meses: Number(item.garantia_meses) || 0,
        }));

        const { error: errItens } = await supabase
          .from('itens_nota')
          .insert(itensComColuna);

        if (errItens) {
          const itensSemColunaExtra = extractedNota.itens.map((item) => ({
            nota_id: notaIdFinal,
            descricao_item: item.descricao_item || 'Item',
            quantidade: Number(item.quantidade) || 1,
            unidade: item.unidade || 'UN',
            valor_unitario: Number(item.valor_unitario) || 0,
            valor_total: Number(item.valor_total) || 0,
            categoria_item: encodeCategoriaComGarantia(
              item.categoria_item || extractedNota.categoria_geral || 'Outros',
              item.garantia_meses
            ),
          }));
          const { error: errFallback } = await supabase
            .from('itens_nota')
            .insert(itensSemColunaExtra);
          if (errFallback) throw errFallback;
        }
      }

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
  // FUNÇÕES DA LISTA DE SUPERMERCADO
  // ==========================================
  const addFromCatalogToShoppingList = (prod) => {
    setShoppingList((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.descricao_item.trim().toUpperCase() === prod.chave
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantidade: Number((Number(updated[existingIdx].quantidade) + 1).toFixed(3)),
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          descricao_item: prod.descricao_item,
          quantidade: 1,
          unidade: prod.unidade || 'un',
          valor_unitario: Number(prod.ultimo_valor_unitario) || 0,
          estabelecimento_ref: prod.ultimo_estabelecimento || '',
          checked: false,
        },
      ];
    });
    showNotice(`"${prod.descricao_item}" adicionado à lista de compras!`);
  };

  const handleAddCustomShoppingItem = (e) => {
    e.preventDefault();
    if (!customListItem.descricao_item.trim()) return;
    setShoppingList((prev) => [
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
    setShoppingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeShoppingItem = (id) => {
    setShoppingList((prev) => prev.filter((item) => item.id !== id));
  };

  const resumoListaCompras = useMemo(() => {
    const totalPrevisto = shoppingList.reduce(
      (acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0),
      0
    );
    const totalNoCarrinho = shoppingList
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
  }, [shoppingList]);

  // ==========================================
  // NAVEGAÇÃO (RESUMO DO MÊS COMO INICIAL, SEM RECEBIMENTOS E SEM CONTAS)
  // ==========================================
  const navItems = [
    { id: 'resumo', label: 'Resumo do Mês', icon: PieChart },
    { id: 'notas', label: 'Notas IA', icon: Receipt },
    { id: 'busca', label: 'Buscar Itens', icon: Search },
    { id: 'lista', label: 'Supermercado', icon: ShoppingCart },
    { id: 'pagamentos', label: 'Pagamentos', icon: ArrowDownCircle },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
  ];

  const getCartaoNome = (id) => cartoes.find((c) => c.id === id)?.nome_cartao || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pb-20 md:pb-0">
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
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">IazFinanças</h1>
            <p className="text-xs text-slate-400">Notas IA, Garantias & Gastos</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
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

        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>Supabase + Gemini AI</span>
          <button
            onClick={fetchAllData}
            title="Sincronizar dados"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 md:pl-64">
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
          {/* CABEÇALHO SIMPLES DA TELA ATUAL (SEM OS CARDS GLOBAIS NO TOPO) */}
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {navItems.find((i) => i.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-slate-500">
                Controle inteligente de notas fiscais, garantias, supermercado e despesas
              </p>
            </div>
            <button
              onClick={fetchAllData}
              className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
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
                      Valor Gasto com Notas Fiscais ({selectedMonth})
                    </span>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {formatCurrency(resumoMensal.totalNotasMes)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {resumoMensal.qtdNotasMes} nota(s) fiscal(is) registrada(s) no mês
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total Geral de Gastos no Mês
                    </span>
                    <p className="text-3xl font-bold text-rose-600 mt-2">
                      {formatCurrency(resumoMensal.totalCategorizado)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Soma de todas as categorias no período
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
                    {notasDoMes.map((nf) => (
                      <div
                        key={nf.id}
                        className="p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {nf.estabelecimento}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateBR(nf.data_emissao)} • {nf.forma_pagamento || 'PIX'}
                          </p>
                        </div>
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(nf.valor_total)}
                        </span>
                      </div>
                    ))}
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
              {/* CARD DE UPLOAD / CÂMERA */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>OCR Inteligente com Gemini 3.8 Flash</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Escanear Nota ou Cupom Fiscal (Mercado & Eletrônicos)
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
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        disabled={ocrLoading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* REVISÃO / EDIÇÃO DOS DADOS DA NOTA */}
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
                            Valor Total (R$)
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
                            Cartão Vinculado (Opcional)
                          </label>
                          <select
                            value={extractedNota.cartao_id}
                            onChange={(e) =>
                              setExtractedNota({
                                ...extractedNota,
                                cartao_id: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                          >
                            <option value="">Sem Cartão</option>
                            {cartoes.map((cr) => (
                              <option key={cr.id} value={cr.id}>
                                {cr.nome_cartao}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ITENS EXTRAÍDOS / EDITÁVEIS DO CUPOM COM GARANTIA */}
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

              {/* PAINEL DE CONTROLE DE GARANTIAS (PRODUTOS COM GARANTIA > 0) */}
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

              {/* LISTA DE NOTAS FISCAIS CADASTRADAS */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">
                    Histórico de Notas e Cupons Fiscais ({notasFiscais.length})
                  </h3>
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

                      return (
                        <div key={nf.id} className="p-4 sm:px-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 mt-0.5">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 text-sm">
                                  {nf.estabelecimento}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                  {nf.cnpj && <span>CNPJ: {nf.cnpj}</span>}
                                  <span>• Emissão: {formatDateBR(nf.data_emissao)}</span>
                                  <span>• {nf.forma_pagamento || 'PIX'}</span>
                                  <span>• {itensDaNota.length} item(ns)</span>
                                </div>

                                {/* Resumo rápido de garantias da nota */}
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
                              <div className="text-right mr-1">
                                <p className="font-bold text-slate-900 text-sm">
                                  {formatCurrency(nf.valor_total)}
                                </p>
                                {Number(nf.desconto) > 0 && (
                                  <p className="text-[11px] text-emerald-600">
                                    Desc: {formatCurrency(nf.desconto)}
                                  </p>
                                )}
                              </div>

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
                      placeholder="Buscar qualquer item das notas (ex: Carne, TV, Notebook, Banana, Loja...)"
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
              ABA 4: LISTA DE SUPERMERCADO (PRÉVIA DE COMPRAS)
          ========================================== */}
          {activeTab === 'lista' && (
            <div className="space-y-6">
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
                    {shoppingList.length} item(ns) na lista
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-700">
                    Já no Carrinho (Marcados)
                  </span>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {formatCurrency(resumoListaCompras.totalNoCarrinho)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {shoppingList.filter((i) => i.checked).length} item(ns) pegos
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
                    {shoppingList.filter((i) => !i.checked).length} item(ns) pendentes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* CATÁLOGO DE ITENS JÁ CADASTRADOS NAS NOTAS (COM FILTRO DE CATEGORIA INICIANDO EM SUPERMERCADO) */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 self-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Itens Cadastrados nas Notas ({catalogoSupermercado.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Inicia exibindo itens de Supermercado, mas você pode filtrar outras categorias abaixo
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
                        <option value="Alimentação & Supermercado">
                          Somente Supermercado (Alimentação & Supermercado)
                        </option>
                        <option value="TODAS">
                          Todas as Categorias (Incluir Outros Itens)
                        </option>
                        {CATEGORIAS_DESPESA.filter(
                          (c) => c !== 'Alimentação & Supermercado'
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

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                    {catalogoSupermercado.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Nenhum item encontrado nesta categoria.
                      </div>
                    ) : (
                      catalogoSupermercado.map((prod) => (
                        <div
                          key={prod.chave}
                          className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate">
                              {prod.descricao_item}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              Último:{' '}
                              <strong>{formatCurrency(prod.ultimo_valor_unitario)}</strong> /
                              {prod.unidade} • {prod.ultimo_estabelecimento} (
                              {formatDateBR(prod.ultima_data)})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addFromCatalogToShoppingList(prod)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
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
                      placeholder="Nome do produto..."
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

                {/* MINHA LISTA DE SUPERMERCADO ATUAL */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        Minha Lista de Supermercado ({shoppingList.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Ajuste as quantidades ou valores unitários para simular sua compra
                      </p>
                    </div>
                    {shoppingList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShoppingList([])}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Limpar lista
                      </button>
                    )}
                  </div>

                  {shoppingList.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">
                      Sua lista está vazia. Selecione produtos ao lado para calcular a prévia!
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {shoppingList.map((item) => {
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
                                    Ref: {item.estabelecimento_ref}
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
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              ABA 5: PAGAMENTOS DO MÊS
          ========================================== */}
          {activeTab === 'pagamentos' && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">Pagamentos do Mês</h3>
                    <p className="text-xs text-slate-500">
                      Total no mês: <strong>{formatCurrency(resumoMensal.totalPagamentosMes)}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
                    />
                  </div>

                  <button
                    onClick={openNewTransacaoModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xs cursor-pointer transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo Pagamento</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {pagamentosDoMes.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    Nenhum pagamento encontrado para {selectedMonth}.
                  </div>
                ) : (
                  pagamentosDoMes.map((t) => {
                    const isConcluido =
                      t.status === 'CONFIRMADO' ||
                      t.status === 'PAGO' ||
                      t.status === 'RECEBIDO';
                    const cartaoNome = getCartaoNome(t.cartao_id);

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
                              <span>• Comp: {formatDateBR(t.data_competencia)}</span>
                              {cartaoNome && <span>• Cartão: {cartaoNome}</span>}
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
                  })
                )}
              </div>
            </section>
          )}

          {/* ==========================================
              ABA 6: CARTÕES (cartoes)
          ========================================== */}
          {activeTab === 'cartoes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleSaveCartao}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 self-start"
              >
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>{cartaoForm.id ? 'Editar Cartão' : 'Novo Cartão'}</span>
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nome do Cartão
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Nubank Ultravioleta, Itaú Black..."
                    value={cartaoForm.nome_cartao}
                    onChange={(e) =>
                      setCartaoForm({ ...cartaoForm, nome_cartao: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Bandeira
                    </label>
                    <select
                      value={cartaoForm.bandeira}
                      onChange={(e) =>
                        setCartaoForm({ ...cartaoForm, bandeira: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                    >
                      <option value="Mastercard">Mastercard</option>
                      <option value="Visa">Visa</option>
                      <option value="Elo">Elo</option>
                      <option value="Amex">Amex</option>
                      <option value="Hipercard">Hipercard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Modalidade
                    </label>
                    <select
                      value={cartaoForm.tipo}
                      onChange={(e) =>
                        setCartaoForm({ ...cartaoForm, tipo: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                    >
                      <option value="CREDITO">Crédito</option>
                      <option value="DEBITO">Débito</option>
                      <option value="MULTIPLO">Múltiplo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Limite Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={cartaoForm.limite}
                    onChange={(e) =>
                      setCartaoForm({ ...cartaoForm, limite: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Dia Fechamento
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cartaoForm.dia_fechamento}
                      onChange={(e) =>
                        setCartaoForm({
                          ...cartaoForm,
                          dia_fechamento: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Dia Vencimento
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cartaoForm.dia_vencimento}
                      onChange={(e) =>
                        setCartaoForm({
                          ...cartaoForm,
                          dia_vencimento: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                  >
                    {cartaoForm.id ? 'Salvar Alterações' : 'Cadastrar Cartão'}
                  </button>
                  {cartaoForm.id && (
                    <button
                      type="button"
                      onClick={() =>
                        setCartaoForm({
                          id: null,
                          nome_cartao: '',
                          bandeira: 'Mastercard',
                          tipo: 'CREDITO',
                          limite: '',
                          dia_fechamento: 1,
                          dia_vencimento: 10,
                          ativo: true,
                        })
                      }
                      className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">
                    Cartões Cadastrados ({cartoes.length})
                  </h3>
                </div>
                {cartoes.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    Nenhum cartão cadastrado.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cartoes.map((cr) => (
                      <div
                        key={cr.id}
                        className="p-4 sm:px-6 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {cr.nome_cartao}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {cr.bandeira} • {cr.tipo} • Fecha dia {cr.dia_fechamento} / Vence
                            dia {cr.dia_vencimento}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Limite</p>
                            <p className="font-bold text-slate-900 text-sm">
                              {formatCurrency(cr.limite)}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setCartaoForm({
                                id: cr.id,
                                nome_cartao: cr.nome_cartao,
                                bandeira: cr.bandeira || 'Mastercard',
                                tipo: cr.tipo || 'CREDITO',
                                limite: cr.limite ?? '',
                                dia_fechamento: cr.dia_fechamento || 1,
                                dia_vencimento: cr.dia_vencimento || 10,
                                ativo: cr.ativo !== false,
                              })
                            }
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCartao(cr.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                <p className="text-xs text-slate-500">
                  Emissão: {formatDateBR(viewingComprovante.data_emissao)} •{' '}
                  {formatCurrency(viewingComprovante.valor_total)}
                </p>
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
                {transacaoForm.id ? 'Editar Pagamento' : 'Novo Pagamento'}
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
                  placeholder="Ex: Supermercado, Energia, Internet..."
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

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cartão (Opcional)
                </label>
                <select
                  value={transacaoForm.cartao_id}
                  onChange={(e) =>
                    setTransacaoForm({ ...transacaoForm, cartao_id: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="">Nenhum</option>
                  {cartoes.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.nome_cartao}
                    </option>
                  ))}
                </select>
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
                Salvar Pagamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BOTTOM BAR MOBILE */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 flex items-center justify-around py-1.5 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl text-[10px] font-medium transition cursor-pointer ${
                active ? 'text-emerald-600 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
