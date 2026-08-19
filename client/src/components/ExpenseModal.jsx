import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, ArrowLeft, Loader2, Check, Receipt, Upload, Trash2,
  Utensils, ShoppingBag, Car, Clapperboard, Stethoscope, GraduationCap,
  Zap, Repeat, Plane, Home, Shield, MoreHorizontal, Smartphone, Banknote,
  CreditCard, Landmark, Wallet, Calendar,
} from 'lucide-react';
import api from '../lib/axios';

/**
 * Expense categories.
 * `value` maps directly to the backend TRANSACTION_CATEGORIES enum;
 * `label` is the display name; `icon` + `color` give the premium card tile.
 */
const EXPENSE_CATEGORIES = [
  { value: 'food', label: 'Food', icon: Utensils, color: '#FBBF24' },
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#FB7185' },
  { value: 'transport', label: 'Transport', icon: Car, color: '#22D3EE' },
  { value: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#818CF8' },
  { value: 'health', label: 'Medical', icon: Stethoscope, color: '#34D399' },
  { value: 'education', label: 'Education', icon: GraduationCap, color: '#2DD4BF' },
  { value: 'utilities', label: 'Bills', icon: Zap, color: '#FCD34D' },
  { value: 'subscriptions', label: 'Subscription', icon: Repeat, color: '#6366F1' },
  { value: 'travel', label: 'Travel', icon: Plane, color: '#A78BFA' },
  { value: 'rent', label: 'Rent', icon: Home, color: '#94A3B8' },
  { value: 'insurance', label: 'Insurance', icon: Shield, color: '#6EE7B7' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: '#64748B' },
];

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'credit-card', label: 'Credit Card', icon: CreditCard },
  { value: 'debit-card', label: 'Debit Card', icon: CreditCard },
  { value: 'net-banking', label: 'Net Banking', icon: Landmark },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

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

const formatDateShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Sanitize an amount while the user is editing.
 * Keeps a controlled string — digits and a single decimal point.
 * Allows multi-digit values, decimals, backspace, delete, cursor movement,
 * select/replace and copy/paste. Rejects letters and invalid symbols.
 * The value is only parsed to a Number on submit — never on every keystroke.
 */
const sanitizeAmount = (raw) => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

const emptyForm = {
  amount: '',
  category: '',
  merchant: '',
  date: toDateInput(),
  paymentMethod: '',
  description: '',
  notes: '',
  receiptUrl: '',
  receiptName: '',
};

export default function ExpenseModal({ open, initialData, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef(null);
  const savedRef = useRef(false);

  const isEditing = !!initialData;
  const selectedCategory = EXPENSE_CATEGORIES.find((c) => c.value === form.category) || null;

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
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
      setForm(emptyForm);
    }
    setStep(0);
    setErrors({});
    setFormError('');
    setUploadError('');
    setSaving(false);
    setSaveSuccess(false);
    savedRef.current = false;
  }, [open, initialData]);

  const selectCategory = (value) => {
    setForm((f) => ({ ...f, category: value }));
    setErrors((e) => ({ ...e, category: undefined }));
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

  const validateAmount = () => {
    const amountStr = (form.amount || '').trim();
    if (!amountStr) return 'Please enter an amount.';
    const n = parseFloat(amountStr);
    if (isNaN(n) || n <= 0) return 'Amount must be greater than ₹0.';
    return '';
  };

  const validateStep1 = () => {
    const errs = {};
    if (!form.category) errs.category = 'Please select a category.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSave = () => {
    const errs = {};
    const amountErr = validateAmount();
    if (amountErr) errs.amount = amountErr;
    if (!form.category) errs.category = 'Please select a category.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (validateStep1()) {
      setFormError('');
      setStep(1);
    }
  };

  const handleBack = () => {
    setFormError('');
    setStep(0);
  };

  const expenseErrorMessage = (err) => {
    if (!err || !err.response) return 'Unable to save this expense right now. Please try again.';
    const status = err.response.status;
    const data = err.response.data;
    const msg = data?.error?.message || data?.message;
    const fieldMsg = Array.isArray(data?.errors) && data.errors[0]?.message ? data.errors[0].message : undefined;
    if (status === 400) return fieldMsg || msg || 'Please check the entered details.';
    if (status === 429) return msg || 'Too many requests. Please try again later.';
    return 'Unable to save this expense right now. Please try again.';
  };

  const handleSave = async () => {
    if (saving || saveSuccess || savedRef.current) return;
    if (!validateSave()) return;

    const payload = {
      type: 'expense',
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
      savedRef.current = true;
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(onSaved, 500);
    } catch (err) {
      setSaving(false);
      setFormError(expenseErrorMessage(err));
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

  const SelectedIcon = selectedCategory?.icon || MoreHorizontal;
  const paymentLabel = PAYMENT_METHODS.find((m) => m.value === form.paymentMethod)?.label || '';

  const stepLabel = isEditing
    ? (step === 0 ? 'Edit Expense' : 'Expense Details')
    : (step === 0 ? 'Add Expense' : 'Expense Details');
  const stepSubtitle = step === 0 ? 'Where did your money go?' : 'Enter the details of this expense';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl shadow-black/50"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 sm:px-8 pt-6 sm:pt-7 pb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight">{stepLabel}</h2>
                <p className="text-sm text-gray-400 mt-1">{stepSubtitle}</p>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="text-gray-400 hover:text-white transition-colors p-1.5 -mr-1.5 rounded-lg hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress */}
            <div className="px-6 sm:px-8 pt-2 pb-4">
              <div className="flex items-center gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        step >= i ? 'bg-primary' : 'bg-white/10'
                      }`}
                      style={{ width: i === 0 ? 'calc(100% - 24px)' : '100%' }}
                    />
                    {i === 0 && <div className="h-1.5 w-3 rounded-full bg-primary/30" />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 mt-1.5 px-0.5">
                <span className={step === 0 ? 'text-primary-light font-medium' : ''}>Category</span>
                <span className={step === 1 ? 'text-primary-light font-medium' : ''}>Details</span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-2 pb-4">
              {formError && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl mb-4">
                  {formError}
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {step === 0 ? (
                  <motion.div key="step1"
                    initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }}
                    transition={{ duration: 0.2 }} className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      {EXPENSE_CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const selected = form.category === cat.value;
                        return (
                          <motion.button
                            key={cat.value}
                            type="button"
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => selectCategory(cat.value)}
                            className={`relative group rounded-2xl p-3.5 sm:p-4 flex flex-col items-center gap-2 border transition-colors duration-200 ${
                              selected
                                ? 'bg-primary/10 border-primary/60 shadow-lg shadow-primary/20'
                                : 'bg-surface-light border-white/5 hover:bg-surface-lighter hover:border-white/20 hover:shadow-lg hover:shadow-black/30'
                            }`}
                          >
                            <span className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                              selected ? 'bg-primary/25' : 'bg-white/5 group-hover:bg-white/10'
                            }`}>
                              <Icon className="w-5 h-5" style={{ color: selected ? '#C7D2FE' : cat.color }} />
                            </span>
                            <span className={`text-xs font-medium ${selected ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                              {cat.label}
                            </span>
                            {selected && (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md shadow-primary/40">
                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                              </motion.span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                    {errors.category && <p className="text-danger text-xs mt-2">{errors.category}</p>}
                  </motion.div>
                ) : (
                  <motion.div key="step2"
                    initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.2 }} className="space-y-5">
                    {/* Summary card */}
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                          <SelectedIcon className="w-5 h-5 text-primary-light" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{selectedCategory?.label || 'Expense'}</p>
                          <p className="text-xs text-gray-500">Expense</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold font-display">{formatMoney(form.amount)}</p>
                    </motion.div>

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

                    {/* Merchant */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Merchant</label>
                      <input value={form.merchant} onChange={handleChange('merchant')} placeholder="e.g. Starbucks"
                        className="input-field" />
                    </div>

                    {/* Date + Payment */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Date</label>
                        <div className="relative">
                          <input type="date" value={form.date} onChange={handleChange('date')} className="input-field" />
                          <Calendar className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
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
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Description <span className="text-gray-600">(optional)</span></label>
                      <input value={form.description} onChange={handleChange('description')} placeholder="e.g. Coffee with friends"
                        className="input-field" />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Notes <span className="text-gray-600">(optional)</span></label>
                      <textarea value={form.notes} onChange={handleChange('notes')} rows={2} placeholder="Anything you want to remember"
                        className="input-field resize-none" />
                    </div>

                    {/* Receipt */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Receipt <span className="text-gray-600">(optional)</span></label>
                      {form.receiptUrl ? (
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-surface-light px-4 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Receipt className="w-4 h-4 text-success" />
                            <span className="text-gray-300 truncate max-w-[220px]">{form.receiptName || 'Receipt attached'}</span>
                          </div>
                          <button onClick={removeReceipt} aria-label="Remove receipt" className="text-gray-400 hover:text-danger transition-colors">
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

                    {/* Review */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Review</p>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-gray-500">Type</dt><dd className="font-medium">Expense</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500">Category</dt><dd className="font-medium capitalize">{selectedCategory?.label || '—'}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500">Amount</dt><dd className="font-medium">{formatMoney(form.amount)}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500">Merchant</dt><dd className="font-medium">{form.merchant || '—'}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500">Payment</dt><dd className="font-medium">{paymentLabel || '—'}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd className="font-medium">{formatDateShort(form.date)}</dd></div>
                      </dl>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 sm:px-8 py-4 border-t border-white/5 bg-black/20">
              {step === 0 ? (
                <>
                  <button onClick={onClose} className="btn-secondary !py-2.5 !px-5">Cancel</button>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={handleContinue}
                    className="btn-primary !py-2.5 !px-6 flex items-center gap-2">
                    Continue <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </>
              ) : (
                <>
                  <button onClick={handleBack} className="btn-secondary !py-2.5 !px-5 flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={handleSave} disabled={saving || uploadingReceipt || saveSuccess}
                    className={`${saveSuccess ? 'bg-success text-white shadow-lg shadow-success/30' : 'btn-primary'} !py-2.5 !px-6 flex items-center gap-2 disabled:opacity-70`}>
                    {saveSuccess ? (
                      <><Check className="w-4 h-4" /> Saved</>
                    ) : saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                      <>Save Expense</>
                    )}
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
