import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, FileImage, Check, Loader2, AlertCircle, X } from 'lucide-react';
import api from '../lib/axios';

export default function ScannerPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError('');
    setSaved(false);
  };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const { data } = await api.post('/scanner/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult({
        merchant: data.data.extracted.merchant || '',
        amount: data.data.extracted.amount || '',
        date: data.data.extracted.date || new Date().toISOString().split('T')[0],
        category: data.data.extracted.category || 'other',
        items: data.data.extracted.items || [],
        gst: data.data.extracted.gst || 0,
        fileUrl: data.data.file.url,
      });
    } catch {
      setResult({
        merchant: '', amount: '', date: new Date().toISOString().split('T')[0],
        category: 'food', items: [], gst: 0, fileUrl: '',
      });
      setError('AI service unavailable. Fill in manually.');
    } finally { setScanning(false); }
  };

  const handleConfirm = async () => {
    if (!result?.amount) return;
    setSaving(true);
    try {
      await api.post('/scanner/confirm', {
        amount: parseFloat(result.amount),
        category: result.category,
        merchant: result.merchant,
        description: `Scanned receipt${result.items.length ? ': ' + result.items.join(', ') : ''}`,
        date: result.date,
        receiptUrl: result.fileUrl,
      });
      setSaved(true);
    } catch { setError('Failed to save transaction'); }
    finally { setSaving(false); }
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(''); setSaved(false); };

  const CATEGORIES = ['food', 'groceries', 'transport', 'entertainment', 'shopping', 'utilities', 'rent', 'health', 'education', 'travel', 'subscriptions', 'other'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold font-display">
        Receipt Scanner
      </motion.h1>
      <p className="text-gray-400">Upload a receipt, bill, or invoice. Our AI will extract the details automatically.</p>

      {!saved ? (
        <>
          {/* Upload Zone */}
          {!preview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="glass-card !p-12 border-2 border-dashed border-white/10 hover:border-primary/40 cursor-pointer transition-all text-center group"
            >
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="font-medium mb-1">Drop your receipt here</p>
              <p className="text-sm text-gray-500">or click to browse — JPEG, PNG, WebP, PDF</p>
            </motion.div>
          )}

          {/* Preview + Actions */}
          {preview && !result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card !p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="font-medium text-sm">{file?.name}</p>
                <button onClick={reset} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <img src={preview} alt="Receipt" className="max-h-64 mx-auto rounded-xl object-contain mb-4" />
              <button onClick={handleScan} disabled={scanning} className="btn-primary w-full flex items-center justify-center gap-2">
                {scanning ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</> : <><Camera className="w-4 h-4" /> Scan Receipt</>}
              </button>
            </motion.div>
          )}

          {/* Extracted Data */}
          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileImage className="w-4 h-4 text-accent" /> Extracted Data
              </h3>
              {error && (
                <div className="bg-warning/10 border border-warning/30 text-warning text-sm px-4 py-2 rounded-xl mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Merchant</label>
                  <input value={result.merchant} onChange={(e) => setResult({ ...result, merchant: e.target.value })}
                    className="input-field !py-2 text-sm" placeholder="Merchant name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Amount (₹)</label>
                    <input type="number" value={result.amount} onChange={(e) => setResult({ ...result, amount: e.target.value })}
                      className="input-field !py-2 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Date</label>
                    <input type="date" value={result.date} onChange={(e) => setResult({ ...result, date: e.target.value })}
                      className="input-field !py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Category</label>
                  <select value={result.category} onChange={(e) => setResult({ ...result, category: e.target.value })}
                    className="input-field !py-2 text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                {result.gst > 0 && <p className="text-sm text-gray-400">GST: ₹{result.gst}</p>}
                <button onClick={handleConfirm} disabled={saving || !result.amount}
                  className="btn-accent w-full flex items-center justify-center gap-2 mt-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Confirm & Save</>}
                </button>
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="glass-card text-center !py-12">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
            className="w-16 h-16 mx-auto bg-success/20 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-success" />
          </motion.div>
          <h3 className="text-xl font-bold mb-2">Transaction Saved!</h3>
          <p className="text-gray-400 mb-6">Your receipt has been scanned and the transaction has been recorded.</p>
          <button onClick={reset} className="btn-primary">Scan Another Receipt</button>
        </motion.div>
      )}
    </div>
  );
}
