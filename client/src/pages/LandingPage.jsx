import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Brain, Shield, Target, TrendingUp, Scan, MessageSquare,
  ChevronRight, Star, BarChart3, Wallet, ArrowRight, Sparkles,
  Zap, Trophy, Bell
} from 'lucide-react';

const AnimatedCounter = ({ end, duration = 2, suffix = '' }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = end / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span>{count.toLocaleString('en-IN')}{suffix}</span>;
};

const FloatingCard = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, delay }}
    className={`glass-card ${className}`}
    whileHover={{ y: -5, scale: 1.02 }}
  >
    {children}
  </motion.div>
);

const features = [
  { icon: Brain, title: 'AI-Powered Analysis', desc: 'Real-time spending analysis powered by local AI models. No data leaves your device.', color: 'from-primary to-ai' },
  { icon: Scan, title: 'Receipt Scanner', desc: 'Snap a photo of any receipt. Our OCR engine extracts every detail automatically.', color: 'from-primary-dark to-primary' },
  { icon: TrendingUp, title: 'Investment Advisor', desc: 'Personalized investment recommendations based on your spending patterns.', color: 'from-success to-ai' },
  { icon: Target, title: 'Smart Goals', desc: 'Set savings goals with milestone tracking and celebration animations.', color: 'from-primary to-primary-light' },
  { icon: MessageSquare, title: 'AI Chat Assistant', desc: 'Chat with your personal financial advisor anytime. Ask anything about money.', color: 'from-ai to-ai-light' },
  { icon: Trophy, title: 'Gamification', desc: 'Earn XP, unlock badges, and compete on leaderboards for healthy financial habits.', color: 'from-warning to-warning-light' },
];

const testimonials = [
  { name: 'Priya S.', role: 'Software Engineer', text: 'FinPilot helped me save ₹45,000 in just 3 months by identifying my subscription waste!', avatar: '👩‍💻' },
  { name: 'Rahul M.', role: 'Startup Founder', text: 'The AI chat is like having a personal CFO. It caught spending patterns I never noticed.', avatar: '👨‍💼' },
  { name: 'Anita K.', role: 'Designer', text: 'Receipt scanning is magic. I just snap a photo and everything is categorized instantly.', avatar: '👩‍🎨' },
];

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.8]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    setMousePos({ x: (e.clientX / window.innerWidth - 0.5) * 20, y: (e.clientY / window.innerHeight - 0.5) * 20 });
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden" onMouseMove={handleMouseMove}>
      {/* Gradient background orbs */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[128px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent/10 blur-[128px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-ai/5 blur-[128px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold font-display">FinPilot<span className="text-primary">AI</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary !py-2 !px-5 text-sm">Sign In</Link>
            <Link to="/register" className="btn-primary !py-2 !px-5 text-sm flex items-center gap-1">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section style={{ y, opacity }} className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-primary mb-6"
              >
                <Zap className="w-4 h-4" /> Powered by Local AI — 100% Free & Private
              </motion.div>

              <h1 className="text-5xl md:text-7xl font-bold font-display leading-tight mb-6">
                <span className="text-white">Analyze Every</span><br />
                <span className="gradient-text">Expense.</span><br />
                <span className="text-white">Protect Every</span><br />
                <span className="gradient-text">Investment.</span>
              </h1>

              <p className="text-lg text-gray-400 mb-8 max-w-lg leading-relaxed">
                Your AI-powered financial copilot that analyzes spending, predicts habits,
                and builds wealth — all running locally on your device.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link to="/register" className="btn-primary text-lg flex items-center justify-center gap-2">
                  Start Free <ChevronRight className="w-5 h-5" />
                </Link>
                <a href="#features" className="btn-secondary text-lg flex items-center justify-center gap-2">
                  See How It Works
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: 'Financial Score', value: 94, suffix: '/100' },
                  { label: 'Saved Monthly', value: 12500, suffix: '₹' },
                  { label: 'Insights', value: 150, suffix: '+' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    className="text-center"
                  >
                    <div className="text-2xl md:text-3xl font-bold text-white">
                      {stat.suffix === '₹' ? '₹' : ''}<AnimatedCounter end={stat.value} />{stat.suffix !== '₹' ? stat.suffix : ''}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Floating Cards */}
            <div className="hidden lg:block relative" style={{ transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)` }}>
              <FloatingCard className="absolute top-0 right-0 w-72 !p-4" delay={0.3}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-success/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">This Month</p>
                    <p className="text-lg font-bold text-success">+₹24,500</p>
                  </div>
                </div>
                <div className="h-16 flex items-end gap-1">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                      className="flex-1 bg-gradient-to-t from-primary/40 to-primary rounded"
                    />
                  ))}
                </div>
              </FloatingCard>

              <FloatingCard className="absolute top-40 left-0 w-64 !p-4" delay={0.5}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                    <Brain className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">AI Insight</p>
                    <p className="text-xs text-gray-400">Reduce dining by ₹1,200</p>
                  </div>
                </div>
              </FloatingCard>

              <FloatingCard className="absolute top-64 right-8 w-60 !p-4" delay={0.7}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-warning/20 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Vacation Goal</p>
                    <p className="text-xs text-gray-400">73% complete</p>
                  </div>
                </div>
                <div className="mt-2 h-2 bg-surface-lighter rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '73%' }}
                    transition={{ delay: 1, duration: 1 }}
                    className="h-full bg-gradient-to-r from-warning to-warning-light rounded-full"
                  />
                </div>
              </FloatingCard>

              <FloatingCard className="absolute top-96 left-12 w-56 !p-4" delay={0.9}>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-warning" />
                  <span className="text-sm font-medium">Level 7 Achieved!</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">+250 XP earned today</p>
              </FloatingCard>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="section-title mb-4">
              Everything You Need to <span className="gradient-text">Master Your Finances</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Powered by cutting-edge AI that runs entirely on your device. No cloud, no data sharing, no paid APIs.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-card group cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="section-title mb-4">Loved by <span className="gradient-text">Smart Savers</span></h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-card"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 text-warning fill-warning" />)}
                </div>
                <p className="text-gray-300 mb-4 text-sm leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{t.avatar}</div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto glass-card text-center !p-12 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Ready to Take Control of Your <span className="gradient-text">Finances?</span>
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Join thousands of smart savers who are building wealth with AI-powered insights.
            </p>
            <Link to="/register" className="btn-primary text-lg inline-flex items-center gap-2">
              Get Started for Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold">FinPilot<span className="text-primary">AI</span></span>
          </div>
          <p className="text-sm text-gray-500">© 2026 FinPilot AI. Built with ❤️ for financial freedom.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <span className="hover:text-white cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-white cursor-pointer transition-colors">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
