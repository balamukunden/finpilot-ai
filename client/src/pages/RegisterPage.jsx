import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { extractErrorMessage } from '../lib/errorMessage';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PASSWORD_STRENGTH_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((f) => ({ ...f, [name]: undefined }));
  };

  const validate = () => {
    const errors = {};
    const name = form.name.trim();
    const email = form.email.trim();

    if (!name) errors.name = 'Please enter your name.';
    else if (name.length < 2) errors.name = 'Name must be at least 2 characters.';

    if (!email) errors.email = 'Please enter your email.';
    else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';

    if (!form.password) errors.password = 'Please enter a password.';
    else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    else if (!PASSWORD_STRENGTH_RE.test(form.password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
    }

    if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
    else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password, form.confirmPassword);
      navigate('/dashboard');
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      if (err.response?.status === 409) {
        setFieldErrors((f) => ({ ...f, email: 'An account with this email already exists.' }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[128px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[128px]" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold font-display">FinPilot<span className="text-primary">AI</span></span>
        </Link>

        <div className="glass-card !p-8">
          <h2 className="text-2xl font-bold font-display text-center mb-2">Create Account</h2>
          <p className="text-gray-400 text-center text-sm mb-6">Start your financial journey today</p>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl mb-4">{error}</motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  placeholder="Full name" className="input-field !pl-11" required />
              </div>
              {fieldErrors.name && <p className="text-danger text-xs mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="Email address" className="input-field !pl-11" required />
              </div>
              {fieldErrors.email && <p className="text-danger text-xs mt-1">{fieldErrors.email}</p>}
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type={showPw ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="Password (min 8 chars)" className="input-field !pl-11 !pr-11" required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-danger text-xs mt-1">{fieldErrors.password}</p>}
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="password" name="confirmPassword" value={form.confirmPassword}
                  onChange={handleChange} placeholder="Confirm password" className="input-field !pl-11" required />
              </div>
              {fieldErrors.confirmPassword && <p className="text-danger text-xs mt-1">{fieldErrors.confirmPassword}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary-light transition-colors font-medium">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
