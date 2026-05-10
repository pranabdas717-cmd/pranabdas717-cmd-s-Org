import { useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { auth, db, signIn, logOut, OperationType, handleFirestoreError } from './lib/firebase';
import { UserProfile, UserRole } from './types';
import { LogIn, LogOut, LayoutDashboard, ShoppingCart, MapPin, BarChart3, User as UserIcon, Loader2, Store, Menu, X, FileText, Target as TargetIcon, Flag, Languages, TrendingUp, Clock, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from './lib/utils';
import AdminDashboard from './components/AdminDashboard';
import SalesView from './components/SalesView';
import NotificationBell from './components/NotificationBell';
import { translations } from './i18n';
import { updateDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'map' | 'outlets' | 'reports' | 'targets' | 'sales' | 'team' | 'territory' | 'attendance' | 'routes'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  useEffect(() => {
    if (profile?.language) {
      setLang(profile.language);
    }
  }, [profile?.language]);

  const toggleLanguage = async () => {
    const newLang = lang === 'bn' ? 'en' : 'bn';
    setLang(newLang);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { language: newLang });
      } catch (err) {
        console.error("Language update error:", err);
      }
    }
  };

  const t = translations[lang];

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Timeout to stop loading if Firebase takes too long
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("লোডিং অনেক সময় নিচ্ছে। আপনার ইন্টারনেট সংযোগ চেক করুন।");
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(true);
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
            localStorage.removeItem('manual_profile');
          }
        } else {
          const savedManual = localStorage.getItem('manual_profile');
          if (savedManual) {
            setProfile(JSON.parse(savedManual));
          } else {
            setProfile(null);
          }
        }
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    }, (err) => {
      console.error("Auth observer error:", err);
      setError(`ফায়ারবেস অথেনটিকেশন সমস্যা: ${err.message || 'অজানা ত্রুটি'}`);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSignIn = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      await signIn();
    } catch (err: any) {
      console.error("SignIn Error details:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError("লগইন উইন্ডোটি বন্ধ করা হয়েছে। আবার চেষ্টা করুন।");
      } else if (err.code === 'auth/cancelled-popup-request') {
        setAuthError("লগইন রিকোয়েস্ট বাতিল হয়েছে। রিফ্রেশ করে আবার চেষ্টা করুন।");
      } else {
        setAuthError(`লগইন করতে সমস্যা হয়েছে: ${err.message || 'আবার চেষ্টা করুন'}`);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogOut = async () => {
    try {
      await logOut();
      localStorage.removeItem('manual_profile');
      setProfile(null);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleInitialSetup = async () => {
    if (!user) return;
    try {
      const newProfile: UserProfile = {
        id: user.uid,
        employeeId: employeeIdInput,
        name: user.displayName || 'Anonymous',
        email: user.email || '',
        role: user.email === 'pranabdas717@gmail.com' ? 'admin' : 'sales',
        photoUrl: user.photoURL || undefined,
        language: lang,
        lastActive: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isSupervisor = profile?.role === 'supervisor';
  const isManager = isAdmin || isSupervisor;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 px-4 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-rose-100 max-w-sm">
          <p className="text-rose-500 font-black mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black">আবার চেষ্টা করুন</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6 font-sans text-slate-800">
        <div className="max-w-sm w-full space-y-12 flex flex-col items-center">
          
          {/* Logo Section */}
          <div className="relative group perspective-1000 scale-110">
             <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
             <div className="relative flex flex-col items-center">
                {/* Stylized SMC Logo based on image */}
                <div className="w-32 h-32 flex items-center justify-center relative">
                   {/* This is a visual approximation of the logo in the picture */}
                   <div className="flex flex-col items-center">
                      <div className="text-blue-800 font-bold text-2xl tracking-[0.2em] mb-1">SMC</div>
                      <div className="border border-blue-800 p-1.5 flex items-center gap-1">
                         <div className="w-1.5 h-4 bg-blue-800 rounded-full"></div>
                         <div className="w-2.5 h-6 bg-blue-800 rounded-full"></div>
                         <div className="w-2 h-5 bg-blue-800 rounded-full"></div>
                      </div>
                      <div className="text-blue-800 font-bold text-xs mt-1 tracking-tight">এসএমসি</div>
                      <div className="text-blue-800 text-[8px] font-medium tracking-widest mt-0.5">উন্নত জীবন</div>
                   </div>
                </div>
             </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-4xl font-semibold text-blue-600 tracking-tight">প্রতিদিনের সেলস একটিভিটি</h1>
          </div>

          <div className="w-full space-y-4">
            
            {authError && (
              <div className="text-rose-500 text-xs font-bold text-center px-4 animate-shake">
                {authError}
              </div>
            )}

            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className={cn(
                "w-full flex items-center justify-center text-white font-semibold text-xl py-5 rounded-[1.25rem] transition-all shadow-xl active:scale-[0.98] mt-4",
                isAuthenticating ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200/50"
              )}
            >
              {isAuthenticating ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                "Google দিয়ে Login করুন"
              )}
            </button>
          </div>

          <div className="text-center pt-8">
            <p className="text-slate-400 text-sm font-medium">Powered by SMC ICT Division</p>
            <p className="text-slate-400 text-[10px] mt-1 font-medium">Copyright © {new Date().getFullYear()} SMC, ICTD All rights reserved.</p>
          </div>
        </div>
      </div>
    );
  }

  if (user && !profile && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4 font-sans text-slate-900">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-200">
            <UserIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">আপনার পরিচয়</h2>
          <p className="text-slate-500 mb-8 font-medium">এগিয়ে যেতে আপনার আইডি নম্বর প্রদান করুন।</p>
          
          <div className="space-y-4 text-left">
            <div className="group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">কর্মচারী আইডি (Employee ID)</label>
              <input
                type="text"
                placeholder="ID নম্বর লিখুন"
                value={employeeIdInput}
                onChange={(e) => setEmployeeIdInput(e.target.value)}
                className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-black text-slate-900 text-lg placeholder:text-slate-300"
              />
            </div>
            
            <button
              onClick={handleInitialSetup}
              disabled={!employeeIdInput.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-5 px-6 rounded-3xl transition-all active:scale-[0.98] shadow-xl shadow-blue-200 mt-4 text-lg"
            >
              প্রবেশ করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar - Unified for Mobile and Tablet/Desktop */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside 
        className={cn(
          "fixed inset-y-0 left-0 w-72 bg-slate-900 text-white flex flex-col z-[70] transition-transform duration-300 transform border-r border-slate-800 lg:static lg:translate-x-0 h-screen shrink-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-8 flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-500/20 text-white">C</div>
            <span className="text-xl font-bold tracking-tight">কুমিল্লা সেলস</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          <SidebarLink 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label={t.dashboard} 
          />
          <SidebarLink 
            active={activeTab === 'reports'} 
            onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }} 
            icon={<BarChart3 className="w-5 h-5" />} 
            label={t.reportsBanner} 
          />
          <SidebarLink 
            active={activeTab === 'targets'} 
            onClick={() => { setActiveTab('targets'); setIsSidebarOpen(false); }} 
            icon={<TargetIcon className="w-5 h-5" />} 
            label={t.targets} 
          />
          <SidebarLink 
            active={activeTab === 'routes'} 
            onClick={() => { setActiveTab('routes'); setIsSidebarOpen(false); }} 
            icon={<MapPin className="w-5 h-5" />} 
            label={t.routes} 
          />
          <SidebarLink 
            active={activeTab === 'outlets'} 
            onClick={() => { setActiveTab('outlets'); setIsSidebarOpen(false); }} 
            icon={<Store className="w-5 h-5" />} 
            label={t.outlets} 
          />
          <SidebarLink 
            active={activeTab === 'orders'} 
            onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }} 
            icon={<ShoppingCart className="w-5 h-5" />} 
            label={t.orders} 
          />
          <SidebarLink 
            active={activeTab === 'sales'} 
            onClick={() => { setActiveTab('sales'); setIsSidebarOpen(false); }} 
            icon={<TrendingUp className="w-5 h-5" />} 
            label={t.sales} 
          />
          {isManager && (
            <SidebarLink 
              active={activeTab === 'attendance'} 
              onClick={() => { setActiveTab('attendance'); setIsSidebarOpen(false); }} 
              icon={<Clock className="w-5 h-5" />} 
              label={t.attendance} 
            />
          )}
          {isManager && (
            <SidebarLink 
              active={activeTab === 'team'} 
              onClick={() => { setActiveTab('team'); setIsSidebarOpen(false); }} 
              icon={<UserIcon className="w-5 h-5" />} 
              label={t.team} 
            />
          )}
          {isAdmin && (
            <SidebarLink 
              active={activeTab === 'territory'} 
              onClick={() => { setActiveTab('territory'); setIsSidebarOpen(false); }} 
              icon={<Flag className="w-5 h-5" />} 
              label={t.territory} 
            />
          )}
          {isAdmin && (
            <SidebarLink 
              active={activeTab === 'map'} 
              onClick={() => { setActiveTab('map'); setIsSidebarOpen(false); }} 
              icon={<MapPin className="w-5 h-5" />} 
              label="লাইভ লোকেশন" 
            />
          )}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-2xl border border-slate-700">
            <img src={user?.photoURL || profile?.photoUrl || undefined} className="w-10 h-10 rounded-full border-2 border-slate-600" alt="" />
            <div className="overflow-hidden">
              <p className="text-sm font-black truncate">{profile?.name}</p>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">ID: {profile?.employeeId || 'N/A'}</p>
            </div>
            <button onClick={handleLogOut} className="ml-auto text-slate-500 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/50 backdrop-blur-xl border-b border-slate-200/50 flex items-center justify-between px-8 sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Menu className="w-8 h-8" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 group transition-transform hover:rotate-3 hidden sm:flex">
                <LayoutDashboard className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl sm:text-2xl text-slate-900 leading-tight tracking-tighter">{t.loginTitle}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{isAdmin ? t.adminPanel : t.salesActivity}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all"
            >
              <Languages className="w-3 h-3" />
              {lang === 'bn' ? 'English' : 'বাংলা'}
            </button>
            <div className="hidden md:flex flex-col text-right mr-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {lang === 'bn' 
                  ? new Date().toLocaleDateString('bn-BD', { month: 'long', day: 'numeric', year: 'numeric' })
                  : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                }
              </span>
            </div>
            <NotificationBell />
            <div className="flex items-center gap-3">
              <img src={user?.photoURL || profile?.photoUrl || undefined} className="w-8 h-8 rounded-full border border-slate-200" alt="" />
              <button onClick={handleLogOut} className="hidden sm:block text-slate-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto pb-24 lg:pb-8">
          {isManager ? (
            <AdminDashboard activeTab={activeTab} profile={profile} />
          ) : (
            <SalesView activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} />
          )}
        </main>
      </div>

      {/* Mobile Nav - Simple Bottom Bar for common actions */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-3 lg:hidden flex justify-around z-50">
        <MobileNavLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-6 h-6" />} label={t.dashboard} />
        <MobileNavLink active={activeTab === 'routes'} onClick={() => setActiveTab('routes')} icon={<MapPin className="w-6 h-6" />} label={t.routes} />
        <MobileNavLink active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<BarChart3 className="w-6 h-6" />} label={t.reportsBanner} />
        <MobileNavLink active={activeTab === 'targets'} onClick={() => setActiveTab('targets')} icon={<TargetIcon className="w-6 h-6" />} label={t.targets} />
        <MobileNavLink active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingCart className="w-6 h-6" />} label={t.orders} />
      </nav>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all",
        active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition-all", active ? "text-blue-600 scale-110" : "text-slate-400")}>
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
