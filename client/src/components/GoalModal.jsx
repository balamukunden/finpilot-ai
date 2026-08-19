import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Loader2, Check, Target, Calendar } from 'lucide-react';
import api from '../lib/axios';

/**
 * Goal types — matches the existing Create Goal visual language (emoji + color).
 * `type` maps directly to the backend GOAL_TYPES enum.
 */
const GOAL_TYPES = [
  { type: 'emergency-fund', icon: '🏦', label: 'Emergency Fund', color: '#34D399' },
  { type: 'vacation', icon: '✈️', label: 'Vacation', color: '#22D3EE' },
  { type: 'laptop', icon: '💻', label: 'Laptop', color: '#6366F1' },
  { type: 'bike', icon: '🏍️', label: 'Bike', color: '#FBBF24' },
  { type: 'car', icon: '🚗', label: 'Car', color: '#FB7185' },
  { type: 'house', icon: '🏠', label: 'House', color: '#818CF8' },
  { type: 'education', icon: '📚', label: 'Education', color: '#2DD4BF' },
  { type: 'custom', icon: '🎯', label: 'Custom Goal', color: '#94A3B8' },
];

const emptyForm = {
  type: '',
  name: '',
  targetAmount: '',
  currentAmount: '',
  targetDate: '',
  description: '',
  notes: '',
};

const toDateInput = (iso) => {
  if (!iso) return new Date().toISOString().split('T')[0];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0];
};

const todayInput = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0];
};

const formatMoney = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/**
 * Sanitize an amount while the user is editing.
 * Keeps a controlled string — digits and a single decimal point — so typing,
 * deleting, cursor movement, select/replace and paste all work. No maxLength.
 * Only parsed to a Number on submit.
 */
const sanitizeAmount = (raw) => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

const goalErrorMessage = (err) => {
  if (!err || !err.response) return 'Unable to create this goal right now. Please try again.';
  const status = err.response.status;
  const data = err.response.data;
  const msg = data?.error?.message || data?.message;
  const fieldMsg = Array.isArray(data?.errors) && data.errors[0]?.message ? data.errors[0].message : undefined;
  if (status === 400) return fieldMsg || msg || 'Please check the entered details.';
  if (status === 409) return 'Goal name is already in use.';
  if (status === 429) return msg || 'Too many requests. Please try again later.';
  if (status === 503) return 'Server is unavailable. Please try again.';
  return 'Unable to create this goal right now. Please try again.';
};

export default function GoalModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const savedRef = useRef(false);

  const selectedType = GOAL_TYPES.find((t) => t.type === form.type) || null;

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setStep(0);
    setErrors({});
    setFormError('');
    setSaving(false);
    setSaveSuccess(false);
    savedRef.current = false;
  }, [open]);

  const selectType = (goalType) => {
    const isStalePrefill = GOAL_TYPES.some((g) => g.label === form.name && form.type !== 'custom');
    const nextName = goalType.type === 'custom' ? '' : (form.name && !isStalePrefill ? form.name : goalType.label);
    setForm((f) => ({ ...f, type: goalType.type, name: nextName }));
    setErrors((e) => ({ ...e, type: undefined, name: undefined }));
  };

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setFormError('');
  };

  const handleAmountChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: sanitizeAmount(e.target.value) }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setFormError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.type) errs.type = 'Please select a goal type.';
    if (!form.name || !form.name.trim()) errs.name = 'Please enter a goal name.';

    const tStr = (form.targetAmount || '').trim();
    if (!tStr) errs.targetAmount = 'Please enter a target amount.';
    else {
      const t = parseFloat(tStr);
      if (isNaN(t) || t <= 0) errs.targetAmount = 'Target amount must be greater than ₹0.';
    }

    const cStr = (form.currentAmount || '').trim();
    if (cStr) {
      const c = parseFloat(cStr);
      const t = parseFloat(tStr);
      if (isNaN(c) || c < 0) errs.currentAmount = 'Current savings cannot be negative.';
      else if (!isNaN(t) && c > t) errs.currentAmount = 'Current savings cannot exceed the target amount.';
    }

    if (!form.targetDate) errs.targetDate = 'Please select a target date.';
    else {
      const d = new Date(form.targetDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(d.getTime())) errs.targetDate = 'Please select a valid target date.';
      else if (d < today) errs.targetDate = 'Target date must be today or in the future.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (!form.type) {
      setErrors((e) => ({ ...e, type: 'Please select a goal type.' }));
      return;
    }
    setErrors({});
    setFormError('');
    setStep(1);
  };

  const handleBack = () => {
    setFormError('');
    setErrors({});
    setStep(0);
  };

  const handleSave = async () => {
    if (saving || saveSuccess || savedRef.current) return;
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      type: form.type,
      targetAmount: parseFloat(form.targetAmount),
      currentAmount: form.currentAmount && form.currentAmount.trim() !== '' ? parseFloat(form.currentAmount) : 0,
      deadline: form.targetDate,
      icon: selectedType?.icon || '🎯',
      color: selectedType?.color || '#6366F1',
      ...(form.description && form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.notes && form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    setSaving(true);
    setFormError('');
    try {
      await api.post('/goals', payload);
      savedRef.current = true;
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(onSaved, 600);
    } catch (err) {
      setSaving(false);
      setFormError(goalErrorMessage(err));
    }
  };

  // Live progress preview
  const target = parseFloat(form.targetAmount);
  const current = parseFloat(form.currentAmount) || 0;
  const hasTarget = !isNaN(target) && target > 0;
  const progress = hasTarget ? Math.min((current / target) * 100, 100) : 0;
  const remaining = hasTarget ? Math.max(target - current, 0) : 0;

  // Monthly required saving estimate (clearly an estimate)
  const monthlyEstimate = (() => {
    if (!hasTarget || !form.targetDate || current >= target) return null;
    const d = new Date(form.targetDate);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    if (d <= now) return null;
    const months = Math.max(1, Math.ceil((d.getTime() - now.getTime()) / (30.44 * 24 * 3600 * 1000)));
    return Math.max(100, Math.ceil((target - current) / months / 100) * 100);
  })();

  const stepLabel = step === 0 ? 'Create Goal' : 'Create Goal';
  const stepSubtitle = step === 0 ? "Choose what you're saving for" : "Enter your goal's details";

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
            role="dialog"
            aria-modal="true"
            aria-label={step === 0 ? 'Create Goal — choose goal type' : 'Create Goal — goal details'}
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl shadow-black/50"
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

            {/* Progress indicator */}
            <div className="px-6 sm:px-8 pt-2 pb-4">
              <div className="flex items-center gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${step >= i ? 'bg-primary' : 'bg-white/10'}`}
                      style={{ width: i === 0 ? 'calc(100% - 24px)' : '100%' }}
                    />
                    {i === 0 && <div className="h-1.5 w-3 rounded-full bg-primary/30" />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 mt-1.5 px-0.5">
                <span className={step === 0 ? 'text-primary-light font-medium' : ''}>1 Choose Goal</span>
                <span className={step === 1 ? 'text-primary-light font-medium' : ''}>2 Goal Details</span>
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                      {GOAL_TYPES.map((gt) => {
                        const selected = form.type === gt.type;
                        return (
                          <motion.button
                            key={gt.type}
                            type="button"
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => selectType(gt)}
                            aria-pressed={selected}
                            className={`relative group rounded-2xl p-3.5 sm:p-4 flex flex-col items-center gap-2 border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                              selected
                                ? 'bg-primary/10 border-primary/60 shadow-lg shadow-primary/20 -translate-y-0.5'
                                : 'bg-surface-light border-white/5 hover:bg-surface-lighter hover:border-white/20 hover:shadow-lg hover:shadow-black/30'
                            }`}
                          >
                            <span className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                              selected ? 'bg-primary/25' : 'bg-white/5 group-hover:bg-white/10'
                            }`} style={{ fontSize: '1.25rem' }}>
                              {gt.icon}
                            </span>
                            <span className={`text-xs font-medium text-center leading-tight ${selected ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                              {gt.label}
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
                    {errors.type && <p className="text-danger text-xs mt-2">{errors.type}</p>}
                  </motion.div>
                ) : (
                  <motion.div key="step2"
                    initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.2 }} className="space-y-5">
                    {/* Compact summary */}
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ fontSize: '1.25rem', backgroundColor: `${selectedType?.color || '#6366F1'}22` }}>
                          {selectedType?.icon || '🎯'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{selectedType?.label || 'Goal'}</p>
                          <p className="text-xs text-gray-500">Savings goal</p>
                        </div>
                      </div>
                      <Target className="w-5 h-5 text-gray-500" />
                    </motion.div>

                    {/* Goal name */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Goal Name</label>
                      <input value={form.name} onChange={handleChange('name')}
                        placeholder={form.type === 'custom' ? 'e.g. New iPhone' : 'Goal name'}
                        className="input-field" />
                      {errors.name && <p className="text-danger text-xs mt-1.5">{errors.name}</p>}
                    </div>

                    {/* Amounts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Target Amount</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500 font-medium">₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={form.targetAmount}
                            onChange={handleAmountChange('targetAmount')}
                            placeholder="0"
                            className="input-field !pl-10 !py-3.5 text-xl font-semibold tracking-tight"
                          />
                        </div>
                        {errors.targetAmount && <p className="text-danger text-xs mt-1.5">{errors.targetAmount}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Current Saved <span className="text-gray-600">(optional)</span></label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500 font-medium">₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={form.currentAmount}
                            onChange={handleAmountChange('currentAmount')}
                            placeholder="0"
                            className="input-field !pl-10 !py-3.5 text-xl font-semibold tracking-tight"
                          />
                        </div>
                        {errors.currentAmount && <p className="text-danger text-xs mt-1.5">{errors.currentAmount}</p>}
                      </div>
                    </div>

                    {/* Target date */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Target Date</label>
                      <div className="relative">
                        <input type="date" min={todayInput()} value={form.targetDate} onChange={handleChange('targetDate')}
                          className="input-field" />
                        <Calendar className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {errors.targetDate && <p className="text-danger text-xs mt-1.5">{errors.targetDate}</p>}
                    </div>

                    {/* Live progress preview */}
                    <motion.div layout
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Goal Progress</p>
                      <div className="flex items-end justify-between mb-2">
                        <p className="text-sm">
                          <span className="font-semibold text-white">{formatMoney(hasTarget ? current : 0)}</span>
                          <span className="text-gray-500"> saved of </span>
                          <span className="font-semibold text-white">{formatMoney(hasTarget ? target : 0)}</span>
                        </p>
                        <p className="text-sm font-semibold text-primary-light">{progress.toFixed(1)}%</p>
                      </div>
                      <div className="h-3 bg-surface-lighter rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${hasTarget ? progress : 0}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: selectedType?.color || '#6366F1' }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Remaining: <span className="text-gray-300 font-medium">{formatMoney(hasTarget ? remaining : 0)}</span></span>
                        {monthlyEstimate != null && (
                          <span className="text-right">
                            Save approx <span className="text-gray-300 font-medium">{formatMoney(monthlyEstimate)}/month</span>{' '}
                            <span className="text-gray-600">(estimate)</span>
                          </span>
                        )}
                      </div>
                    </motion.div>

                    {/* Description */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Description <span className="text-gray-600">(optional)</span></label>
                      <input value={form.description} onChange={handleChange('description')}
                        placeholder="e.g. New gaming laptop for work" className="input-field" />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Notes <span className="text-gray-600">(optional)</span></label>
                      <textarea value={form.notes} onChange={handleChange('notes')} rows={2}
                        placeholder="Anything you want to remember" className="input-field resize-none" />
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
                  <button onClick={handleSave} disabled={saving || saveSuccess}
                    className={`${saveSuccess ? 'bg-success text-white shadow-lg shadow-success/30' : 'btn-primary'} !py-2.5 !px-6 flex items-center gap-2 disabled:opacity-70`}>
                    {saveSuccess ? (
                      <><Check className="w-4 h-4" /> Saved</>
                    ) : saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                      <>Create Goal</>
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
