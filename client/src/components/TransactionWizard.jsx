import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, ArrowLeft, Loader2, Receipt, Upload, Check, Trash2,
} from 'lucide-react';
import api from '../lib/axios';

const EXPENSE_CATEGORIES = [
  'food', 'groceries', 'transport', 'entertainment', 'shopping', 'utilities',
  'rent', 'health', 'education', 'travel', 'subscriptions', 'insurance',
  'gifts', 'other',
];

const INCOME_CATEGORIES = ['salary', 'freelance', 'investments', 'gifts', 'other'];

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'debit-card', label: 'Debit Card' },
  { value: 'net-banking', label: 'Net Banking' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'other', label: 'Other' },
];

const EMOJI = {
  food: '🍕', groceries: '🛒', transport: '🚗', entertainment: '🎬', shopping: '🛍️',
  utilities: '💡', rent: '🏠', health: '💊', education: '📚', travel: '✈️',
  subscriptions: '📱', insurance: '🛡️', investments: '📈', salary: '💰',
  freelance: '💻', gifts: '🎁', other: '📦',
};

const categoryLabel = (c) => c.charAt(0).toUpperCase() + c.slice(1);
const toDateInput = (iso) => {
  if (!iso) return new Date().toISOString().split('T')[0];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0];
};
const formatMoney = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '₹0.00';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Sanitize an amount while the user is editing.
 * Keeps a controlled string — digits and a single decimal point.
 * Allows multi-digit values, decimals, backspace, delete, cursor movement,
 * select/replace and copy/paste. Rejects letters and invalid symbols.
 */
const sanitizeAmount = (raw) => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

export default function TransactionWizard({ open, initialData, initialType, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: 'expense', amount: '', category: '', merchant: '', date: toDateInput(),
    paymentMethod: '', description: '', notes: '', receiptUrl: '', receiptName: '',
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef(null);

  const isEditing = !!initialData;

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        type: initialData.type || 'expense',
        amount: initialData.amount != null ? String(initialData.amount) : '',
        category: initialData.category || '',
        merchant: initialData.merchant || '',
        date: toDateInput(initialData.date),
        paymentMethod: initialData.paymentMethod || '',
        description: initialData.description || '',
        notes: initialData.notes || '',
        receiptUrl: initialData.receiptUrl || '',
        receiptName: initialData.receiptUrl ? initialData.receiptUrl.split('/').pop() : '',
      });
    } else {
      setForm({
        type: initialType || 'expense', amount: '', category: '', merchant: '', date: toDateInput(),
        paymentMethod: '', description: '', notes: '', receiptUrl: '', receiptName: '',
      });
    }
    setStep(0);
    setErrors({});
    setFormError('');
    setUploadError('');
    setSaving(false);
  }, [open, initialData]);

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeChange = (type) => {
    setForm((f) => {
      const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const category = list.includes(f.category) ? f.category : '';
      return { ...f, type, category };
    });
    setErrors((e) => ({ ...e, type: undefined, category: undefined }));
  };

  const handleAmountChange = (e) => {
    setForm((f) => ({ ...f, amount: sanitizeAmount(e.target.value) }));
    setErrors((er) => ({ ...er, amount: undefined }));
  };

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setFormError('');
  };

  const validateStep = () => {
    const errs = {};
    const amountStr = (form.amount || '').trim();
    if (!amountStr) errs.amount = 'Please enter an amount.';
    else {
      const n = parseFloat(amountStr);
      if (isNaN(n) || n <= 0) errs.amount = 'Amount must be greater than ₹0.';
    }
    if (!form.category) errs.category = 'Please select a category.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (validateStep()) {
      setFormError('');
      setStep(1);
    }
  };

  const handleBack = () => {
    setFormError('');
    setStep(0);
  };

  const transactionErrorMessage = (err) => {
    if (!err || !err.response) return 'Could not save the transaction. The server is unavailable.';
    const status = err.response.status;
    const data = err.response.data;
    const msg = data?.error?.message || data?.message;
    const fieldMsg = Array.isArray(data?.errors) && data.errors[0]?.message ? data.errors[0].message : undefined;
    if (status === 400) return fieldMsg || msg || 'Please check the entered details.';
    if (status === 429) return msg || 'Too many requests. Please try again later.';
    return 'Transaction could not be saved. Please try again.';
  };

  const handleSave = async () => {
    if (uploadingReceipt) return;
    if (!validateStep()) { setStep(0); return; }

    const payload = {
      type: form.type,
      amount: parseFloat(form.amount),
      category: form.category,
      merchant: form.merchant.trim(),
      date: form.date,
      paymentMethod: form.paymentMethod,
      description: form.description.trim(),
      notes: form.notes.trim(),
      ...(form.receiptUrl ? { receiptUrl: form.receiptUrl } : {}),
    };

    setSaving(true);
    setFormError('');
    try {
      if (isEditing) {
        await api.put(`/transactions/${initialData.id || initialData._id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      onSaved();
    } catch (err) {
      setFormError(transactionErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowed = /jpeg|jpg|png|webp|pdf/i;
    if (!allowed.test(file.type) && !allowed.test(file.name.split('.').pop())) {
      setUploadError('Only images (JPEG, PNG, WebP) and PDF files are allowed.');
      return;
    }
    setUploadingReceipt(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const { data } = await api.post('/scanner/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((f) => ({
        ...f,
        receiptUrl: data.data.file.url,
        receiptName: data.data.file.name || file.name,
      }));
    } catch {
      setUploadError('Could not upload the receipt. Please try again.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const removeReceipt = () => {
    setForm((f) => ({ ...f, receiptUrl: '', receiptName: '' }));
    setUploadError('');
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-lg glass-card !p-0 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <h3 className="text-lg font-bold font-display">
                {isEditing ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center gap-3 px-6 pb-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3 flex-1 last:flex-none">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        backgroundColor: step >= i ? (step > i ? '#34D399' : '#6366F1') : 'rgba(255,255,255,0.08)',
                        color: step >= i ? '#fff' : '#64748B',
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${step > i ? 'bg-success' : step === i ? 'bg-primary' : 'bg-white/10 text-gray-500'}`}
                    >
                      {step > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </motion.div>
                    <span className={`text-sm ${step === i ? 'text-white font-medium' : 'text-gray-400'}`}>
                      {i === 0 ? 'Basic Details' : 'Transaction Details'}
                    </span>
                  </div>
                  {i === 0 && <div className={`h-px flex-1 transition-colors ${step > 0 ? 'bg-success/50' : 'bg-white/10'}`} />}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {formError && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl mb-4">
                  {formError}
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {step === 0 ? (
                  <motion.div key="step1"
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.18 }} className="space-y-5">
                    {/* Type */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Transaction Type</label>
                      <div className="flex gap-2">
                        {['expense', 'income'].map((t) => (
                          <button key={t} type="button" onClick={() => handleTypeChange(t)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              form.type === t
                                ? (t === 'expense' ? 'bg-danger text-white shadow-lg shadow-danger/20' : 'bg-success text-white shadow-lg shadow-success/20')
                                : 'bg-surface-light text-gray-400 hover:text-white'
                            }`}>
                            {t === 'expense' ? 'Expense' : 'Income'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-500 font-medium">₹</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={form.amount}
                          onChange={handleAmountChange}
                          placeholder="0.00"
                          className="input-field !pl-11 !py-4 text-2xl font-semibold tracking-tight"
                        />
                      </div>
                      {errors.amount && <p className="text-danger text-xs mt-1.5">{errors.amount}</p>}
                    </div>

                    {/* Category */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                        {form.type === 'income' ? 'Income Source' : 'Category'}
                      </label>
                      <select value={form.category} onChange={handleChange('category')} className="input-field">
                        <option value="" disabled>Select {form.type === 'income' ? 'source' : 'category'}</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{EMOJI[c]} {categoryLabel(c)}</option>
                        ))}
                      </select>
                      {errors.category && <p className="text-danger text-xs mt-1.5">{errors.category}</p>}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="step2"
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }} className="space-y-5">
                    {/* Summary card */}
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl p-4 border border-white/10 bg-gradient-to-br from-primary/10 via-surface-light to-surface flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold font-display">{formatMoney(form.amount)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          <span className={form.type === 'expense' ? 'text-danger' : 'text-success'}>
                            {form.type === 'expense' ? 'Expense' : 'Income'}
                          </span>
                          {form.category && <> • {EMOJI[form.category]} {categoryLabel(form.category)}</>}
                        </p>
                      </div>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${form.type === 'expense' ? 'bg-danger/15' : 'bg-success/15'}`}>
                        {EMOJI[form.category] || (form.type === 'expense' ? '💸' : '💰')}
                      </div>
                    </motion.div>

                    {/* Category confirmation / income source */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                        {form.type === 'income' ? 'Income Source' : 'Category Confirmation'}
                      </label>
                      <select value={form.category} onChange={handleChange('category')} className="input-field">
                        {categories.map((c) => (
                          <option key={c} value={c}>{EMOJI[c]} {categoryLabel(c)}</option>
                        ))}
                      </select>
                      {errors.category && <p className="text-danger text-xs mt-1.5">{errors.category}</p>}
                    </div>

                    {/* Merchant */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Merchant Name</label>
                      <input value={form.merchant} onChange={handleChange('merchant')} placeholder="e.g. Starbucks"
                        className="input-field" />
                    </div>

                    {/* Date + Payment */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Date</label>
                        <input type="date" value={form.date} onChange={handleChange('date')} className="input-field" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Payment Method</label>
                        <select value={form.paymentMethod} onChange={handleChange('paymentMethod')} className="input-field">
                          <option value="" disabled>Select method</option>
                          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Description</label>
                      <input value={form.description} onChange={handleChange('description')} placeholder="e.g. Coffee with friends"
                        className="input-field" />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Notes</label>
                      <textarea value={form.notes} onChange={handleChange('notes')} rows={2} placeholder="Anything you want to remember"
                        className="input-field resize-none" />
                    </div>

                    {/* Receipt */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Receipt (optional)</label>
                      {form.receiptUrl ? (
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-surface-light px-4 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Receipt className="w-4 h-4 text-success" />
                            <span className="text-gray-300 truncate max-w-[220px]">{form.receiptName || 'Receipt attached'}</span>
                          </div>
                          <button onClick={removeReceipt} className="text-gray-400 hover:text-danger transition-colors" aria-label="Remove receipt">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingReceipt}
                          className="w-full rounded-xl border border-dashed border-white/15 bg-surface-light/40 hover:border-primary/40 hover:bg-surface-light transition-all px-4 py-4 flex items-center justify-center gap-2 text-sm text-gray-400 disabled:opacity-50">
                          {uploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploadingReceipt ? 'Uploading…' : 'Upload Receipt'}
                        </button>
                      )}
                      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                      {uploadError && <p className="text-danger text-xs mt-1.5">{uploadError}</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/5 bg-surface/30">
              {step === 0 ? (
                <>
                  <button onClick={onClose} className="btn-secondary !py-2.5">Cancel</button>
                  <button onClick={handleContinue} className="btn-primary !py-2.5 flex items-center gap-2">
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleBack} className="btn-secondary !py-2.5 flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={handleSave} disabled={saving || uploadingReceipt}
                    className="btn-primary !py-2.5 flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {saving ? 'Saving…' : 'Save Transaction'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
