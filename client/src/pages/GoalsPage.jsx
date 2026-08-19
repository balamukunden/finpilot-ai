import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Target, X, Check, PartyPopper } from 'lucide-react';
import api from '../lib/axios';
import GoalModal from '../components/GoalModal';

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showContribute, setShowContribute] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [celebrating, setCelebrating] = useState(null);

  const fetchGoals = async () => {
    try {
      const { data } = await api.get('/goals');
      setGoals(data.data.goals || []);
    } catch { setGoals([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGoals(); }, []);

  const handleContribute = async (goalId) => {
    if (!contributeAmount || parseFloat(contributeAmount) <= 0) return;
    try {
      const { data } = await api.post(`/goals/${goalId}/contribute`, { amount: parseFloat(contributeAmount) });
      if (data.data.completed) {
        setCelebrating(goalId);
        setTimeout(() => setCelebrating(null), 3000);
      }
      setShowContribute(null);
      setContributeAmount('');
      fetchGoals();
    } catch {}
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/goals/${id}`); fetchGoals(); } catch {}
  };

  const fmt = (n) => `₹${n?.toLocaleString('en-IN')}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold font-display">
          Savings Goals
        </motion.h1>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)} className="btn-primary !py-2 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Goal
        </motion.button>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="glass-card animate-pulse h-44" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="glass-card text-center py-16 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-lg font-medium mb-2">No goals yet</p>
          <p className="text-sm">Create your first savings goal to start tracking progress!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {goals.map((goal, i) => {
            const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
            return (
              <motion.div key={goal.id || goal._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="glass-card relative overflow-hidden group">
                {/* Celebration overlay */}
                <AnimatePresence>
                  {celebrating === (goal.id || goal._id) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-success/10 z-10 flex items-center justify-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                        <PartyPopper className="w-12 h-12 text-success mx-auto mb-2" />
                        <p className="text-lg font-bold text-success">Goal Completed! 🎉</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal.icon}</span>
                    <div>
                      <h3 className="font-semibold">{goal.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{goal.type?.replace('-', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {goal.status !== 'completed' && (
                      <button onClick={() => { setShowContribute(goal.id || goal._id); setContributeAmount(''); }}
                        className="text-xs btn-accent !px-3 !py-1 !rounded-lg">+ Add</button>
                    )}
                    <button onClick={() => handleDelete(goal.id || goal._id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-danger transition-all p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{fmt(goal.currentAmount)}</span>
                    <span className="font-medium">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 bg-surface-lighter rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="h-full rounded-full" style={{ backgroundColor: goal.color || '#6366F1' }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">Target: {fmt(goal.targetAmount)}</p>
                </div>

                {/* Milestones */}
                <div className="flex gap-1.5 mt-2">
                  {[25, 50, 75, 100].map((m) => (
                    <div key={m} className={`flex-1 h-1 rounded-full ${progress >= m ? 'bg-success' : 'bg-surface-lighter'}`} />
                  ))}
                </div>

                {/* Contribute inline */}
                <AnimatePresence>
                  {showContribute === (goal.id || goal._id) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                      <input type="number" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)}
                        placeholder="Amount (₹)" className="input-field !py-2 text-sm flex-1" />
                      <button onClick={() => handleContribute(goal.id || goal._id)}
                        className="btn-primary !py-2 !px-3"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setShowContribute(null)}
                        className="btn-secondary !py-2 !px-3"><X className="w-4 h-4" /></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Goal — two-step wizard */}
      <GoalModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); fetchGoals(); }}
      />
    </div>
  );
}
