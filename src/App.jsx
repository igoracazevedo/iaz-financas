import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import {
  Wallet,
  CreditCard,
  ArrowUpCircle,
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
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  X,
  Check,
  FileText,
  ShoppingBag,
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO SUPABASE & GEMINI API
// ==========================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY =
  typeof __ENCODED_GEMINI_KEY__ !== 'undefined' && __ENCODED_GEMINI_KEY__
    ? atob(__ENCODED_GEMINI_KEY__)
    : '';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const CATEGORIAS_DESPESA = [
  'Alimentação & Supermercado',
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

const CATEGORIAS_RECEITA = [
  'Salário',
  'Pró-labore / Freelance',
  'Rendimentos / Dividendos',
  'Reembolso',
  'Vendas',
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

export default function App() {
  const [activeTab, setActiveTab] = useState('pagamentos');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Estados das 5 tabelas
  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [notasFiscais, setNotasFiscais] = useState([]);
  const [itensNota, setItensNota] = useState([]);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Estados de Formulários - Contas Bancárias
  const [contaForm, setContaForm] = useState({
    id: null,
    nome_banco: '',
    tipo_conta: 'CORRENTE',
    saldo_inicial: '',
    ativo: true,
  });

  // Estados de Formulários - Cartões
  const [cartaoForm, setCartaoForm] = useState({
    id: null,
    nome_cartao: '',
    bandeira: 'Mastercard',
    tipo: 'CREDITO',
    limite: '',
    dia_fechamento: 1,
    dia_vencimento: 10,
    conta_id: '',
    ativo: true,
  });

  // Estados de Formulários - Transações (Recebimentos e Pagamentos)
  const emptyTransacao = (tipo) => ({
    id: null,
    tipo,
    descricao: '',
    categoria: tipo === 'RECEBIMENTO' ? CATEGORIAS_RECEITA[0] : CATEGORIAS_DESPESA[0],
    valor: '',
    data_competencia: `${selectedMonth}-01`,
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'PIX',
    status: tipo === 'RECEBIMENTO' ? 'RECEBIDO' : 'PAGO',
    conta_id: '',
    cartao_id: '',
  });

  const [transacaoForm, setTransacaoForm] = useState(() => emptyTransacao('PAGAMENTO'));
  const [showTransacaoModal, setShowTransacaoModal] = useState(false);

  // Estados de Leitura de Notas Fiscais (OCR com Gemini)
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [extractedNota, setExtractedNota] = useState(null);
  const [expandedNotaId, setExpandedNotaId] = useState(null);

  const showNotice = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ==========================================
  // CARREGAMENTO DE DADOS DO SUPABASE
  // ==========================================
  const fetchAllData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [
        { data: contasData, error: e1 },
        { data: cartoesData, error: e2 },
        { data: transacoesData, error: e3 },
        { data: notasData, error: e4 },
        { data: itensData, error: e5 },
      ] = await Promise.all([
        supabase.from('contas_bancarias').select('*').order('created_at', { ascending: false }),
        supabase.from('cartoes').select('*').order('created_at', { ascending: false }),
        supabase.from('transacoes').select('*').order('data_competencia', { ascending: false }),
        supabase.from('notas_fiscais').select('*').order('created_at', { ascending: false }),
        supabase.from('itens_nota').select('*').order('created_at', { ascending: true }),
      ]);

      if (e1 || e2 || e3 || e4 || e5) {
        throw e1 || e2 || e3 || e4 || e5;
      }

      setContas(contasData || []);
      setCartoes(cartoesData || []);
      setTransacoes(transacoesData || []);
      setNotasFiscais(notasData || []);
      setItensNota(itensData || []);
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
  // FILTROS E RESUMO MENSAL
  // ==========================================
  const transacoesDoMes = useMemo(() => {
    return transacoes.filter((t) => {
      const dataRef = t.data_competencia || t.data_pagamento || '';
      return dataRef.startsWith(selectedMonth);
    });
  }, [transacoes, selectedMonth]);

  const recebimentosDoMes = useMemo(
    () => transacoesDoMes.filter((t) => t.tipo === 'RECEBIMENTO'),
    [transacoesDoMes]
  );

  const pagamentosDoMes = useMemo(
    () => transacoesDoMes.filter((t) => t.tipo === 'PAGAMENTO'),
    [transacoesDoMes]
  );

  const resumo = useMemo(() => {
    const saldoInicialContas = contas
      .filter((c) => c.ativo !== false)
      .reduce((acc, c) => acc + (Number(c.saldo_inicial) || 0), 0);

    const totalRecebimentos = recebimentosDoMes.reduce(
      (acc, t) => acc + (Number(t.valor) || 0),
      0
    );
    const totalRecebidoConfirmado = recebimentosDoMes
      .filter((t) => t.status === 'RECEBIDO' || t.status === 'PAGO')
      .reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

    const totalPagamentos = pagamentosDoMes.reduce(
      (acc, t) => acc + (Number(t.valor) || 0),
      0
    );
    const totalPagoConfirmado = pagamentosDoMes
      .filter((t) => t.status === 'PAGO')
      .reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

    const resultadoMes = totalRecebimentos - totalPagamentos;

    return {
      saldoInicialContas,
      totalRecebimentos,
      totalRecebidoConfirmado,
      totalPagamentos,
      totalPagoConfirmado,
      resultadoMes,
    };
  }, [contas, recebimentosDoMes, pagamentosDoMes]);

  // ==========================================
  // 1. CRUD CONTAS BANCÁRIAS
  // ==========================================
  const handleSaveConta = async (e) => {
    e.preventDefault();
    if (!supabase) return showNotice('Configure o Supabase no arquivo .env', 'error');

    const payload = {
      nome_banco: contaForm.nome_banco.trim(),
      tipo_conta: contaForm.tipo_conta,
      saldo_inicial: Number(contaForm.saldo_inicial) || 0,
      ativo: Boolean(contaForm.ativo),
    };

    try {
      if (contaForm.id) {
        const { error } = await supabase
          .from('contas_bancarias')
          .update(payload)
          .eq('id', contaForm.id);
        if (error) throw error;
        showNotice('Conta bancária atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('contas_bancarias').insert([payload]);
        if (error) throw error;
        showNotice('Conta bancária cadastrada com sucesso!');
      }
      setContaForm({ id: null, nome_banco: '', tipo_conta: 'CORRENTE', saldo_inicial: '', ativo: true });
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao salvar conta: ${err.message}`, 'error');
    }
  };

  const handleDeleteConta = async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('contas_bancarias').delete().eq('id', id);
      if (error) throw error;
      showNotice('Conta removida!');
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao excluir conta: ${err.message}`, 'error');
    }
  };

  // ==========================================
  // 2. CRUD CARTÕES
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
      conta_id: cartaoForm.conta_id || null,
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
        conta_id: '',
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
  // 3 & 4. CRUD TRANSAÇÕES (RECEBIMENTOS / PAGAMENTOS)
  // ==========================================
  const openNewTransacaoModal = (tipo) => {
    setTransacaoForm({
      ...emptyTransacao(tipo),
      data_competencia: `${selectedMonth}-${String(new Date().getDate()).padStart(2, '0')}`,
    });
    setShowTransacaoModal(true);
  };

  const openEditTransacaoModal = (t) => {
    setTransacaoForm({
      id: t.id,
      tipo: t.tipo,
      descricao: t.descricao || '',
      categoria: t.categoria || 'Outros',
      valor: t.valor ?? '',
      data_competencia: t.data_competencia || `${selectedMonth}-01`,
      data_pagamento: t.data_pagamento || '',
      forma_pagamento: t.forma_pagamento || 'PIX',
      status: t.status || 'PENDENTE',
      conta_id: t.conta_id || '',
      cartao_id: t.cartao_id || '',
    });
    setShowTransacaoModal(true);
  };

  const handleSaveTransacao = async (e) => {
    e.preventDefault();
    if (!supabase) return showNotice('Configure o Supabase no arquivo .env', 'error');

    const payload = {
      tipo: transacaoForm.tipo,
      descricao: transacaoForm.descricao.trim(),
      categoria: transacaoForm.categoria,
      valor: Number(transacaoForm.valor) || 0,
      data_competencia: transacaoForm.data_competencia || null,
      data_pagamento: transacaoForm.data_pagamento || null,
      forma_pagamento: transacaoForm.forma_pagamento,
      status: transacaoForm.status,
      conta_id: transacaoForm.conta_id || null,
      cartao_id: transacaoForm.cartao_id || null,
    };

    try {
      if (transacaoForm.id) {
        const { error } = await supabase
          .from('transacoes')
          .update(payload)
          .eq('id', transacaoForm.id);
        if (error) throw error;
        showNotice('Lançamento atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('transacoes').insert([payload]);
        if (error) throw error;
        showNotice('Lançamento registrado com sucesso!');
      }
      setShowTransacaoModal(false);
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao salvar lançamento: ${err.message}`, 'error');
    }
  };

  const handleToggleStatusTransacao = async (t) => {
    if (!supabase) return;
    const isConcluido = t.status === 'PAGO' || t.status === 'RECEBIDO';
    const novoStatus = isConcluido
      ? 'PENDENTE'
      : t.tipo === 'RECEBIMENTO'
      ? 'RECEBIDO'
      : 'PAGO';

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
      showNotice('Lançamento excluído!');
      fetchAllData();
    } catch (err) {
      showNotice(`Erro ao excluir: ${err.message}`, 'error');
    }
  };

  // ==========================================
  // 5. OCR DE NOTAS FISCAIS COM GEMINI API
  // ==========================================
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64Data = result.split(',')[1];
        resolve({ base64Data, dataUrl: result, mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!GEMINI_API_KEY) {
      showNotice('Configure VITE_GEMINI_API_KEY no arquivo .env para usar a leitura via IA.', 'error');
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
            type: 'image',
            mime_type: mimeType,
            data: base64Data,
          },
          {
            type: 'text',
            text: `Analise esta foto de Nota Fiscal / Cupom Fiscal brasileiro (NFC-e, NF-e ou SAT) e extraia todos os dados estruturados.
Classifique cada item e a categoria geral usando uma destas categorias: ${CATEGORIAS_DESPESA.join(', ')}.
Para data_emissao, retorne no formato YYYY-MM-DD (se não encontrar o ano, use o ano atual).
Para forma_pagamento, normalize para uma destas: PIX, Cartão de Crédito, Cartão de Débito, Dinheiro, Boleto ou Outros.`,
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
                    },
                    required: [
                      'descricao_item',
                      'quantidade',
                      'unidade',
                      'valor_unitario',
                      'valor_total',
                      'categoria_item',
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
        conta_id: contas[0]?.id || '',
        cartao_id: '',
        status_pagamento: 'PAGO',
        itens: Array.isArray(parsed.itens) ? parsed.itens : [],
      });

      showNotice('Cupom fiscal lido com sucesso pela IA! Confira os dados abaixo.');
    } catch (err) {
      console.error('Erro na leitura OCR via Gemini:', err);
      showNotice(`Falha ao ler nota fiscal: ${err.message}`, 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleConfirmAndSaveNota = async (e) => {
    e.preventDefault();
    if (!supabase || !extractedNota) return;

    setOcrLoading(true);
    try {
      // 1. Criar lançamento automático em transacoes (PAGAMENTO)
      const transacaoPayload = {
        tipo: 'PAGAMENTO',
        descricao: `NF: ${extractedNota.estabelecimento}`,
        categoria: extractedNota.categoria_geral || CATEGORIAS_DESPESA[0],
        valor: Number(extractedNota.valor_total) || 0,
        data_competencia: extractedNota.data_emissao,
        data_pagamento:
          extractedNota.status_pagamento === 'PAGO' ? extractedNota.data_emissao : null,
        forma_pagamento: extractedNota.forma_pagamento,
        status: extractedNota.status_pagamento,
        conta_id: extractedNota.conta_id || null,
        cartao_id: extractedNota.cartao_id || null,
      };

      const { data: novaTransacao, error: errTrans } = await supabase
        .from('transacoes')
        .insert([transacaoPayload])
        .select()
        .single();

      if (errTrans) throw errTrans;

      // 2. Criar registro em notas_fiscais vinculado à transacao_id
      const notaPayload = {
        estabelecimento: extractedNota.estabelecimento,
        cnpj: extractedNota.cnpj,
        data_emissao: extractedNota.data_emissao,
        valor_total: Number(extractedNota.valor_total) || 0,
        desconto: Number(extractedNota.desconto) || 0,
        forma_pagamento: extractedNota.forma_pagamento,
        chave_acesso: extractedNota.chave_acesso,
        url_comprovante: null,
        transacao_id: novaTransacao.id,
      };

      const { data: novaNota, error: errNota } = await supabase
        .from('notas_fiscais')
        .insert([notaPayload])
        .select()
        .single();

      if (errNota) throw errNota;

      // 3. Inserir todos os itens em itens_nota
      if (extractedNota.itens && extractedNota.itens.length > 0) {
        const itensPayload = extractedNota.itens.map((item) => ({
          nota_id: novaNota.id,
          descricao_item: item.descricao_item || 'Item',
          quantidade: Number(item.quantidade) || 1,
          unidade: item.unidade || 'UN',
          valor_unitario: Number(item.valor_unitario) || 0,
          valor_total: Number(item.valor_total) || 0,
          categoria_item: item.categoria_item || extractedNota.categoria_geral || 'Outros',
        }));

        const { error: errItens } = await supabase.from('itens_nota').insert(itensPayload);
        if (errItens) throw errItens;
      }

      showNotice('Nota fiscal, itens e pagamento lançados com sucesso!');
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
  // NAVEGAÇÃO (5 ABAS)
  // ==========================================
  const navItems = [
    { id: 'recebimentos', label: 'Recebimentos', icon: ArrowUpCircle },
    { id: 'pagamentos', label: 'Pagamentos', icon: ArrowDownCircle },
    { id: 'notas', label: 'Notas IA', icon: Receipt },
    { id: 'contas', label: 'Contas', icon: Wallet },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
  ];

  const getContaNome = (id) => contas.find((c) => c.id === id)?.nome_banco || null;
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
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 text-white">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">IazFinanças</h1>
            <p className="text-xs text-slate-400">Gestão & Notas com IA</p>
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
          {/* ALERTA CASO .ENV NÃO ESTEJA CONFIGURADO */}
          {(!SUPABASE_URL || !SUPABASE_ANON_KEY) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Configuração pendente do arquivo .env</p>
                <p className="text-amber-700 mt-0.5">
                  Copie o arquivo <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">.env.example</code> para{' '}
                  <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">.env</code> e preencha{' '}
                  <code className="font-mono">VITE_SUPABASE_URL</code>,{' '}
                  <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> e{' '}
                  <code className="font-mono">VITE_GEMINI_API_KEY</code>.
                </p>
              </div>
            </div>
          )}

          {/* HEADER + SELETOR DE MÊS */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {navItems.find((i) => i.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-slate-500">
                Controle financeiro unificado e leitura inteligente de cupons fiscais
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm font-medium text-slate-800 focus:outline-none bg-transparent"
              />
            </div>
          </header>

          {/* CARDS DE RESUMO MENSAL */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
                <span>Saldo Inicial (Contas)</span>
                <Wallet className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatCurrency(resumo.saldoInicialContas)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {contas.filter((c) => c.ativo !== false).length} conta(s) ativa(s)
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-700 text-xs font-medium uppercase tracking-wider">
                <span>Recebimentos ({selectedMonth})</span>
                <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {formatCurrency(resumo.totalRecebimentos)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Confirmado: {formatCurrency(resumo.totalRecebidoConfirmado)}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-rose-700 text-xs font-medium uppercase tracking-wider">
                <span>Pagamentos ({selectedMonth})</span>
                <ArrowDownCircle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-rose-600 mt-2">
                {formatCurrency(resumo.totalPagamentos)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Pago: {formatCurrency(resumo.totalPagoConfirmado)}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
                <span>Balanço do Mês</span>
                <Sparkles className="w-4 h-4 text-indigo-500" />
              </div>
              <p
                className={`text-2xl font-bold mt-2 ${
                  resumo.resultadoMes >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(resumo.resultadoMes)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Receitas menos despesas</p>
            </div>
          </section>

          {/* ==========================================
              ABA 1 & 2: RECEBIMENTOS OU PAGAMENTOS DO MÊS
          ========================================== */}
          {(activeTab === 'recebimentos' || activeTab === 'pagamentos') && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {activeTab === 'recebimentos'
                      ? 'Recebimentos do Mês'
                      : 'Pagamentos do Mês'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Competência selecionada: {selectedMonth}
                  </p>
                </div>

                <button
                  onClick={() =>
                    openNewTransacaoModal(
                      activeTab === 'recebimentos' ? 'RECEBIMENTO' : 'PAGAMENTO'
                    )
                  }
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-xs cursor-pointer transition ${
                    activeTab === 'recebimentos'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Novo {activeTab === 'recebimentos' ? 'Recebimento' : 'Pagamento'}
                  </span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {(activeTab === 'recebimentos' ? recebimentosDoMes : pagamentosDoMes)
                  .length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    Nenhum lançamento encontrado para {selectedMonth}.
                  </div>
                ) : (
                  (activeTab === 'recebimentos'
                    ? recebimentosDoMes
                    : pagamentosDoMes
                  ).map((t) => {
                    const isConcluido = t.status === 'PAGO' || t.status === 'RECEBIDO';
                    const contaNome = getContaNome(t.conta_id);
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
                              {contaNome && <span>• Conta: {contaNome}</span>}
                              {cartaoNome && <span>• Cartão: {cartaoNome}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <p
                              className={`font-bold text-sm ${
                                t.tipo === 'RECEBIMENTO'
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {t.tipo === 'RECEBIMENTO' ? '+' : '-'}{' '}
                              {formatCurrency(t.valor)}
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
              ABA 3: LEITURA DE NOTAS / CUPONS FISCAIS (GEMINI OCR)
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
                      Escanear Nota ou Cupom Fiscal
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Tire uma foto ou envie a imagem do cupom. A IA identifica o CNPJ, itens, categorias e gera o pagamento automaticamente.
                    </p>
                  </div>

                  <label className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs cursor-pointer transition shrink-0">
                    {ocrLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processando IA...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        <span>Enviar / Fotografar Cupom</span>
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
                </div>

                {/* REVISÃO DOS DADOS EXTRAÍDOS PELA IA */}
                {extractedNota && (
                  <form
                    onSubmit={handleConfirmAndSaveNota}
                    className="mt-6 pt-6 border-t border-slate-200 space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Revisão dos Dados Extraídos</span>
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
                      {previewImage && (
                        <div className="md:col-span-1">
                          <img
                            src={previewImage}
                            alt="Cupom Fiscal"
                            className="w-full max-h-72 object-contain rounded-xl border border-slate-200 bg-slate-50"
                          />
                        </div>
                      )}

                      <div
                        className={`${
                          previewImage ? 'md:col-span-2' : 'md:col-span-3'
                        } grid grid-cols-1 sm:grid-cols-2 gap-3`}
                      >
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Estabelecimento
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
                            Data de Emissão
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
                            Vincular Conta / Cartão
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={extractedNota.conta_id}
                              onChange={(e) =>
                                setExtractedNota({
                                  ...extractedNota,
                                  conta_id: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                            >
                              <option value="">Sem Conta</option>
                              {contas.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome_banco}
                                </option>
                              ))}
                            </select>
                            <select
                              value={extractedNota.cartao_id}
                              onChange={(e) =>
                                setExtractedNota({
                                  ...extractedNota,
                                  cartao_id: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
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
                    </div>

                    {/* ITENS EXTRAÍDOS DO CUPOM */}
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Itens Identificados ({extractedNota.itens.length})
                      </h5>
                      <div className="border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Item</th>
                              <th className="py-2.5 px-3">Qtd</th>
                              <th className="py-2.5 px-3">V. Unit</th>
                              <th className="py-2.5 px-3">Total</th>
                              <th className="py-2.5 px-3">Categoria IA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {extractedNota.itens.map((it, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  {it.descricao_item}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {it.quantidade} {it.unidade}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {formatCurrency(it.valor_unitario)}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {formatCurrency(it.valor_total)}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">
                                    {it.categoria_item}
                                  </span>
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
                        <span>Confirmar e Gerar Pagamento no Mês</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

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
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <div className="text-right">
                                <p className="font-bold text-slate-900 text-sm">
                                  {formatCurrency(nf.valor_total)}
                                </p>
                                {Number(nf.desconto) > 0 && (
                                  <p className="text-[11px] text-emerald-600">
                                    Desc: {formatCurrency(nf.desconto)}
                                  </p>
                                )}
                              </div>

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
                                    <th className="py-1.5 px-2">Categoria</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/50">
                                  {itensDaNota.map((item) => (
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
                                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-600">
                                          {item.categoria_item}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
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
              ABA 4: CONTAS BANCÁRIAS (contas_bancarias)
          ========================================== */}
          {activeTab === 'contas' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleSaveConta}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 self-start"
              >
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <span>
                    {contaForm.id ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
                  </span>
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nome do Banco / Instituição
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Itaú, Nubank, Caixa..."
                    value={contaForm.nome_banco}
                    onChange={(e) =>
                      setContaForm({ ...contaForm, nome_banco: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Tipo de Conta
                  </label>
                  <select
                    value={contaForm.tipo_conta}
                    onChange={(e) =>
                      setContaForm({ ...contaForm, tipo_conta: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="CORRENTE">Conta Corrente</option>
                    <option value="POUPANCA">Poupança</option>
                    <option value="INVESTIMENTO">Investimento / Corretora</option>
                    <option value="CARTEIRA">Carteira / Caixa Físico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={contaForm.saldo_inicial}
                    onChange={(e) =>
                      setContaForm({ ...contaForm, saldo_inicial: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contaForm.ativo}
                    onChange={(e) =>
                      setContaForm({ ...contaForm, ativo: e.target.checked })
                    }
                    className="rounded text-emerald-600"
                  />
                  <span>Conta ativa</span>
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                  >
                    {contaForm.id ? 'Salvar Alterações' : 'Cadastrar Conta'}
                  </button>
                  {contaForm.id && (
                    <button
                      type="button"
                      onClick={() =>
                        setContaForm({
                          id: null,
                          nome_banco: '',
                          tipo_conta: 'CORRENTE',
                          saldo_inicial: '',
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
                    Contas Cadastradas ({contas.length})
                  </h3>
                </div>
                {contas.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    Nenhuma conta bancária cadastrada.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {contas.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 sm:px-6 flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 text-sm">
                              {c.nome_banco}
                            </p>
                            {!c.ativo && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                Inativa
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{c.tipo_conta}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 text-sm">
                            {formatCurrency(c.saldo_inicial)}
                          </span>
                          <button
                            onClick={() =>
                              setContaForm({
                                id: c.id,
                                nome_banco: c.nome_banco,
                                tipo_conta: c.tipo_conta,
                                saldo_inicial: c.saldo_inicial,
                                ativo: c.ativo !== false,
                              })
                            }
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteConta(c.id)}
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

          {/* ==========================================
              ABA 5: CARTÕES (cartoes)
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

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Conta Bancária Vinculada
                  </label>
                  <select
                    value={cartaoForm.conta_id}
                    onChange={(e) =>
                      setCartaoForm({ ...cartaoForm, conta_id: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="">Nenhuma conta vinculada</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_banco}
                      </option>
                    ))}
                  </select>
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
                          conta_id: '',
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
                            {getContaNome(cr.conta_id)
                              ? ` • Conta: ${getContaNome(cr.conta_id)}`
                              : ''}
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
                                conta_id: cr.conta_id || '',
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

      {/* MODAL DE NOVA / EDITAR TRANSAÇÃO */}
      {showTransacaoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTransacao}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">
                {transacaoForm.id ? 'Editar' : 'Novo'}{' '}
                {transacaoForm.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Pagamento'}
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
                  placeholder="Ex: Salário Mensal, Supermercado, Energia..."
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
                    {(transacaoForm.tipo === 'RECEBIMENTO'
                      ? CATEGORIAS_RECEITA
                      : CATEGORIAS_DESPESA
                    ).map((cat) => (
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
                    Data de Pagamento/Recebimento
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
                    <option value="PENDENTE">PENDENTE</option>
                    {transacaoForm.tipo === 'RECEBIMENTO' ? (
                      <option value="RECEBIDO">RECEBIDO</option>
                    ) : (
                      <option value="PAGO">PAGO</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Conta Bancária
                  </label>
                  <select
                    value={transacaoForm.conta_id}
                    onChange={(e) =>
                      setTransacaoForm({ ...transacaoForm, conta_id: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="">Nenhuma</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_banco}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Cartão
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

      {/* BOTTOM BAR MOBILE */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 flex items-center justify-around py-1.5 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[11px] font-medium transition cursor-pointer ${
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
