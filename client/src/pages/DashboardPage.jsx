import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Target, Brain,
  ArrowUpRight, ArrowDownRight, BarChart3, Activity
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import api from '../lib/axios';

const COLORS = ['#6366F1', '#22D3EE', '#34D399', '#FBBF24', '#FB7185', '#818CF8', '#94A3B8', '#6EE7B7'];

const StatCard = ({ icon: Icon, label, value, change, positive, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -3 }}
    className="glass-card"
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {change !== undefined && (
        <span className={`text-xs font-medium flex items-center gap-0.5 ${positive ? 'text-success' : 'text-danger'}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-sm text-gray-400 mt-1">{label}</p>
  </motion.div>
);

const ScoreGauge = ({ score }) => {
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#34D399' : score >= 60 ? '#FBBF24' : '#FB7185';

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="glass-card flex flex-col items-center justify-center !py-8">
      <p className="text-sm text-gray-400 mb-4 font-medium">Financial Score</p>
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90">
          <circle cx="72" cy="72" r="60" fill="none" stroke="#172236" strokeWidth="10" />
          <motion.circle
            cx="72" cy="72" r="60" fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{score}</span>
          <span className="text-xs text-gray-400">/ 100</span>
        </div>
      </div>
      <p className="text-sm mt-3 font-medium" style={{ color }}>
        {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work'}
      </p>
    </motion.div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="glass !p-3 !rounded-lg text-sm">
        <p className="text-gray-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: ₹{p.value?.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: res } = await api.get('/dashboard');
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading || (!data && !error)) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card flex flex-col items-center justify-center !py-16 text-center">
        <p className="text-gray-400 mb-1">We couldn't load your dashboard.</p>
        <p className="text-sm text-gray-500 mb-4">Please check your connection and try again.</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const fmt = (n) => `₹${n?.toLocaleString('en-IN') || 0}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="text-2xl font-bold font-display">Dashboard</motion.h1>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Monthly Income" value={fmt(data.income)} color="bg-primary/20" delay={0.1} />
        <StatCard icon={TrendingDown} label="Monthly Expenses" value={fmt(data.expenses)}
          change={data.expenseChange} positive={data.expenseChange < 0} color="bg-danger/20" delay={0.2} />
        <StatCard icon={PiggyBank} label="Savings" value={fmt(data.savings)} color="bg-success/20" delay={0.3} />
        <StatCard icon={Activity} label="Savings Rate" value={`${data.savingsRate}%`} color="bg-success/20" delay={0.4} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card lg:col-span-2 !p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Income vs Expenses
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.trendData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FB7185" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FB7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
              <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income" stroke="#34D399" fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="#FB7185" fill="url(#expenseGrad)" strokeWidth={2} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Financial Score */}
        <ScoreGauge score={data.financialScore} />
      </div>

      {/* Category Breakdown + Goals */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card">
          <h3 className="font-semibold mb-4">Expense Breakdown</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={data.categoryBreakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {data.categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {data.categoryBreakdown.slice(0, 5).map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="capitalize text-gray-300">{c.category}</span>
                  </div>
                  <span className="font-medium">{fmt(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Goals */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Active Goals
          </h3>
          <div className="space-y-4">
            {data.goals.map((goal) => (
              <div key={goal.id} className="bg-surface-light rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{goal.icon}</span>
                    <span className="font-medium text-sm">{goal.name}</span>
                  </div>
                  <span className="text-sm text-gray-400">{Math.round(goal.progress)}%</span>
                </div>
                <div className="h-2 bg-surface-lighter rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.progress}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: goal.color }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{fmt(goal.currentAmount)}</span>
                  <span>{fmt(goal.targetAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* AI Suggestions + Recent Transactions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* AI Suggestions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="glass-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-ai" /> AI Insights
          </h3>
          <div className="space-y-3">
            {data.suggestions.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="flex gap-3 p-3 bg-surface-light rounded-xl"
              >
                <span className="text-lg">{s.icon}</span>
                <p className="text-sm text-gray-300 leading-relaxed">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="glass-card">
          <h3 className="font-semibold mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {data.recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-surface-light rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${t.type === 'income' ? 'bg-success/20' : 'bg-danger/20'}`}>
                    {t.type === 'income' ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-danger" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.merchant || t.category}</p>
                    <p className="text-xs text-gray-500 capitalize">{t.category}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
