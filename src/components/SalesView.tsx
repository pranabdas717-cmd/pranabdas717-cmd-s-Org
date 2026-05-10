import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, limit, getDocs, setDoc, doc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Package, MapPin, CheckCircle2, History, Send, Plus, Minus, LogOut, Store, FileText, Phone, User as UserIcon, Navigation, BarChart3, Target as TargetIcon, TrendingUp, Languages, Loader2, Clock, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { Order, OrderItem, Outlet, Target, UserProfile, Attendance, Route } from '../types';
import { PRODUCT_LIST, Product } from '../constants';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { translations } from '../i18n';

interface SalesViewProps {
  activeTab: 'dashboard' | 'orders' | 'map' | 'outlets' | 'reports' | 'targets' | 'sales' | 'team' | 'territory' | 'attendance' | 'routes';
  setActiveTab: (tab: 'dashboard' | 'orders' | 'map' | 'outlets' | 'reports' | 'targets' | 'sales' | 'team' | 'territory' | 'attendance' | 'routes') => void;
  profile: UserProfile | null;
}

export default function SalesView({ activeTab, setActiveTab, profile }: SalesViewProps) {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [locationInterval, setLocationInterval] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Route Form state
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [selectedRouteOutlets, setSelectedRouteOutlets] = useState<string[]>([]);

  // Target Form state
  const [isSettingTarget, setIsSettingTarget] = useState(false);
  const [monthlyTargetInput, setMonthlyTargetInput] = useState('');
  const [monthlyProductTargetInput, setMonthlyProductTargetInput] = useState('');
  const [workingDaysInput, setWorkingDaysInput] = useState('26');

  // Report Filter state
  const [reportTab, setReportTab] = useState<'shop' | 'product' | 'memo'>('shop');

  // Report View state
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [selectedStoreForHistory, setSelectedStoreForHistory] = useState<Outlet | null>(null);
  const [storeHistory, setStoreHistory] = useState<Order[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sale' | 'return'>('all');

  // Sales/Order Sub-tab
  const [salesSubTab, setSalesSubTab] = useState<'orders' | 'sales'>('orders');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'delivered' | 'cancelled'>('all');

  const lang = profile?.language || 'bn';
  const t = translations[lang];

  // Outlet State
  const [showOutletForm, setShowOutletForm] = useState(false);
  const [isSavingOutlet, setIsSavingOutlet] = useState(false);
  const [outletName, setOutletName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [outletPhone, setOutletPhone] = useState('');
  const [outletAddress, setOutletAddress] = useState('');

  // Order Form State
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [memoNumber, setMemoNumber] = useState('');
  const [storeName, setStoreName] = useState('');
  const [isReturn, setIsReturn] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([{ name: '', quantity: 1, price: 0 }]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch Orders for current month for stats
    const start = startOfMonth(new Date());
    const ordersQuery = query(
      collection(db, 'orders'),
      where('salesRepId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // Fetch Outlets
    const outletsQuery = query(
      collection(db, 'outlets'),
      where('salesRepId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeOutlets = onSnapshot(outletsQuery, (snapshot) => {
      const outletsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Outlet));
      setOutlets(outletsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'outlets');
    });

    // Fetch Current Target
    const now = new Date();
    const monthStr = format(now, 'MMMM');
    const yearNum = now.getFullYear();
    const targetsQuery = query(
      collection(db, 'targets'),
      where('userId', '==', auth.currentUser.uid),
      where('month', '==', monthStr),
      where('year', '==', yearNum),
      limit(1)
    );

    const unsubscribeTargets = onSnapshot(targetsQuery, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentTarget({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Target);
      } else {
        setCurrentTarget(null);
      }
    });

    // Fetch Today's Attendance
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('userId', '==', auth.currentUser.uid),
      where('date', '==', todayStr),
      limit(1)
    );

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      if (!snapshot.empty) {
        const att = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Attendance;
        setTodayAttendance(att);
        if (att.status === 'confirmed' && att.type === 'present') {
           setIsCheckedIn(true);
           // Start location tracking if not already
           if (!locationInterval) {
             updateLocation();
             const interval = window.setInterval(updateLocation, 60000);
             setLocationInterval(interval);
           }
        } else {
           setIsCheckedIn(false);
        }
      } else {
        setTodayAttendance(null);
        setIsCheckedIn(false);
      }
    });

    // Fetch Routes
    const routesQuery = query(
      collection(db, 'routes'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('dayNumber', 'asc')
    );

    const unsubscribeRoutes = onSnapshot(routesQuery, (snapshot) => {
      const routesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
      setRoutes(routesData);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeOutlets();
      unsubscribeTargets();
      unsubscribeAttendance();
      unsubscribeRoutes();
    };
  }, [locationInterval]);

  const saveTarget = async () => {
    if (!auth.currentUser || !monthlyTargetInput) return;
    setIsSettingTarget(true);
    const amount = parseFloat(monthlyTargetInput);
    const productAmount = parseFloat(monthlyProductTargetInput) || 0;
    const wDays = parseInt(workingDaysInput) || 26;
    const daily = amount / wDays;
    const dailyProd = productAmount / wDays;
    const now = new Date();
    
    try {
      const targetData: Omit<Target, 'id'> = {
        userId: auth.currentUser.uid,
        userName: profile?.name || auth.currentUser.displayName || 'Anonymous',
        month: format(now, 'MMMM'),
        year: now.getFullYear(),
        monthlyTarget: amount,
        workingDays: wDays,
        dailyTarget: daily,
        monthlyProductTarget: productAmount,
        dailyProductTarget: dailyProd,
        updatedAt: serverTimestamp()
      };

      if (currentTarget?.id) {
        // Edit existing (Update logic would go here if we used updateDoc, but for simplicity we can just recreate or stick to one doc)
        // I'll use addDoc and fetch logic handles the rest, but setDoc is better if we have a predictable ID.
        // Let's use a unique ID based on userId-month-year
        const targetId = `${auth.currentUser.uid}-${targetData.month}-${targetData.year}`;
        await setDoc(doc(db, 'targets', targetId), targetData);
      } else {
        const targetId = `${auth.currentUser.uid}-${targetData.month}-${targetData.year}`;
        await setDoc(doc(db, 'targets', targetId), targetData);
      }
      setMonthlyTargetInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'targets');
    } finally {
      setIsSettingTarget(false);
    }
  };

  const todaysOrders = orders.filter(o => {
    if (!o.timestamp) return false;
    const date = o.timestamp.toDate ? o.timestamp.toDate() : new Date(o.timestamp);
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  });

  const dailyTotal = todaysOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  
  // Day indexing: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // We want 1-6 mapping to business days. Let's say Saturday=1, ..., Thursday=6
  const getDayNumber = (date: Date) => {
    const day = date.getDay();
    if (day === 5) return 0; // Friday (Holiday)
    if (day === 6) return 1; // Saturday
    return day + 2; // Sunday=2, Monday=3, Tuesday=4, Wednesday=5, Thursday=6
  };
  
  const currentDayNum = getDayNumber(new Date());
  const todayRoute = routes.find(r => r.dayNumber === currentDayNum);
  
  const todayTargetAmount = currentTarget && todayRoute 
    ? (currentTarget.monthlyTarget * (todayRoute.weightPercentage / 100))
    : (currentTarget?.dailyTarget || 0);

  const todayTargetProduct = currentTarget && todayRoute
    ? ((currentTarget.monthlyProductTarget || 0) * (todayRoute.weightPercentage / 100))
    : (currentTarget?.dailyProductTarget || 0);

  const dailyProgress = todayTargetAmount ? (dailyTotal / todayTargetAmount) * 100 : 0;

  // Performance Metrics
  const strikeRate = todayRoute?.outletIds.length 
    ? (todaysOrders.length / todayRoute.outletIds.length) * 100 
    : 0;
  
  const perMemoValue = todaysOrders.length 
    ? dailyTotal / todaysOrders.length 
    : 0;
  
  const lpc = todaysOrders.length 
    ? todaysOrders.reduce((sum, o) => sum + o.items.length, 0) / todaysOrders.length 
    : 0;

  const cumulativeSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const requiredPerMemo = (todayTargetAmount > dailyTotal && todaysOrders.length > 0)
    ? (todayTargetAmount - dailyTotal) / Math.max(1, (todayRoute?.outletIds.length || 1) - todaysOrders.length)
    : 0;

  // Reporting Logic
  const getShopSummary = () => {
    const summary: { [key: string]: number } = {};
    orders.forEach(o => {
      summary[o.customerName] = (summary[o.customerName] || 0) + o.totalAmount;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  };

  const getProductSummary = () => {
    const summary: { [key: string]: number } = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        summary[item.name] = (summary[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  };

  const updateLocation = () => {
    if (!navigator.geolocation || !auth.currentUser) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await addDoc(collection(db, 'locations'), {
          userId: auth.currentUser?.uid,
          userName: profile?.name || auth.currentUser?.displayName,
          supervisorId: profile?.supervisorId || '',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: serverTimestamp(),
          accuracy: position.coords.accuracy,
          role: profile?.role
        });
      } catch (error) {
        console.error("Error updating location", error);
      }
    }, (error) => {
      console.error("Geolocation error during background update:", error);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  };

  const handleCheckIn = async (type: 'present' | 'absent' | 'leave') => {
    if (!navigator.geolocation || !auth.currentUser) {
      alert("Location access is required for attendance.");
      return;
    }

    setIsSubmittingAttendance(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await addDoc(collection(db, 'attendance'), {
          userId: auth.currentUser?.uid,
          userName: profile?.name,
          supervisorId: profile?.supervisorId,
          type: type,
          status: 'pending',
          date: todayStr,
          timestamp: serverTimestamp(),
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });

        // Notify supervisor
        if (profile?.supervisorId) {
          await addDoc(collection(db, 'notifications'), {
            userId: profile.supervisorId,
            title: 'হাজীরা অনুমোদন!',
            message: `${profile.name} হাজীরা সাবমিট করেছেন। দয়াকরে অনুমোদন করুন।`,
            type: 'system',
            read: false,
            timestamp: serverTimestamp()
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'attendance');
      } finally {
        setIsSubmittingAttendance(false);
      }
    }, (error) => {
      setIsSubmittingAttendance(false);
      alert("লোকেশন পাওয়া যাচ্ছে না। ফোনের জিপিএস অন করুন।");
    });
  };

  const handleCheckOut = async () => {
    if (!navigator.geolocation || !auth.currentUser) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await addDoc(collection(db, 'attendance'), {
          userId: auth.currentUser?.uid,
          userName: profile?.name || auth.currentUser?.displayName,
          supervisorId: profile?.supervisorId || '',
          type: 'check-out',
          status: 'pending',
          date: format(new Date(), 'yyyy-MM-dd'),
          timestamp: serverTimestamp(),
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });
        setIsCheckedIn(false);
        if (locationInterval) {
          clearInterval(locationInterval);
          setLocationInterval(null);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'attendance');
      }
    });
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, price: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const saveRoute = async (dayNum: number, routeName: string, weight: number, outletIds: string[]) => {
    if (!auth.currentUser) return;
    setIsSavingRoute(true);
    try {
      const routeId = `${auth.currentUser.uid}-day-${dayNum}`;
      const routeData: Omit<Route, 'id'> = {
        userId: auth.currentUser.uid,
        dayNumber: dayNum,
        routeName,
        weightPercentage: weight,
        outletIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'routes', routeId), routeData);
      setEditingRoute(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'routes');
    } finally {
      setIsSavingRoute(false);
    }
  };
  
  const handleProductSelect = (index: number, productName: string) => {
    const product = PRODUCT_LIST.find(p => p.name === productName);
    if (product) {
      const newItems = [...items];
      newItems[index] = { 
        ...newItems[index], 
        name: product.name, 
        price: product.price 
      };
      setItems(newItems);
    }
  };

  const handleOutletSelect = (id: string) => {
    const outlet = outlets.find(o => o.id === id);
    if (outlet) {
      setSelectedOutletId(id);
      setStoreName(outlet.name);
      setCustomerName(outlet.ownerName);
      setCustomerPhone(outlet.phone);
      setAddress(outlet.address);
    } else {
      setSelectedOutletId('');
      setStoreName('');
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
    }
  };

  const saveOutlet = async () => {
    if (!auth.currentUser || !outletName || !ownerName || !outletPhone || !outletAddress) {
      alert("দয়াকরে সব তথ্য সঠিক ভাবে পূরণ করুন।");
      return;
    }

    setIsSavingOutlet(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await addDoc(collection(db, 'outlets'), {
          salesRepId: auth.currentUser?.uid,
          name: outletName,
          ownerName,
          phone: outletPhone,
          address: outletAddress,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          },
          createdAt: serverTimestamp()
        });

        setShowOutletForm(false);
        setOutletName('');
        setOwnerName('');
        setOutletPhone('');
        setOutletAddress('');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'outlets');
      } finally {
        setIsSavingOutlet(false);
      }
    }, (error) => {
      setIsSavingOutlet(false);
      alert("লোকেশন ছাড়া আউটলেট যোগ করা সম্ভব নয়।");
    });
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const fetchStoreHistory = async (outletId: string) => {
    setIsFetchingHistory(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where('outletId', '==', outletId),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setStoreHistory(history);
    } catch (err) {
      console.error("Error fetching history", err);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const submitOrder = async () => {
    if (!auth.currentUser || !customerName || items.some(i => !i.name)) {
      alert("দয়াকরে সব তথ্য সঠিক ভাবে পূরণ করুন।");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);

    if (totalAmount <= 0) {
      alert("কমপক্ষে একটি পণ্য নির্বাচন করুন।");
      setIsSubmitting(false);
      return;
    }

    // Timeout for geolocation
    const geoTimeout = setTimeout(() => {
      setIsSubmitting(false);
      alert("লোকেশন পাওয়া যাচ্ছে না। ইন্টারনেট কানেকশন চেক করে আবার চেষ্টা করুন।");
    }, 10000);

    navigator.geolocation.getCurrentPosition(async (position) => {
      clearTimeout(geoTimeout);
      try {
        await addDoc(collection(db, 'orders'), {
          salesRepId: auth.currentUser?.uid,
          salesRepName: profile?.name || auth.currentUser?.displayName || 'Anonymous',
          supervisorId: profile?.supervisorId || null,
          outletId: selectedOutletId || null,
          memoNumber,
          customerName: storeName || customerName,
          customerPhone,
          address,
          items,
          totalAmount,
          status: isReturn ? 'returned' : 'pending',
          type: isReturn ? 'return' : 'order',
          timestamp: serverTimestamp(),
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });

        try {
          // Notifications
          // Notify Supervisor if exists
          if (profile?.supervisorId) {
            await addDoc(collection(db, 'notifications'), {
              userId: profile.supervisorId,
              title: 'অনুমোদনের জন্য নতুন অর্ডার!',
              message: `${profile.name} একটি নতুন অর্ডার (৳${totalAmount}) সাবমিট করেছেন যা আপনার অনুমোদনের অপেক্ষায়।`,
              type: 'order',
              read: false,
              timestamp: serverTimestamp()
            });
          }

          // Also notify Admins
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'), limit(5));
          const adminDocs = await getDocs(adminQuery);
          
          for (const adminDoc of adminDocs.docs) {
            await addDoc(collection(db, 'notifications'), {
              userId: adminDoc.id,
              title: 'নতুন অর্ডার এসেছে!',
              message: `${auth.currentUser?.displayName} একটি নতুন অর্ডার (৳${totalAmount}) সাবমিট করেছেন।`,
              type: 'order',
              read: false,
              timestamp: serverTimestamp()
            });
          }
        } catch (notifErr) {
          console.warn("Notification failed, but order was saved", notifErr);
        }

        const newDailyTotal = dailyTotal + totalAmount;
        const newDailyProgress = currentTarget?.dailyTarget ? Math.round((newDailyTotal / currentTarget.dailyTarget) * 100) : 0;

        await addDoc(collection(db, 'notifications'), {
          userId: auth.currentUser?.uid,
          title: 'অর্ডার নিশ্চিত!',
          message: `আপনার অর্ডার (মেমো: ${memoNumber || 'N/A'}) সফলভাবে রেকর্ড করা হয়েছে। আজকের টার্গেটের ${newDailyProgress}% অর্জিত হয়েছে।`,
          type: 'order',
          read: false,
          timestamp: serverTimestamp()
        });

        alert(`অর্ডার সফলভাবে সাবমিট হয়েছে। আজকের টার্গেটের ${newDailyProgress}% অর্জিত হয়েছে!`);

        setShowOrderForm(false);
        setIsReturn(false);
        setCustomerName('');
        setCustomerPhone('');
        setAddress('');
        setMemoNumber('');
        setStoreName('');
        setItems([{ name: '', quantity: 1, price: 0 }]);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'orders');
      } finally {
        setIsSubmitting(false);
      }
    }, (error) => {
      clearTimeout(geoTimeout);
      setIsSubmitting(false);
      console.error("Geo error:", error);
      alert("লোকেশন ছাড়া অর্ডার সাবমিট করা সম্ভব নয়। ফোনের লোকেশন অন করুন।");
    });
  };

  if (!isCheckedIn && todayAttendance?.type !== 'leave' && todayAttendance?.type !== 'absent') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center space-y-12">
        <div className="space-y-4">
          <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-200 mx-auto animate-bounce">
            <UserIcon className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{t.markAttendance}</h2>
          <p className="text-slate-500 font-bold max-w-xs mx-auto">সুপারভাইজার হাজীরা নিশ্চিত করলে আপনি কাজ শুরু করতে পারবেন।</p>
        </div>

        {!todayAttendance ? (
          <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
            <button
              onClick={() => handleCheckIn('present')}
              disabled={isSubmittingAttendance}
              className="group bg-blue-600 text-white p-6 rounded-[2rem] font-black text-xl shadow-xl shadow-blue-100 flex items-center justify-center gap-4 transition-all hover:bg-blue-700 active:scale-95 disabled:bg-slate-300"
            >
              {isSubmittingAttendance ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
              {t.present}
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleCheckIn('absent')}
                disabled={isSubmittingAttendance}
                className="bg-rose-50 text-rose-600 p-5 rounded-[2rem] font-black text-sm border border-rose-100 hover:bg-rose-100 transition-all active:scale-95 disabled:bg-slate-50 disabled:text-slate-200"
              >
                {t.absent}
              </button>
              <button
                onClick={() => handleCheckIn('leave')}
                disabled={isSubmittingAttendance}
                className="bg-amber-50 text-amber-600 p-5 rounded-[2rem] font-black text-sm border border-amber-100 hover:bg-amber-100 transition-all active:scale-95 disabled:bg-slate-50 disabled:text-slate-200"
              >
                {t.leave}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 w-full max-w-xs">
            <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-4">
              <div className="w-20 h-20 bg-white rounded-2xl shadow-xl shadow-slate-100 flex items-center justify-center mx-auto">
                 <Clock className="w-10 h-10 text-amber-500 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.attendanceStatus}</p>
                <p className="text-xl font-black text-slate-900 tracking-tight">
                  {todayAttendance.type === 'present' ? t.present : todayAttendance.type === 'absent' ? t.absent : t.leave}
                </p>
                <div className="mt-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {t.waitingForApproval}
                </div>
              </div>
            </div>
            
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">দয়াকরে সুপারভাইজারকে হাজীরা অনুমোদন করতে বলুন</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32 max-w-2xl mx-auto">
      {activeTab === 'dashboard' && (
        <>
          {/* Today's Route Info */}
          {todayRoute && (
            <section className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <MapPin className="w-24 h-24 rotate-12" />
               </div>
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{t.day} {todayRoute.dayNumber}</div>
                     <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{t.weight} {todayRoute.weightPercentage}%</div>
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter mb-1 uppercase">{todayRoute.routeName}</h2>
                  <p className="text-blue-100 font-bold flex items-center gap-2">
                    <Store className="w-4 h-4" /> {todayRoute.outletIds.length} {t.outlets}
                  </p>
               </div>
            </section>
          )}

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.cumulativeSales}</p>
                <p className="text-2xl font-black text-slate-900">৳{cumulativeSales.toLocaleString()}</p>
                <div className="absolute top-0 right-0 p-2 opacity-5">
                   <TrendingUp className="w-12 h-12" />
                </div>
             </div>
             <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 shadow-sm relative overflow-hidden">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">{t.requiredPerMemo}</p>
                <p className="text-2xl font-black text-amber-700">৳{Math.round(requiredPerMemo).toLocaleString()}</p>
                <div className="absolute top-0 right-0 p-2 opacity-5">
                   <FileText className="w-12 h-12" />
                </div>
             </div>
          </div>

          {/* Main Dashboard Stats */}
          <section className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative group font-sans">
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tighter">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  আজকের সেলস মনিটরিং
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                 <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dailyTargetAmount}</span>
                      </div>
                      <p className="text-2xl font-black text-slate-900">৳{Math.round(todayTargetAmount).toLocaleString()}</p>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-1000" 
                        style={{ width: `${Math.min(dailyProgress, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                       <span className="text-blue-600">{Math.round(dailyProgress)}% {t.targetMet}</span>
                       <span className="text-slate-400">অর্জিত: ৳{Math.round(dailyTotal)}</span>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dailyTargetProduct}</span>
                      </div>
                      <p className="text-2xl font-black text-slate-900">{Math.round(todayTargetProduct)} <span className="text-xs font-bold text-slate-400 uppercase">Qty</span></p>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000 shadow-sm shadow-emerald-200" 
                        style={{ width: `${Math.min((todaysOrders.reduce((s,o)=>s+o.items.reduce((si,i)=>si+i.quantity,0),0) / Math.max(1, todayTargetProduct)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                       <span className="text-emerald-600">{Math.round((todaysOrders.reduce((s,o)=>s+o.items.reduce((si,i)=>si+i.quantity,0),0) / Math.max(1, todayTargetProduct)) * 100)}% {t.targetMet}</span>
                       <span className="text-slate-400">অর্জিত: {todaysOrders.reduce((s,o)=>s+o.items.reduce((si,i)=>si+i.quantity,0),0)} </span>
                    </div>
                 </div>
              </div>

              {/* Performance Metrics Row */}
              <div className="grid grid-cols-3 gap-3 border-t border-slate-50 pt-8">
                 <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.strikeRate}</p>
                    <p className="text-sm font-black text-slate-900">{Math.round(strikeRate)}%</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.perMemoValue}</p>
                    <p className="text-sm font-black text-slate-900">৳{Math.round(perMemoValue)}</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.lpc}</p>
                    <p className="text-sm font-black text-slate-900">{lpc.toFixed(1)}</p>
                 </div>
              </div>
            </div>
          </section>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => setShowOrderForm(true)}
          className="w-full flex items-center justify-center gap-4 bg-slate-900 text-white p-6 rounded-[2rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 active:scale-[0.98] group"
        >
          <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform" />
          নতুন অর্ডার এন্ট্রি
        </button>
        <button
           onClick={() => setActiveTab('reports')}
           className="w-full flex items-center justify-center gap-4 bg-white text-slate-900 p-6 rounded-[2rem] font-black text-xl border-2 border-slate-100 hover:border-blue-200 transition-all shadow-xl shadow-slate-100 active:scale-[0.98] group"
        >
          <BarChart3 className="w-8 h-8 text-blue-600 transition-transform group-hover:scale-110" />
          রিপোর্ট ও সামারী
        </button>
      </div>

        </>
      )}

      {activeTab === 'routes' && (
        <section className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
                  <MapPin className="w-6 h-6" />
                </div>
                {t.routes}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4, 5, 6].map(day => {
                const route = routes.find(r => r.dayNumber === day);
                return (
                  <div key={day} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 hover:border-blue-200 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.day} {day}</p>
                          <h3 className="font-black text-slate-900 uppercase tracking-tight">{route?.routeName || 'রুট সেট করা নেই'}</h3>
                       </div>
                       <button 
                         onClick={() => {
                           setEditingRoute(route || { dayNumber: day, routeName: '', weightPercentage: 15, outletIds: [], userId: auth.currentUser?.uid || '', createdAt: null, updatedAt: null });
                           setSelectedRouteOutlets(route?.outletIds || []);
                         }}
                         className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all active:scale-95"
                       >
                         <Plus className="w-5 h-5" />
                       </button>
                    </div>
                    {route && (
                      <div className="flex justify-between items-end mt-6">
                         <div className="flex gap-4">
                            <div className="text-center">
                               <p className="text-[8px] font-black text-slate-400 uppercase">{t.outlets}</p>
                               <p className="font-black text-slate-900">{route.outletIds.length}</p>
                            </div>
                            <div className="text-center">
                               <p className="text-[8px] font-black text-slate-400 uppercase">{t.weight}</p>
                               <p className="font-black text-blue-600">{route.weightPercentage}%</p>
                            </div>
                         </div>
                         <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                            Update: {route.updatedAt?.toDate ? format(route.updatedAt.toDate(), 'PP') : 'N/A'}
                         </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {editingRoute && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
                   <h3 className="text-xl font-black uppercase tracking-tight">রুট এডিট করুন (দিন {editingRoute.dayNumber})</h3>
                   <button onClick={() => setEditingRoute(null)} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 rotate-45" />
                   </button>
                </div>
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                   <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">রুটের নাম</label>
                        <input 
                          type="text" 
                          value={editingRoute.routeName}
                          onChange={(e) => setEditingRoute({...editingRoute, routeName: e.target.value})}
                          placeholder="রুটের নাম লিখুন"
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">শতকরা হার (%)</label>
                        <input 
                          type="number" 
                          value={editingRoute.weightPercentage}
                          onChange={(e) => setEditingRoute({...editingRoute, weightPercentage: parseInt(e.target.value) || 0})}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">আউটলেট নির্বাচন করুন ({selectedRouteOutlets.length})</label>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                           {outlets.map(o => (
                             <button
                               key={o.id}
                               onClick={() => {
                                 if (selectedRouteOutlets.includes(o.id!)) {
                                   setSelectedRouteOutlets(selectedRouteOutlets.filter(id => id !== o.id));
                                 } else {
                                   setSelectedRouteOutlets([...selectedRouteOutlets, o.id!]);
                                 }
                               }}
                               className={cn(
                                 "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                                 selectedRouteOutlets.includes(o.id!) ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"
                               )}
                             >
                                <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", selectedRouteOutlets.includes(o.id!) ? "bg-blue-600 text-white" : "bg-white border text-transparent")}>
                                   <CheckCircle2 className="w-3 h-3" />
                                </div>
                                <div>
                                   <p className="text-xs font-black text-slate-900 uppercase">{o.name}</p>
                                   <p className="text-[8px] font-bold text-slate-400 uppercase">{o.ownerName}</p>
                                </div>
                             </button>
                           ))}
                        </div>
                      </div>
                   </div>
                </div>
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                   <button onClick={() => setEditingRoute(null)} className="flex-1 py-4 font-black uppercase text-xs text-slate-400">বাতিল</button>
                   <button 
                     disabled={isSavingRoute}
                     onClick={() => saveRoute(editingRoute.dayNumber, editingRoute.routeName, editingRoute.weightPercentage, selectedRouteOutlets)}
                     className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                   >
                     {isSavingRoute ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                     সেভ করুন
                   </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'targets' && (
        <section className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter mb-8">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                <TargetIcon className="w-6 h-6" />
              </div>
              মার্চ মাসের লক্ষ্যমাত্রা
            </h2>

            <div className="space-y-6">
              <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{format(new Date(), 'MMMM yyyy')}</span>
                </div>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-2">প্রতিদিনের টার্গেট</p>
                <div className="text-5xl font-black text-indigo-600 tracking-tighter">৳{Math.round(currentTarget?.dailyTarget || 0)}</div>
                <p className="text-slate-400 text-xs font-medium mt-4">মান্থলি টার্গেট: ৳{Math.round(currentTarget?.monthlyTarget || 0)} ({currentTarget?.workingDays || 26} কর্মদিবস)</p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">টার্গেট সেট করুন</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">মান্থলি টার্গেট (৳)</label>
                    <input 
                      type="number" 
                      placeholder="টাকার পরিমাণ"
                      value={monthlyTargetInput}
                      onChange={(e) => setMonthlyTargetInput(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">পণ্য টার্গেট (পিস)</label>
                    <input 
                      type="number" 
                      placeholder="পিস/সংখ্যা"
                      value={monthlyProductTargetInput}
                      onChange={(e) => setMonthlyProductTargetInput(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">কর্মদিবস</label>
                    <input 
                      type="number" 
                      placeholder="যেমন: ২৬"
                      value={workingDaysInput}
                      onChange={(e) => setWorkingDaysInput(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </div>
                <button 
                  onClick={saveTarget}
                  disabled={isSettingTarget}
                  className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {isSettingTarget ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-5 h-5" />}
                  টার্গেট সেভ করুন
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
             <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-200">
                <BarChart3 className="w-6 h-6" />
              </div>
              সেলস রিপোর্ট ও সামারী
            </h2>
          </div>

          <div className="bg-white p-2 rounded-[2rem] shadow-xl border border-slate-100 flex gap-2">
            <button 
              onClick={() => setReportTab('shop')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                reportTab === 'shop' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
              )}
            >দোকান অনুযায়ী</button>
            <button 
              onClick={() => setReportTab('product')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                reportTab === 'product' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
              )}
            >পন্য অনুযায়ী</button>
            <button 
              onClick={() => setReportTab('memo')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                reportTab === 'memo' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
              )}
            >মেমো অনুযায়ী</button>
          </div>

          <div className="space-y-4">
            {reportTab === 'shop' && getShopSummary().map(([shop, total]) => (
              <div key={shop} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight">{shop}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">টোটাল সেলস রিপোর্ট</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-lg font-black text-blue-600">৳{total}</p>
                </div>
              </div>
            ))}

            {reportTab === 'product' && getProductSummary().map(([name, qty]) => (
              <div key={name} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight">{name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">বিক্রিত পরিমাণ</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-lg font-black text-indigo-600">{qty} পিস</p>
                </div>
              </div>
            ))}

            {reportTab === 'memo' && orders.map(order => (
              <div key={order.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight">মেমো: {order.memoNumber || 'N/A'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.customerName}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedOrderForView(order)}
                      className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-600 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                   <span className="text-[10px] font-black text-slate-300 uppercase">{order.timestamp?.toDate ? format(order.timestamp.toDate(), 'PPP p') : 'Pending'}</span>
                   <span className="text-xl font-black text-blue-600">৳{order.totalAmount}</span>
                </div>
              </div>
            ))}

            {orders.length === 0 && (
              <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-100 text-center text-slate-300">
                <BarChart3 className="w-16 h-16 mx-auto mb-6 opacity-20" />
                <p className="font-bold text-lg uppercase tracking-tight">কোনো ডাটা পাওয়া যায়নি</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'orders' && (
        <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-200">
              <Package className="w-6 h-6" />
            </div>
            সাম্প্রতিক অর্ডার সমূহ
          </h2>
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
          {(['all', 'pending', 'confirmed', 'delivered', 'cancelled'] as const).map(status => (
            <button
               key={status}
               onClick={() => setStatusFilter(status)}
               className={cn(
                 "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
                 statusFilter === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
               )}
            >
              {status === 'all' ? 'সব' : status}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : orders.filter(o => statusFilter === 'all' || o.status === statusFilter).length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-100 text-center text-slate-300">
            <Package className="w-16 h-16 mx-auto mb-6 opacity-20" />
            <p className="font-bold text-lg uppercase tracking-tight">কোনো অর্ডার পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.filter(o => statusFilter === 'all' || o.status === statusFilter).map((order) => (
              <div key={order.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100 transition-all hover:shadow-2xl hover:border-blue-100 group relative overflow-hidden">
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h3 className="font-black text-slate-900 text-xl group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none mb-2">{order.customerName}</h3>
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {order.timestamp?.toDate ? format(order.timestamp.toDate(), 'PPP p') : 'Pending...'}
                       </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-2xl shadow-sm border",
                    order.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                    order.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    order.status === 'confirmed' ? "bg-blue-50 text-blue-600 border-blue-100" :
                    order.status === 'delivered' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                    "bg-rose-50 text-rose-600 border-rose-100"
                  )}>
                    {order.status === 'pending' ? 'অপেক্ষা' : 
                     order.status === 'approved' ? 'অনুমোদিত' : 
                     order.status === 'confirmed' ? 'নিশ্চিত' : 
                     order.status === 'delivered' ? 'ডেলিভার্ড' : 'বাতিল'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-50 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors group-hover:scale-110">
                        <Package className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">{order.items.length} টি পণ্য</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-black text-blue-600 tracking-tighter">৳{order.totalAmount}</span>
                  </div>
                </div>

                {/* Decorative blob on hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/30 rounded-full blur-2xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {activeTab === 'sales' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-200">
                <TrendingUp className="w-6 h-6" />
              </div>
              {t.sales} (কনফার্মকৃত)
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.totalSales}</p>
                <p className="text-2xl font-black text-blue-600">৳{orders.filter(o => o.status === 'confirmed' || o.status === 'delivered').reduce((acc, o) => acc + o.totalAmount, 0).toLocaleString()}</p>
             </div>
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট মেমো</p>
                <p className="text-2xl font-black text-slate-900">{orders.filter(o => o.status === 'confirmed' || o.status === 'delivered').length}</p>
             </div>
          </div>

          <div className="space-y-4">
            {orders.filter(o => o.status === 'confirmed' || o.status === 'delivered').map(order => (
              <div key={order.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">{order.customerName}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">মেমো: {order.memoNumber || 'N/A'}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      order.status === 'delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {order.status === 'delivered' ? t.delivered : t.confirmed}
                    </span>
                 </div>
                 <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                    <span className="text-[10px] font-black text-slate-300 uppercase">{order.timestamp?.toDate ? format(order.timestamp.toDate(), 'PPP p') : 'Pending'}</span>
                    <span className="text-xl font-black text-blue-600">৳{order.totalAmount}</span>
                 </div>
              </div>
            ))}
            {orders.filter(o => o.status === 'confirmed' || o.status === 'delivered').length === 0 && (
              <div className="bg-white p-20 rounded-[3rem] border border-slate-100 text-center opacity-40">
                 <TrendingUp className="w-16 h-16 mx-auto mb-4" />
                 <p className="font-bold">কোনো বিক্রয় তথ্য পাওয়া যায়নি</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'map' && (
        <section className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-6 text-blue-600 opacity-20" />
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">ম্যাপ ভিউ</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">ম্যাপ ফিচারটি শুধুমাত্র অ্যাডমিন প্যানেলে উপলভ্য যেখানে সেলস টিমের লোকেশন দেখা যায়।</p>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs"
          >
            ড্যাশবোর্ডে ফিরে যান
          </button>
        </section>
      )}

      {activeTab === 'outlets' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Store className="w-6 h-6 text-blue-600" />
                আপনার আউটলেটসমূহ
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">সব মিলিয়ে {outlets.length} টি আউটলেট</p>
            </div>
            <button 
              onClick={() => setShowOutletForm(true)}
              className="bg-blue-600 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" /> নতুন আউটলেট
            </button>
          </div>

          {outlets.length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-center">
              <Store className="w-16 h-16 mx-auto mb-6 text-slate-200" />
              <p className="text-slate-400 font-bold">এখনো কোনো আউটলেট যুক্ত করা হয়নি।</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {outlets.map(outlet => (
                <div key={outlet.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 group hover:border-blue-200 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Store className="w-6 h-6" />
                    </div>
                    {outlet.location && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedStoreForHistory(outlet);
                            fetchStoreHistory(outlet.id!);
                          }}
                          className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-sm"
                          title="View History"
                        >
                          <History className="w-5 h-5" />
                        </button>
                        <a 
                          href={`https://www.google.com/maps?q=${outlet.location.lat},${outlet.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        >
                          <Navigation className="w-5 h-5" />
                        </a>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1 uppercase line-clamp-1">{outlet.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                    <UserIcon className="w-3.5 h-3.5" /> {outlet.ownerName}
                  </div>

                  <div className="space-y-4 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-300" />
                      <span className="text-sm font-bold text-slate-600">{outlet.phone}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-slate-500 leading-relaxed line-clamp-2">{outlet.address}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Order Detail Modal */}
      {selectedOrderForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="p-8 bg-slate-900 text-white relative">
              <button 
                onClick={() => setSelectedOrderForView(null)}
                className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-1">অর্ডার ডিটেইলস</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">মেমো: {selectedOrderForView.memoNumber || 'N/A'}</p>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">দোকানের নাম</p>
                  <p className="font-black text-slate-900 uppercase">{selectedOrderForView.customerName}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">তারিখ ও সময়</p>
                  <p className="font-bold text-slate-600 text-xs">
                    {selectedOrderForView.timestamp?.toDate ? format(selectedOrderForView.timestamp.toDate(), 'PPP p') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">পণ্য তালিকা</p>
                 <div className="space-y-2">
                   {selectedOrderForView.items.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="font-black text-slate-900 text-sm uppercase">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">৳{item.price} x {item.quantity}</p>
                        </div>
                        <p className="font-black text-blue-600">৳{item.price * item.quantity}</p>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                 <span className="text-lg font-black text-slate-900 uppercase">মোট পরিমাণ</span>
                 <span className="text-3xl font-black text-blue-600 uppercase tracking-tighter">৳{selectedOrderForView.totalAmount}</span>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
               <button 
                onClick={() => setSelectedOrderForView(null)}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
               >বন্ধ করুন</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl border border-white/20">
            <div className="p-8 border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-md z-10 flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">নতুন অর্ডার ফরম</h2>
              <button 
                onClick={() => setShowOrderForm(false)} 
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all"
              >
                <Plus className="rotate-45 w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">আউটলেট নির্বাচন করুন (Saved Outlet)</label>
                <select
                  value={selectedOutletId}
                  onChange={(e) => handleOutletSelect(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-bold text-slate-900"
                >
                  <option value="">নতুন/অন্যান্য আউটলেট</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.name} ({o.ownerName})</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-2 px-1 italic">সেভ করা আউটলেট থাকলে এখান থেকে সিলেক্ট করুন, তথ্য অটোমেটিক পূরণ হবে।</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">দোকানের নাম (Store Name)</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      type="text"
                      placeholder="দোকানের নাম লিখুন"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-bold text-slate-900 placeholder:text-slate-300"
                    />
                  </div>
                </div>
                <div className="group">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">মেমো নম্বর (Memo No.)</label>
                   <div className="relative">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      type="text"
                      placeholder="মেমো নং লিখুন"
                      value={memoNumber}
                      onChange={(e) => setMemoNumber(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-bold text-slate-900 placeholder:text-slate-300"
                    />
                  </div>
                </div>
                <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">কাস্টমারের নাম</label>
                  <input
                    type="text"
                    placeholder="নাম লিখুন"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-bold text-slate-900 placeholder:text-slate-300"
                  />
                </div>
                <div className="group">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    placeholder="০১৭xxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-bold text-slate-900 placeholder:text-slate-300"
                  />
                </div>
              </div>
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">ডেলিভারি ঠিকানা</label>
                <textarea
                  placeholder="বিস্তারিত ঠিকানা..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-bold text-slate-900 placeholder:text-slate-300 h-24 resize-none"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">পণ্যের তালিকা</h3>
                  <button onClick={addItem} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> পণ্য যোগ
                  </button>
                </div>
                
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 overflow-hidden relative">
                       <div className="flex-1 space-y-4">
                        <select
                          value={item.name}
                          onChange={(e) => handleProductSelect(index, e.target.value)}
                          className="w-full bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none py-1 font-bold text-slate-800"
                        >
                          <option value="">পণ্য নির্বাচন করুন</option>
                          {PRODUCT_LIST.map(p => (
                            <option key={p.id} value={p.name}>{p.name} - ৳{p.price}</option>
                          ))}
                        </select>
                        <div className="flex gap-4">
                          <div className="flex-1">
                             <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">পরিমাণ</span>
                             <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-100 rounded-lg py-1.5 px-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          <div className="flex-[2]">
                             <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">মূল্য (একক)</span>
                             <input
                              type="number"
                              readOnly
                              value={item.price}
                              className="w-full bg-slate-200/50 rounded-lg py-1.5 px-3 text-sm font-bold text-blue-600 outline-none cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(index)} className="w-8 h-8 bg-rose-50 text-rose-400 rounded-lg flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors mt-0.5">
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t-2 border-dashed border-slate-100">
                <div className="flex justify-between items-center mb-8 px-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">সর্বমোট টাকার পরিমাণ</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-blue-600">৳{items.reduce((acc, item) => acc + (item.quantity * item.price), 0)}</span>
                  </div>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full p-5 rounded-3xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]",
                    isSubmitting 
                      ? "bg-slate-400 cursor-not-allowed text-white" 
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                  )}
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="w-6 h-6" />
                  )}
                  {isSubmitting ? "অর্ডার পাঠানো হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Outlet Modal */}
      {showOutletForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white/20">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">নতুন আউটলেট যোগ করুন</h2>
              <button 
                onClick={() => setShowOutletForm(false)} 
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"
              >
                <Plus className="rotate-45 w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">আউটলেট/দোকানের নাম</label>
                <input
                  type="text"
                  placeholder="দোকানের নাম লিখুন"
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-900"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">মালিকের নাম</label>
                <input
                  type="text"
                  placeholder="মালিকের নাম লিখুন"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-900"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">মোবাইল নম্বর</label>
                <input
                  type="text"
                  placeholder="মোবাইল নম্বর লিখুন"
                  value={outletPhone}
                  onChange={(e) => setOutletPhone(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-900"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">ঠিকানা</label>
                <textarea
                  placeholder="বিস্তারিত ঠিকানা..."
                  value={outletAddress}
                  onChange={(e) => setOutletAddress(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-900 h-24 resize-none"
                />
              </div>

              <button
                onClick={saveOutlet}
                disabled={isSavingOutlet}
                className={cn(
                  "w-full p-5 rounded-3xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3",
                  isSavingOutlet ? "bg-slate-400 text-white" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                )}
              >
                {isSavingOutlet ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Plus className="w-6 h-6" />}
                {isSavingOutlet ? "সেভ হচ্ছে..." : "আউটলেট সেভ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Store History Modal */}
      {selectedStoreForHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
               <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{selectedStoreForHistory.name} - {t.history}</h3>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{selectedStoreForHistory.ownerName}</p>
               </div>
               <button onClick={() => setSelectedStoreForHistory(null)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 rotate-45" />
               </button>
            </div>
            
            <div className="flex bg-slate-50 border-b border-slate-100 p-2">
               <button 
                 onClick={() => setHistoryFilter('all')}
                 className={cn(
                   "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                    historyFilter === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                 )}
               >সবগুলো (All)</button>
               <button 
                 onClick={() => setHistoryFilter('sale')}
                 className={cn(
                   "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                    historyFilter === 'sale' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                 )}
               >অর্ডার (Sales)</button>
               <button 
                 onClick={() => setHistoryFilter('return')}
                 className={cn(
                   "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                    historyFilter === 'return' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                 )}
               >ফেরত (Returns)</button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
               {isFetchingHistory ? (
                 <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
               ) : storeHistory.filter(o => historyFilter === 'all' || o.type === historyFilter).length === 0 ? (
                 <div className="py-20 text-center text-slate-300 font-black uppercase tracking-tight">কোনো হিস্ট্রি পাওয়া যায়নি</div>
               ) : (
                 storeHistory.filter(o => historyFilter === 'all' || o.type === historyFilter).map(order => (
                    <div key={order.id} className={cn(
                      "p-6 rounded-3xl border transition-all",
                      order.type === 'return' ? "bg-rose-50 border-rose-100" : "bg-white border-slate-100"
                    )}>
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.timestamp?.toDate ? format(order.timestamp.toDate(), 'PPP p') : 'N/A'}</p>
                             <h4 className="font-black text-slate-900 uppercase">মেমো: {order.memoNumber || 'N/A'}</h4>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                             order.type === 'return' ? "bg-rose-600 text-white" : "bg-blue-600 text-white"
                          )}>
                             {order.type === 'return' ? 'RETURN' : 'ORDER'}
                          </span>
                       </div>
                       <div className="space-y-2">
                          {order.items.map((item, idx) => (
                             <div key={idx} className="flex justify-between text-xs font-bold text-slate-600">
                                <span>{item.name}</span>
                                <span>x{item.quantity}</span>
                             </div>
                          ))}
                          <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-black text-slate-900 text-sm">
                             <span>মোট</span>
                             <span>৳{order.totalAmount}</span>
                          </div>
                       </div>
                    </div>
                 ))
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
