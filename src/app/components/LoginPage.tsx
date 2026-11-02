import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAuth, AuthUser } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Lock,
  User,
  Mail,
  Building2,
  KeyRound,
  Eye,
  EyeOff,
  Languages,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import moonLogoWhite from '../../assets/white.png';

// Spline Scene URL - 3D interactive scene
const SPLINE_SCENE_URL = 'https://my.spline.design/3ddesigntextcopycopy-ICjwUjRH9s8O1NCNqRAWjo5g-5OJ/';

interface LoginPageProps {
  onLanguageChange: (lang: string) => void;
  currentLanguage: string;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export function LoginPage({ onLanguageChange, currentLanguage }: LoginPageProps) {
  const isAr = currentLanguage === "ar";
  const { t } = useTranslation();
  const {
    login,
    signup,
    users: adminUsers,
    usersLoading,
    usersError,
    refreshUsers,
    unlockAdmin,
    approveUser,
    rejectUser,
    deleteUser,
  } = useAuth();

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Sign Up / Tester Request State
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regInstitution, setRegInstitution] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');

  // Status & Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingApprovalInfo, setPendingApprovalInfo] = useState<{
    user: string;
    email: string;
    institution: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Admin Approval Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminUnlocking, setAdminUnlocking] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  // UI State
  const [isUiVisible, setIsUiVisible] = useState(true);

  const refreshAdminUsers = () => {
    setAdminError('');
    refreshUsers();
  };

  useEffect(() => {
    if (showAdminModal && isAdminUnlocked) {
      refreshUsers();
    }
  }, [showAdminModal, isAdminUnlocked, refreshUsers]);

  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminUnlocking(true);
    const res = await unlockAdmin(adminPasscode);
    setAdminUnlocking(false);
    if (res.success) {
      setIsAdminUnlocked(true);
      setAdminPasscode('');
    } else {
      setAdminError(res.message || 'Invalid Super Admin credentials. Only Isaac Faleh can approve testers.');
    }
  };

  const runAdminAction = async (
    action: (username: string) => Promise<{ success: boolean; message?: string }>,
    username: string
  ) => {
    setAdminError('');
    setBusyUser(username);
    const res = await action(username);
    setBusyUser(null);
    if (!res.success) setAdminError(res.message || 'Action failed. Please try again.');
  };

  const handleApproveTester = (username: string) => runAdminAction(approveUser, username);
  const handleRejectTester = (username: string) => runAdminAction(rejectUser, username);
  const handleDeleteTester = (username: string) => {
    if (!window.confirm(`Delete the account "${username}"? This cannot be undone.`)) return;
    runAdminAction(deleteUser, username);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPendingApprovalInfo(null);

    if (!identifier.trim()) {
      setError('Username or Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    try {
      const res = await login(identifier, password);
      if (!res.success) {
        if (res.status === 'pending') {
          setError(
            res.message ||
              'Your account is awaiting approval by administrator Isaac Faleh. Once approved, you can sign in to test the editor.'
          );
        } else {
          setError(res.message || 'Invalid credentials. Please verify your username and password.');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred during login. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPendingApprovalInfo(null);

    if (!regUsername.trim()) {
      setError('User / Username is required');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setError('A valid Email address is required');
      return;
    }
    if (!regInstitution.trim()) {
      setError('Institution or Organization is required');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await signup({
        username: regUsername,
        email: regEmail,
        institution: regInstitution,
        password: regPassword,
        inviteCode: regInviteCode,
      });

      if (res.success) {
        if (res.status === 'pending') {
          setPendingApprovalInfo({
            user: regUsername,
            email: regEmail,
            institution: regInstitution,
          });
          setSuccess(
            res.message ||
              (isAr ? 'تم إرسال طلب التسجيل بنجاح! حسابك قيد مراجعة إسحاق فالح.' : 'Tester registration submitted! Your account is pending administrator approval (Isaac Faleh).')
          );
          setIdentifier(regUsername);
        } else {
          setSuccess(
            res.message ||
              (isAr ? 'تم تفعيل الحساب فورياً بنجاح عبر رمز VIP! يمكنك الآن تسجيل الدخول مباشرة.' : 'Account approved immediately via VIP code! You can now log in.')
          );
          setIdentifier(regUsername);
          setPassword(regPassword);
          setActiveTab('login');
        }
      } else {
        setError(res.message || 'Failed to submit registration. Username or email may already exist.');
      }
    } catch (err) {
      setError('An error occurred during registration. Please try again.');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      {/* Ambient Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-purple-950/20 to-pink-950/20 z-0" />

      {/* Spline 3D Background */}
      <div className="absolute inset-0 z-0" style={{ top: '-15%', height: '130%' }}>
        <iframe
          src={SPLINE_SCENE_URL}
          frameBorder="0"
          width="100%"
          height="100%"
          className="w-full h-full"
          title="Spline 3D Scene"
          allow="fullscreen; autoplay"
          style={{
            pointerEvents: 'auto',
            border: 'none',
            background: 'transparent',
          }}
        />
      </div>

      {/* Grid Overlay Effect */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 z-[1] pointer-events-none" />

      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-cyan-500/20 to-transparent blur-3xl z-[1] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-purple-500/20 to-transparent blur-3xl z-[1] pointer-events-none" />

      {/* Top Bar - Brand Identity */}
      <AnimatePresence>
        {isUiVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="absolute top-0 left-0 right-0 z-40 p-6 flex items-center justify-between"
          >
            <div 
              className="absolute top-6 right-6 flex items-center gap-3.5 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 shadow-2xl"
              dir={isAr ? "rtl" : "ltr"}
            >
              <div className="w-16 h-16 flex items-center justify-center backdrop-blur-md bg-white/20 rounded-xl border border-white/30 shadow-lg shrink-0">
                <img src={moonLogoWhite} alt="Moon Logo" className="w-full h-full object-contain drop-shadow-2xl" />
              </div>
              <div className={isAr ? "text-right" : "text-left"}>
                <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg leading-tight">
                  {isAr ? "تصميم وتطوير: إسحاق فالح" : "DESIGN AND DEVELOPED BY ISAAC FALEH"}
                </h1>
                <p className="text-[11px] text-white/80 mt-1 drop-shadow-md font-medium">
                  {isAr ? "محرر MOON • منصة البيانات المترابطة التجريبية BIBFRAME 3.0.1" : "Moon Editor • BIBFRAME 3.0.1 Linked Data Pilot Platform"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="absolute bottom-8 right-8 z-50 flex items-center gap-3">
        

        {/* Language Switcher */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onLanguageChange(currentLanguage === 'en' ? 'ar' : 'en')}
            className="bg-black/40 border-white/20 text-white hover:bg-white/10 backdrop-blur-xl rounded-xl w-11 h-11 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            title="تبديل اللغة (Language)"
          >
            <Languages className="h-4 w-4" />
          </Button>
        </motion.div>

        {/* Hide/Show UI */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsUiVisible(!isUiVisible)}
            className="bg-black/40 border-white/20 text-white hover:bg-white/10 backdrop-blur-xl rounded-xl w-11 h-11 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            title={isUiVisible ? 'Hide UI overlay' : 'Show UI overlay'}
          >
            {isUiVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </motion.div>
      </div>

      {/* Main Authentication Card */}
      <AnimatePresence>
        {isUiVisible && (
          <motion.div
            initial={{ opacity: 0, x: -100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.95 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 200,
              opacity: { duration: 0.3 },
            }}
            className={`absolute top-1/2 ${isAr ? "right-8 sm:right-12" : "left-8 sm:left-12"} -translate-y-1/2 z-30 pointer-events-none max-h-[92vh] overflow-y-auto`}
            dir={isAr ? "rtl" : "ltr"}
          >
            <Card className="w-[430px] max-w-[94vw] bg-black/55 backdrop-blur-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_1px_rgba(255,255,255,0.15)_inset] pointer-events-auto overflow-hidden rounded-3xl">
              {/* Animated gradient accent border */}
              <motion.div
                className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-blue-500 via-indigo-400 via-amber-400 to-pink-500"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{
                  backgroundSize: '200% 100%',
                }}
              />

              <CardHeader className="pb-3 pt-6 px-7">
                <CardTitle className="text-2xl font-black tracking-tight flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={moonLogoWhite} alt="Moon Logo" className="w-12 h-12 object-contain drop-shadow-xl" />
                    <div>
                      <span className="text-white block font-black text-xl">
                        {isAr ? "محرر MOON" : "Moon Editor"}
                      </span>
                      <span className="text-[10px] text-blue-300 font-semibold tracking-wider uppercase block">
                        {isAr ? "بوابة البيانات المترابطة التجريبية ببفريم" : "BIBFRAME Linked Data Pilot Portal"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLanguageChange(isAr ? "en" : "ar")}
                    className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <Languages className="w-3.5 h-3.5 text-blue-300" />
                    <span>{isAr ? "EN" : "عربي"}</span>
                  </button>
                </CardTitle>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                  <p className="text-white/60 text-[11px] font-medium tracking-wide">
                    {activeTab === 'login' 
                      ? (isAr ? "تسجيل الدخول لتجربة المحرر" : "Sign In to Test Editor")
                      : (isAr ? "طلب حساب فاحص (يتطلب موافقة)" : "Request Access (Requires Approval)")}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="px-7 pb-7 pt-2">
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => {
                    setActiveTab(val as 'login' | 'signup');
                    setError('');
                    setSuccess('');
                    setPendingApprovalInfo(null);
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 mb-5 p-1 rounded-2xl">
                    <TabsTrigger
                      value="login"
                      className="data-[state=active]:bg-white/20 data-[state=active]:backdrop-blur-xl data-[state=active]:border data-[state=active]:border-white/30 data-[state=active]:shadow-lg data-[state=active]:text-white text-white/60 text-xs font-bold rounded-xl py-2 transition-all duration-300 cursor-pointer"
                    >
                      {isAr ? "تسجيل الدخول" : (t('login') || 'Sign In')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="data-[state=active]:bg-white/20 data-[state=active]:backdrop-blur-xl data-[state=active]:border data-[state=active]:border-white/30 data-[state=active]:shadow-lg data-[state=active]:text-white text-white/60 text-xs font-bold rounded-xl py-2 transition-all duration-300 cursor-pointer"
                    >
                      {isAr ? "طلب حساب فاحص" : "Request Access"}
                    </TabsTrigger>
                  </TabsList>

                  {/* ===== SIGN IN FORM ===== */}
                  {activeTab === 'login' && (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-white/85 text-[11px] font-bold block text-right" htmlFor="identifier">
                          {isAr ? "اسم المستخدم أو البريد الإلكتروني *" : "User or Email *"}
                        </Label>
                        <div className="relative group">
                          <User className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3.5 h-4 w-4 text-white/40 group-focus-within:text-blue-400 transition-colors duration-200`} />
                          <Input
                            id="identifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className={`${isAr ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} h-11 bg-black/40 border border-white/15 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-400 transition-all rounded-xl`}
                            placeholder={isAr ? "اسم المستخدم أو البريد الإلكتروني" : "Username or email"}
                            disabled={loading}
                            dir={isAr ? "rtl" : "ltr"}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-white/85 text-[11px] font-bold block text-right" htmlFor="password">
                          {isAr ? "كلمة المرور *" : "Password *"}
                        </Label>
                        <div className="relative group">
                          <Lock className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3.5 h-4 w-4 text-white/40 group-focus-within:text-purple-400 transition-colors duration-200`} />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`${isAr ? 'pr-10 pl-10 text-right' : 'pl-10 pr-10 text-left'} h-11 bg-black/40 border border-white/15 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:border-purple-400 transition-all rounded-xl`}
                            placeholder={isAr ? "أدخل كلمة المرور" : "Enter password"}
                            disabled={loading}
                            dir={isAr ? "rtl" : "ltr"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={`absolute ${isAr ? 'left-3' : 'right-3'} top-3.5 text-white/40 hover:text-white/70 transition-colors cursor-pointer`}
                            disabled={loading}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs backdrop-blur-md leading-relaxed"
                          >
                            <div className="flex items-start gap-2">
                              <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                              <span>{error}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.98 }} className="pt-2">
                        <Button
                          type="submit"
                          className="w-full h-12 text-white font-black text-sm uppercase tracking-wider transition-all cursor-pointer relative overflow-hidden group"
                          style={{
                            background: 'rgba(255, 255, 255, 0.28)',
                            borderRadius: '16px',
                            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(13.4px)',
                            WebkitBackdropFilter: 'blur(13.4px)',
                            border: '1px solid rgba(255, 255, 255, 0.88)',
                            color: '#ffffff',
                          }}
                          disabled={loading}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2.5">
                            {loading ? (
                              <span>Authenticating...</span>
                            ) : (
                              <>
                                <span>{isAr ? "تسجيل الدخول إلى محرر MOON" : "SIGN IN TO TEST MOON"}</span>
                                <img src={moonLogoWhite} alt="Moon" className="w-5 h-5 object-contain drop-shadow" />
                              </>
                            )}
                          </span>
                        </Button>
                      </motion.div>
                    </form>
                  )}

                  {/* ===== SIGN UP / REQUEST ACCESS FORM ===== */}
                  {activeTab === 'signup' && (
                    <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                      {/* Username */}
                      <div className="space-y-1">
                        <Label className="text-white/85 text-[11px] font-bold block text-right" htmlFor="regUsername">
                          {isAr ? "اسم المستخدم *" : "User / Username *"}
                        </Label>
                        <div className="relative group">
                          <User className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3 h-4 w-4 text-white/40 group-focus-within:text-blue-400 transition-colors`} />
                          <Input
                            id="regUsername"
                            value={regUsername}
                            onChange={(e) => setRegUsername(e.target.value)}
                            className={`${isAr ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} h-10 bg-black/40 border border-white/15 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-xl text-sm`}
                            placeholder={isAr ? "مثال: سارة أحمد أو sahmed" : "e.g. Sarah Ahmed or sahmed"}
                            disabled={loading}
                            dir={isAr ? "rtl" : "ltr"}
                            required
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1">
                        <Label className="text-white/85 text-[11px] font-bold block text-right" htmlFor="regEmail">
                          {isAr ? "البريد الإلكتروني *" : "EMAIL ADDRESS *"}
                        </Label>
                        <div className="relative group">
                          <Mail className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3 h-4 w-4 text-white/40 group-focus-within:text-indigo-400 transition-colors`} />
                          <Input
                            id="regEmail"
                            type="email"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className={`${isAr ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} h-10 bg-black/40 border border-white/15 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl text-sm`}
                            placeholder={isAr ? "مثال: sarah@library.iq" : "e.g. sarah@library.edu"}
                            disabled={loading}
                            dir={isAr ? "rtl" : "ltr"}
                            required
                          />
                        </div>
                      </div>

                      {/* Institution */}
                      <div className="space-y-1">
                        <Label className="text-white/85 text-[11px] font-bold block text-right" htmlFor="regInstitution">
                          {isAr ? "المؤسسة أو المكتبة أو الجامعة *" : "INSTITUTION / ORGANIZATION *"}
                        </Label>
                        <div className="relative group">
                          <Building2 className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors`} />
                          <Input
                            id="regInstitution"
                            value={regInstitution}
                            onChange={(e) => setRegInstitution(e.target.value)}
                            className={`${isAr ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} h-10 bg-black/40 border border-white/15 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-xl text-sm`}
                            placeholder={isAr ? "مثال: مكتبة العتبة العباسية، دار الكتب، جامعة بغداد" : "e.g. Library of Congress, Cairo Univ, Sinopia Partner"}
                            disabled={loading}
                            dir={isAr ? "rtl" : "ltr"}
                            required
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-1">
                        <Label className="text-white/85 text-[11px] font-bold block text-right" htmlFor="regPassword">
                          {isAr ? "كلمة المرور (٦ خانات على الأقل) *" : "PASSWORD (MIN 6 CHARS) *"}
                        </Label>
                        <div className="relative group">
                          <Lock className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3 h-4 w-4 text-white/40 group-focus-within:text-purple-400 transition-colors`} />
                          <Input
                            id="regPassword"
                            type="password"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className={`${isAr ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} h-10 bg-black/40 border border-white/15 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-purple-500/50 rounded-xl text-sm`}
                            placeholder={isAr ? "أنشئ كلمة المرور" : "Create password"}
                            disabled={loading}
                            dir={isAr ? "rtl" : "ltr"}
                            required
                          />
                        </div>
                      </div>

                      {/* Fast-Approval Code (Optional) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-white/85 text-[11px] font-bold" htmlFor="regInviteCode">
                            {isAr ? "رمز الموافقة الفوري VIP (اختياري)" : "VIP APPROVAL CODE (OPTIONAL)"}
                          </Label>
                          <span className="text-[10px] text-amber-300 font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30">
                            {isAr ? "تجاوز قائمة الانتظار للموافقة الفورية" : "Bypasses review queue"}
                          </span>
                        </div>
                        <div className="relative group">
                          <KeyRound className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3 h-4 w-4 text-white/40 group-focus-within:text-amber-400 transition-colors`} />
                          <Input
                            id="regInviteCode"
                            value={regInviteCode}
                            onChange={(e) => setRegInviteCode(e.target.value)}
                            className={`${isAr ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} h-10 bg-black/40 border border-white/15 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-xl text-sm`}
                            placeholder={isAr ? "أدخل الرمز إن كان متوفراً لديك" : "Enter approval code if available"}
                            disabled={loading}
                            dir={isAr ? "rtl" : "ltr"}
                          />
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs backdrop-blur-md"
                          >
                            <div className="flex items-start gap-2">
                              <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                              <span>{error}</span>
                            </div>
                          </motion.div>
                        )}

                        {pendingApprovalInfo && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs backdrop-blur-md space-y-2"
                          >
                            <div className="flex items-center gap-2 font-bold text-amber-300">
                              <Clock className="h-4 w-4 animate-spin text-amber-400" />
                              <span>Awaiting Administrator Approval</span>
                            </div>
                            <div className="space-y-1 text-[11px] text-white/80 bg-black/30 p-2.5 rounded-xl border border-white/10 font-mono">
                              <div><span className="text-white/50">User:</span> {pendingApprovalInfo.user}</div>
                              <div><span className="text-white/50">Email:</span> {pendingApprovalInfo.email}</div>
                              <div><span className="text-white/50">Institution:</span> {pendingApprovalInfo.institution}</div>
                            </div>
                            <p className="text-[11px] leading-relaxed text-amber-100">
                              Your request has been dispatched to administrator <strong>Isaac Faleh</strong>. It will appear directly on his admin account for instant approval.
                            </p>
                            <a
                              href={`mailto:isaac@moon.local?subject=${encodeURIComponent(`Moon Editor Access Request: ${pendingApprovalInfo.user}`)}&body=${encodeURIComponent(`Hello Isaac,\n\nA new tester has requested access to the Moon BIBFRAME Editor:\n\nUser: ${pendingApprovalInfo.user}\nEmail: ${pendingApprovalInfo.email}\nInstitution: ${pendingApprovalInfo.institution}\nSubmitted At: ${new Date().toLocaleString()}\n\nPlease approve this request from your Admin account in Moon Studio.\n\nThank you!`)}`}
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/60 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              <span>Send Email Notification to Isaac</span>
                            </a>
                          </motion.div>
                        )}

                        {success && !pendingApprovalInfo && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs backdrop-blur-md flex items-start gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{success}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.98 }} className="pt-2">
                        <Button
                          type="submit"
                          className="w-full h-11 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                          style={{
                            background: 'rgba(255, 255, 255, 0.28)',
                            borderRadius: '16px',
                            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(13.4px)',
                            WebkitBackdropFilter: 'blur(13.4px)',
                            border: '1px solid rgba(255, 255, 255, 0.88)',
                            color: '#ffffff',
                          }}
                          disabled={loading}
                        >
                          {loading ? 'Submitting Request...' : (
                            <span className="flex items-center justify-center gap-2">
                              <span>{isAr ? "إرسال طلب الانضمام كفاحص" : "SUBMIT TESTER REQUEST"}</span>
                              <img src={moonLogoWhite} alt="Moon" className="w-4 h-4 object-contain drop-shadow" />
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    </form>
                  )}
                </Tabs>

                {/* Footer notes */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40 uppercase tracking-wider">
                  <span>BIBFRAME 3.0.1</span>
                  
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ADMINISTRATOR APPROVAL PORTAL MODAL ===== */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowAdminModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900/90 border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Administrator Approval Center</h2>
                    <p className="text-xs text-white/60">
                      Manage tester access requests for Moon Editor (Isaac Faleh)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAdminModal(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {!isAdminUnlocked ? (
                  <form onSubmit={handleAdminUnlock} className="max-w-md mx-auto py-8 space-y-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/40 mx-auto flex items-center justify-center text-amber-300">
                      <Lock className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Administrator Verification</h3>
                    <p className="text-xs text-white/60">
                      Enter Isaac's administrator passcode to review and approve testers.
                    </p>
                    <div className="relative">
                      <Input
                        type="password"
                        value={adminPasscode}
                        onChange={(e) => setAdminPasscode(e.target.value)}
                        placeholder="Enter Super Admin password"
                        className="bg-black/50 border-white/20 text-white text-center text-base tracking-widest h-12 rounded-xl"
                        autoFocus
                      />
                    </div>
                    {adminError && <p className="text-xs text-rose-400">{adminError}</p>}
                    <Button
                      type="submit"
                      disabled={adminUnlocking || !adminPasscode}
                      className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase rounded-xl cursor-pointer"
                    >
                      {adminUnlocking ? 'Verifying…' : 'Unlock Approval Center'}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {/* Summary row */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-white/60">Total Registered:</span>
                        <span className="text-sm font-black text-white">{adminUsers.length}</span>
                        <span className="text-xs font-bold text-amber-400 ml-3">Pending Approvals:</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
                          {adminUsers.filter((u) => u.status === 'pending').length}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={refreshAdminUsers}
                        disabled={usersLoading}
                        className="text-xs bg-white/5 border-white/20 text-white hover:bg-white/10"
                      >
                        {usersLoading ? 'Refreshing…' : 'Refresh List'}
                      </Button>
                    </div>

                    {(adminError || usersError) && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2">
                        {adminError || usersError}
                      </p>
                    )}

                    {/* Users List */}
                    <div className="space-y-3">
                      {adminUsers.map((u) => {
                        const isPending = u.status === 'pending';
                        const isApproved = u.status === 'approved';
                        const isRejected = u.status === 'rejected';

                        return (
                          <div
                            key={u.username}
                            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isPending
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : isApproved
                                ? 'bg-white/5 border-white/10'
                                : 'bg-rose-500/10 border-rose-500/25'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-black text-white text-base">{u.username}</span>
                                {isPending && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider animate-pulse">
                                    Pending Approval
                                  </span>
                                )}
                                {isApproved && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider">
                                    Approved
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-bold uppercase tracking-wider">
                                    Declined
                                  </span>
                                )}
                                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                                  {u.role}
                                </span>
                              </div>

                              <div className="text-xs text-white/70 flex items-center gap-3 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3.5 w-3.5 text-white/40" />
                                  {u.email}
                                </span>
                                <span className="flex items-center gap-1 text-cyan-300 font-medium">
                                  <Building2 className="h-3.5 w-3.5 text-cyan-400" />
                                  {u.institution}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div
                              className={`flex items-center gap-2 shrink-0 ${busyUser === u.username ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              {isPending ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveTester(u.username)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl h-8 px-3 cursor-pointer"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectTester(u.username)}
                                    className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs rounded-xl h-8 px-3 cursor-pointer"
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              ) : isRejected ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveTester(u.username)}
                                  className="bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl h-8 px-3 cursor-pointer"
                                >
                                  Re-Approve
                                </Button>
                              ) : u.role !== 'admin' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectTester(u.username)}
                                  className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs rounded-xl h-8 px-3 cursor-pointer"
                                  title="Revoke access"
                                >
                                  Revoke
                                </Button>
                              ) : null}

                              {u.username !== 'isaac' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteTester(u.username)}
                                  className="text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl h-8 w-8 p-0 cursor-pointer"
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
