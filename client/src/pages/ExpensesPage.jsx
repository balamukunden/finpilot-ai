import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Pencil, X, Check, ArrowUpRight } from 'lucide-react';
import api from '../lib/axios';
import ExpenseModal from '../components/ExpenseModal';
import TransactionWizard from '../components/TransactionWizard';

const EMOJI = { food: '🍕', groceries: '🛒', transport: '🚗', entertainment: '🎬', shopping: '🛍️', utilities: '💡', rent: '🏠', health: '💊', education: '📚', travel: '✈️', subscriptions: '📱', insurance: '🛡️', investments: '📈', salary: '💰', freelance: '💻', gifts: '🎁', other: '📦' };

export default function ExpensesPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpense, setShowExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showIncome, setShowIncome] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [toast, setToast] = useState('');

  const fetchTransactions = async () => {
    try {
      const params = {};
      if (filterType) params.type = filterType;
      const { data } = await api.get('/transactions', { params });
      setTransactions(data.data.transactions);
    } catch {
      setTransactions([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTransactions(); }, [filterType]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setShowExpense(true);
  };

  const handleAddIncome = () => {
    setEditingIncome(null);
    setShowIncome(true);
  };

  const handleEdit = (t) => {
    if (t.type === 'income') {
      setEditingIncome(t);
      setShowIncome(true);
    } else {
      setEditingExpense(t);
      setShowExpense(true);
    }
  };

  const handleExpenseSaved = () => {
    setShowExpense(false);
    setEditingExpense(null);
    fetchTransactions();
    showToast(editingExpense ? 'Expense updated successfully' : 'Expense added successfully');
  };

  const handleIncomeSaved = () => {
    setShowIncome(false);
    setEditingIncome(null);
    fetchTransactions();
    showToast(editingIncome ? 'Transaction updated successfully' : 'Income added successfully');
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      fetchTransactions();
      showToast('Transaction deleted');
    } catch {}
  };

  const fmt = (n) => `₹${n?.toLocaleString('en-IN')}`;
  const filtered = transactions.filter((t) =>
    (t.merchant?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold font-display">Expenses</motion.h1>
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleAddIncome} className="btn-secondary !py-2 !px-3 flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4 text-success" /> <span className="text-sm">Income</span>
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleAddExpense} className="btn-primary !py-2 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Expense
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..."
            className="input-field !pl-10 !py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          {['', 'income', 'expense'].map((type) => (
            <button key={type} onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filterType === type ? 'bg-primary text-white' : 'bg-surface-light text-gray-400 hover:text-white'}`}>
              {type === '' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {loading ? [...Array(5)].map((_, i) => <div key={i} className="glass-card animate-pulse h-16" />) :
          filtered.length === 0 ? (
            <div className="glass-card text-center py-12 text-gray-400">No transactions yet. Add your first one!</div>
          ) : filtered.map((t, i) => (
            <motion.div key={t.id || t._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }} className="glass-card !p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${t.type === 'income' ? 'bg-success/20' : 'bg-danger/20'}`}>
                  {EMOJI[t.category] || '📦'}
                </div>
                <div>
                  <p className="font-medium text-sm">{t.merchant || t.description || t.category}</p>
                  <p className="text-xs text-gray-500 capitalize">{t.category} • {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-semibold ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </span>
                <button onClick={() => handleEdit(t)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-primary-light transition-all" aria-label="Edit transaction">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(t.id || t._id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-danger transition-all" aria-label="Delete transaction">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
      </div>

      {/* Add / Edit Expense Modal */}
      <ExpenseModal
        open={showExpense}
        initialData={editingExpense}
        onClose={() => { setShowExpense(false); setEditingExpense(null); }}
        onSaved={handleExpenseSaved}
      />

      {/* Add / Edit Income Modal */}
      <TransactionWizard
        open={showIncome}
        initialData={editingIncome}
        initialType="income"
        onClose={() => { setShowIncome(false); setEditingIncome(null); }}
        onSaved={handleIncomeSaved}
      />

      {/* Success Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 glass-card !p-3 !px-4 text-sm text-white">
            <Check className="w-4 h-4 text-success" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
