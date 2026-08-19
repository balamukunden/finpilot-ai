import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Trash2, Sparkles } from 'lucide-react';
import api from '../lib/axios';

const QUICK_PROMPTS = [
  '💰 How much did I spend this month?',
  '📊 Analyze my spending habits',
  '📈 Where should I invest?',
  '🎯 Help me create a budget',
  '💡 How can I save more money?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get('/chat/history');
        setMessages(data.data.messages || []);
      } catch {
        setMessages([]);
      } finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || sending) return;
    const userMsg = { role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/chat/send', { message: text });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.data.assistantMessage.content,
        createdAt: data.data.assistantMessage.createdAt,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date().toISOString(),
      }]);
    } finally { setSending(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(input); };

  const clearChat = async () => {
    try { await api.delete('/chat/clear'); } catch {}
    setMessages([]);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-ai to-ai-light rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display">FinPilot AI Advisor</h1>
            <p className="text-xs text-gray-500">Your personal financial analyst</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-gray-500 hover:text-danger transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Chat Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scrollbar-thin">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-12">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Hi! I'm your FinPilot AI</h3>
            <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
              I can analyze your spending, recommend investments, create budgets, and help you build healthy financial habits.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {QUICK_PROMPTS.map((prompt) => (
                <motion.button key={prompt} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => sendMessage(prompt.replace(/^[^\s]+\s/, ''))}
                  className="glass !rounded-full !px-4 !py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                  {prompt}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ai to-ai-light flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'glass !bg-surface-light rounded-bl-md text-gray-200'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-surface-lighter flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </motion.div>
            ))}
            {sending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ai to-ai-light flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="glass !bg-surface-light rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} className="w-2 h-2 bg-text-muted rounded-full"
                        animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances..."
          className="input-field flex-1"
          disabled={sending}
        />
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          type="submit" disabled={!input.trim() || sending}
          className="btn-primary !px-4 !rounded-xl disabled:opacity-30"
        >
          <Send className="w-5 h-5" />
        </motion.button>
      </form>
    </div>
  );
}
