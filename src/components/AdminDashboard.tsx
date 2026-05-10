import { useState, useEffect, ReactNode } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where, doc, updateDoc, serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingCart, Users, MapPin, TrendingUp, Package, Calendar, Download, Search, CheckCircle2, XCircle, Clock, AlertTriangle, Target as TargetIcon, Plus, Send, FileText, User as UserIcon, Loader2, Save, Flag, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Order, UserLocation, UserProfile, Target, UserRole, Territory, Attendance, Route, Outlet } from '../types';
import MapComponent from './MapComponent';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { translations } from '../i18n';

interface AdminDashboardProps {
  activeTab: 'dashboard' | 'orders' | 'map' | 'targets' | 'reports' | 'team' | 'territory' | 'sales' | 'attendance' | 'routes';
  profile: UserProfile | null;
}

export default function AdminDashboard({ activeTab, profile }: AdminDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const isSupervisor = profile?.role === 'supervisor';

  const lang = profile?.language || 'bn';
  const t = translations[lang];

  // State for user management (Admin only)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Territory management state
  const [isAddingTerritory, setIsAddingTerritory] = useState(false);
  const [newTerritoryName, setNewTerritoryName] = useState('');
  const [selectedTerritorySupervisor, setSelectedTerritorySupervisor] = useState('');
  const [selectedTerritoryMembers, setSelectedTerritoryMembers] = useState<string[]>([]);
  const [isSavingTerritory, setIsSavingTerritory] = useState(false);

  // Target Settings state
  const [selectedRepForTarget, setSelectedRepForTarget] = useState<UserProfile | null>(null);
  const [monthlyTargetAmount, setMonthlyTargetAmount] = useState('');
  const [monthlyProductTarget, setMonthlyProductTarget] = useState('');
  const [workingDays, setWorkingDays] = useState('26');
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // Route state for admin
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [selectedRouteRep, setSelectedRouteRep] = useState<string | null>(null);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [selectedRouteOutlets, setSelectedRouteOutlets] = useState<string[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  // Confirmation State
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Order['status'] | null>(null);
  const [updating, setUpdating] = useState(false);

  // Reporting filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [reportSubTab, setReportSubTab] = useState<'sales' | 'orders'>('sales');

  useEffect(() => {
    if (!profile) return;

    // Filters based on role
    const ordersQuery = isAdmin 
      ? query(collection(db, 'orders'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'orders'), where('supervisorId', '==', profile.id), orderBy('timestamp', 'desc'));

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const locationsQuery = isAdmin 
      ? query(collection(db, 'locations'), orderBy('timestamp', 'desc'), limit(100))
      : query(collection(db, 'locations'), where('supervisorId', '==', profile.id), orderBy('timestamp', 'desc'), limit(100));

    const unsubscribeLocations = onSnapshot(locationsQuery, (snapshot) => {
      const latestMap = new Map();
      snapshot.docs.forEach(doc => {
        const data = doc.data() as UserLocation;
        if (!latestMap.has(data.userId)) {
          latestMap.set(data.userId, { id: doc.id, ...data });
        }
      });
      setLocations(Array.from(latestMap.values()) as UserLocation[]);
    });

    // Fetch team (members managed by this supervisor OR all sales if admin)
    const teamQuery = isAdmin 
      ? query(collection(db, 'users'), where('role', '==', 'sales'))
      : query(collection(db, 'users'), where('supervisorId', '==', profile.id));

    const unsubscribeTeam = onSnapshot(teamQuery, (snapshot) => {
      setTeam(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    });

    if (isAdmin) {
      const unsubscribeAllUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
      });
      return () => {
        unsubscribeOrders();
        unsubscribeLocations();
        unsubscribeTeam();
        unsubscribeAllUsers();
      };
    }

    const unsubscribeTargets = onSnapshot(collection(db, 'targets'), (snapshot) => {
      setTargets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Target)));
    });

    const unsubscribeTerritories = onSnapshot(collection(db, 'territories'), (snapshot) => {
      setTerritories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory)));
    });

    const attendanceQuery = isSupervisor 
      ? query(collection(db, 'attendance'), where('supervisorId', '==', profile.id), orderBy('timestamp', 'desc'))
      : query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      setAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    });

    const unsubscribeRoutes = onSnapshot(collection(db, 'routes'), (snapshot) => {
      setAllRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    });

    const unsubscribeOutlets = onSnapshot(collection(db, 'outlets'), (snapshot) => {
       setOutlets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Outlet)));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeLocations();
      unsubscribeTeam();
      unsubscribeTargets();
      unsubscribeTerritories();
      unsubscribeAttendance();
      unsubscribeRoutes();
      unsubscribeOutlets();
    };
  }, [profile?.id, profile?.role]);

  const handleUpdateUser = async (userId: string, data: Partial<UserProfile>) => {
    setIsUpdatingUser(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setEditingUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleSaveTerritory = async () => {
    if (!newTerritoryName || !selectedTerritorySupervisor) return;
    setIsSavingTerritory(true);
    try {
      if (isAddingTerritory) {
        await addDoc(collection(db, 'territories'), {
          name: newTerritoryName,
          supervisorId: selectedTerritorySupervisor,
          memberIds: selectedTerritoryMembers,
          createdAt: serverTimestamp()
        });
      }
      setIsAddingTerritory(false);
      setNewTerritoryName('');
      setSelectedTerritorySupervisor('');
      setSelectedTerritoryMembers([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'territories');
    } finally {
      setIsSavingTerritory(false);
    }
  };

  const handleSetTarget = async () => {
    if (!selectedRepForTarget || !monthlyTargetAmount) return;
    setIsSavingTarget(true);
    const amount = parseFloat(monthlyTargetAmount);
    const productAmount = parseFloat(monthlyProductTarget) || 0;
    const wDays = parseInt(workingDays) || 26;
    const daily = amount / wDays;
    const dailyProd = productAmount / wDays;
    const now = new Date();
    const month = format(now, 'MMMM');
    const year = now.getFullYear();

    try {
      const targetId = `${selectedRepForTarget.id}-${month}-${year}`;
      await setDoc(doc(db, 'targets', targetId), {
        userId: selectedRepForTarget.id,
        userName: selectedRepForTarget.name,
        month,
        year,
        monthlyTarget: amount,
        workingDays: wDays,
        dailyTarget: daily,
        monthlyProductTarget: productAmount,
        dailyProductTarget: dailyProd,
        updatedAt: serverTimestamp()
      });
      setSelectedRepForTarget(null);
      setMonthlyTargetAmount('');
      setMonthlyProductTarget('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'targets');
    } finally {
      setIsSavingTarget(false);
    }
  };

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleUpdateAttendance = async (attendanceId: string, status: 'confirmed' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'attendance', attendanceId), {
        status,
        updatedAt: serverTimestamp()
      });
      
      const att = attendances.find(a => a.id === attendanceId);
      if (att) {
        await addDoc(collection(db, 'notifications'), {
          userId: att.userId,
          title: `হাজীরা ${status === 'confirmed' ? 'নিশ্চিত' : 'বাতিল'} করা হয়েছে`,
          message: status === 'confirmed' 
            ? 'আপনার আজকের হাজীরা সুপারভাইজার নিশ্চিত করেছেন। এখন আপনি কাজ শুরু করতে পারেন।' 
            : 'আপনার হাজীরা বাতিল করা হয়েছে। দয়াকরে সুপারভাইজারের সাথে কথা বলুন।',
          type: 'system',
          read: false,
          timestamp: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'attendance');
    }
  };

  const handleUpdateStatus = async (status: Order['status']) => {
    if (!selectedOrder?.id) return;
    
    if ((status === 'delivered' || status === 'cancelled') && !showConfirm) {
      setPendingStatus(status);
      setShowConfirm(true);
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        status,
        updatedAt: serverTimestamp()
      });

      // Notify the sales rep
      await addDoc(collection(db, 'notifications'), {
        userId: selectedOrder.salesRepId,
        title: `অর্ডারের অবস্থা পরিবর্তন হয়েছে!`,
        message: `আপনার অর্ডার #${selectedOrder.memoNumber || 'N/A'} এখন '${status}' অবস্থায় আছে।`,
        type: 'order',
        read: false,
        timestamp: serverTimestamp()
      });

      setShowConfirm(false);
      setPendingStatus(null);
      
      // Update local state for modal
      setSelectedOrder({ ...selectedOrder, status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'orders');
    } finally {
      setUpdating(false);
    }
  };

  const downloadReport = () => {
    const headers = ["Date", "Memo No", "Store/Customer", "SalesRep", "Amount", "Status"];
    const rows = filteredOrders.map(o => [
      o.timestamp?.toDate ? format(o.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : 'N/A',
      o.memoNumber || 'N/A',
      o.customerName,
      o.salesRepName,
      o.totalAmount,
      o.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOrders = orders.filter(order => {
    if (!order.timestamp) return false;
    const orderDate = order.timestamp.toDate();
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    
    const matchesDate = isWithinInterval(orderDate, { start, end });
    const matchesSearch = 
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.memoNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.salesRepName?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchesDate && matchesSearch;
  });

  const totalSalesInRange = filteredOrders.reduce((acc, order) => acc + order.totalAmount, 0);

  const salesByDate = orders.reduce((acc: any[], order) => {
    if (!order.timestamp) return acc;
    const date = format(order.timestamp.toDate(), 'MM/dd');
    const existing = acc.find(a => a.date === date);
    if (existing) {
      existing.amount += order.totalAmount;
    } else {
      acc.push({ date, amount: order.totalAmount });
    }
    return acc;
  }, []).slice(0, 7).reverse();

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto relative">
      {/* Ambient background decoration */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-blue-50/50 rounded-full blur-3xl -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-rose-50/30 rounded-full blur-3xl -z-10 pointer-events-none -translate-x-1/2 translate-y-1/2"></div>

      {activeTab === 'dashboard' && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard 
              label="আজকের মোট সেলস" 
              value={`৳${orders.filter(o => o.timestamp && format(o.timestamp.toDate(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).reduce((a, b) => a + b.totalAmount, 0).toLocaleString()}`} 
              icon={<TrendingUp className="w-6 h-6" />} 
              trend="+12% বৃদ্ধি"
              trendColor="text-emerald-500"
              color="bg-blue-600" 
            />
            <StatCard 
              label="সক্রিয় মেম্বার" 
              value={`${locations.length} / ${team.length}`} 
              icon={<Users className="w-6 h-6" />} 
              trend="সক্রিয় ফিল্ডে আছে"
              trendColor="text-slate-400"
              color="bg-slate-900" 
            />
            <StatCard 
              label={lang === 'bn' ? "আজকের হাজীরা" : "Present Today"}
              value={`${attendances.filter(a => a.status === 'confirmed' && a.type === 'present' && a.date === format(new Date(), 'yyyy-MM-dd')).length} / ${team.length}`} 
              icon={<Clock className="w-6 h-6" />} 
              trend={attendances.filter(a => a.status === 'pending').length > 0 ? `${attendances.filter(a => a.status === 'pending').length} পেন্ডিং আছে` : "সবগুলো চেক করা হয়েছে"}
              trendColor={attendances.filter(a => a.status === 'pending').length > 0 ? "text-amber-500" : "text-emerald-500"}
              color="bg-rose-600" 
            />
            <StatCard 
              label="নতুন অর্ডারসমূহ" 
              value={`${orders.length} টি`} 
              icon={<ShoppingCart className="w-6 h-6" />} 
              trend="প্রসেসিং হচ্ছে"
              trendColor="text-blue-500"
              color="bg-orange-500" 
            />
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50 flex flex-col justify-between group hover:border-blue-200 transition-all">
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest">টিম পারফরম্যান্স (লক্ষ্যমাত্রা)</p>
              <div className="mt-6">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">
                    {(() => {
                      const totalTargetValue = targets.length > 0 ? targets.reduce((sum, t) => sum + t.monthlyTarget, 0) : 0;
                      const totalSalesValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
                      return totalTargetValue > 0 ? Math.round((totalSalesValue / totalTargetValue) * 100) : 0;
                    })()}%
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-bold uppercase block tracking-tighter">
                      ৳ {targets.reduce((sum, t) => sum + t.monthlyTarget, 0).toLocaleString()} লক্ষ্য
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-50 ring-4 ring-slate-100/50">
                  <div 
                    className="bg-blue-600 h-full rounded-full shadow-lg shadow-blue-200 transition-all duration-1000 relative"
                    style={{ width: `${Math.min((orders.reduce((sum, o) => sum + o.totalAmount, 0) / (targets.reduce((sum, t) => sum + t.monthlyTarget, 0) || 1)) * 100, 100)}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Visual Row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white p-2 rounded-3xl border border-slate-200 shadow-sm shadow-slate-100 overflow-hidden min-h-[450px]">
              <MapComponent locations={locations} />
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm shadow-slate-100 flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  সাম্প্রতিক কার্যক্রম
                </h3>
              </div>
              <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[350px]">
                {orders.slice(0, 5).map((order, i) => (
                  <div key={order.id} className="flex gap-4 group">
                    <div className={cn("w-1.5 h-12 rounded-full shrink-0 transition-all group-hover:scale-y-110", 
                      i % 3 === 0 ? "bg-blue-500" : i % 3 === 1 ? "bg-emerald-500" : "bg-orange-500"
                    )}></div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-tight">নতুন অর্ডার #{order.memoNumber || order.id?.slice(-4)}</p>
                      <p className="text-xs text-slate-500 mt-1">{order.salesRepName} - {order.customerName}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{order.timestamp?.toDate ? format(order.timestamp.toDate(), 'p') : 'Pending'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="p-4 text-blue-600 text-xs font-bold border-t border-slate-100 hover:bg-slate-50 transition-colors uppercase tracking-widest">
                বড় তালিকা দেখুন
              </button>
            </div>
          </div>

          {/* Charts & Details Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm shadow-slate-100">
               <h3 className="font-bold text-slate-900 mb-8 tracking-tight text-lg">বিক্রয়ের প্রবণতা</h3>
               <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByDate}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#2563eb', fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm shadow-slate-100 overflow-hidden">
               <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 tracking-tight text-lg">অর্ডার ডাটাবেস</h3>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                      <th className="px-8 py-4">ক্রেতা</th>
                      <th className="px-8 py-4">ভ্যালু</th>
                      <th className="px-8 py-4">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5">
                          <p className="font-bold text-slate-900">{order.customerName}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{order.salesRepName}</p>
                        </td>
                        <td className="px-8 py-5 font-bold text-slate-900">৳{order.totalAmount}</td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border",
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              লাইভ ফিল্ড মনিটরিং
            </h2>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 animate-pulse">
              <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
              Live
            </div>
          </div>
          <div className="h-[calc(100vh-280px)] rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl">
             <MapComponent locations={locations} />
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <section className="space-y-6">
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
             <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                  <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-200">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  টিম সেলস রিপোর্ট সামারী
                </h2>
             </div>

             <div className="bg-slate-100 p-2 rounded-[2rem] flex gap-2 mb-10">
               <button 
                 onClick={() => setReportSubTab('sales')}
                 className={cn(
                   "flex-1 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all",
                   reportSubTab === 'sales' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:bg-slate-200"
                 )}
               >সেলস সামারী</button>
               <button 
                 onClick={() => setReportSubTab('orders')}
                 className={cn(
                   "flex-1 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all",
                   reportSubTab === 'orders' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:bg-slate-200"
                 )}
               >অর্ডার রিপোর্ট</button>
             </div>

             {reportSubTab === 'sales' ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Sales Ref Comparison */}
                  <div className="space-y-4">
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">প্রতিনিধি অনুযায়ী বিক্রয়</h3>
                     <div className="space-y-3">
                        {team.map(member => {
                          const memberTotal = orders.filter(o => o.salesRepId === member.id).reduce((sum, o) => sum + o.totalAmount, 0);
                          const target = targets.find(t => t.userId === member.id);
                          return (
                            <div key={member.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center group">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-slate-400 border border-slate-200 group-hover:text-amber-600 transition-all">
                                     {member.name.substring(0, 1)}
                                  </div>
                                  <div>
                                     <p className="font-black text-slate-900 uppercase tracking-tight">{member.name}</p>
                                     <div className="flex items-center gap-2 mt-1">
                                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                           <div 
                                             className="h-full bg-amber-500" 
                                             style={{ width: `${Math.min((memberTotal / (target?.monthlyTarget || 1)) * 100, 100)}%` }}
                                           ></div>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400">{target ? Math.round((memberTotal / target.monthlyTarget) * 100) : 0}%</span>
                                     </div>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="text-lg font-black text-slate-900">৳{memberTotal.toLocaleString()}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">লক্ষ্য: ৳{target?.monthlyTarget.toLocaleString() || 'N/A'}</p>
                               </div>
                            </div>
                          );
                        })}
                     </div>
                  </div>

                  {/* Product Performance Summary */}
                  <div className="space-y-4">
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">টপ সেল পন্য</h3>
                     <div className="space-y-3">
                        {Object.entries(orders.reduce((acc: any, order) => {
                          order.items.forEach(item => {
                            acc[item.name] = (acc[item.name] || 0) + item.quantity;
                          });
                          return acc;
                        }, {}))
                        .sort((a: any, b: any) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([name, qty]: any) => (
                          <div key={name} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center group">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                                   <Package className="w-5 h-5" />
                                </div>
                                <p className="font-black text-slate-900 uppercase tracking-tight">{name}</p>
                             </div>
                             <p className="text-lg font-black text-indigo-600">{qty} পিস</p>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
             ) : (
               <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">সাম্প্রতিক অর্ডার রিপোর্ট</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.slice(0, 12).map(order => (
                      <div key={order.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-all group">
                         <div>
                            <div className="flex justify-between items-start mb-4">
                               <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[9px] font-black text-blue-600 uppercase tracking-widest">মেমো: {order.memoNumber || 'N/A'}</div>
                               <button 
                                 onClick={() => setSelectedOrder(order)}
                                 className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all"
                               >
                                  <FileText className="w-4 h-4" />
                               </button>
                            </div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tight line-clamp-1">{order.customerName}</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">প্রতিনিধি: {order.salesRepName}</p>
                         </div>
                         <div className="mt-6 flex justify-between items-end border-t border-white pt-4">
                            <span className="text-[10px] font-black text-slate-300 uppercase">{order.timestamp?.toDate ? format(order.timestamp.toDate(), 'PP') : '-'}</span>
                            <span className="text-xl font-black text-blue-600">৳{order.totalAmount}</span>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
             )}
           </div>
        </section>
      )}

      {activeTab === 'targets' && (
        <section className="space-y-8">
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
             <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                    <TargetIcon className="w-6 h-6" />
                  </div>
                  টিম লক্ষ্যমাত্রা ম্যানেজমেন্ট
                </h2>
                <div className="text-right">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{format(new Date(), 'MMMM yyyy')}</span>
                   <span className="text-sm font-black text-slate-900">মোট মাসিক লক্ষ্য: ৳{targets.reduce((s, t) => s + t.monthlyTarget, 0).toLocaleString()}</span>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Rep List and Their current targets */}
                <div className="space-y-4">
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">সদস্য তালিকা ও টার্গেট</h3>
                   <div className="space-y-3">
                      {team.map(member => {
                        const target = targets.find(t => t.userId === member.id);
                        return (
                          <div key={member.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-slate-400 border border-slate-200 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all">
                                   {member.name.substring(0, 1)}
                                </div>
                                <div>
                                   <p className="font-black text-slate-900 uppercase tracking-tight">{member.name}</p>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {member.employeeId}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                {target ? (
                                   <>
                                      <p className="text-sm font-black text-indigo-600">৳{target.monthlyTarget.toLocaleString()}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">প্রতিদিন: ৳{Math.round(target.dailyTarget)}</p>
                                   </>
                                ) : (
                                   <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">টার্গেট সেট করা হয়নি</p>
                                )}
                                <button 
                                  onClick={() => setSelectedRepForTarget(member)}
                                  className="mt-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                                >
                                   {target ? 'এডিট করুন' : 'টার্গেট দিন'}
                                </button>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>

                {/* Target Setting Form */}
                <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
                   <div className="relative z-10">
                      {selectedRepForTarget ? (
                        <>
                           <h3 className="text-xl font-black mb-1 uppercase tracking-tight">টার্গেট ফরম</h3>
                           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">{selectedRepForTarget.name} এর জন্য</p>
                           
                           <div className="space-y-6">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">মান্থলি টার্গেট (৳)</label>
                                 <input 
                                    type="number"
                                    placeholder="৩০০০০০"
                                    value={monthlyTargetAmount}
                                    onChange={(e) => setMonthlyTargetAmount(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 font-black text-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-white placeholder:text-slate-600"
                                 />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">পণ্য টার্গেট (পিস)</label>
                                 <input 
                                    type="number"
                                    placeholder="৫০০০"
                                    value={monthlyProductTarget}
                                    onChange={(e) => setMonthlyProductTarget(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 font-black text-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-white placeholder:text-slate-600"
                                 />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">কর্মদিবস (Divide by days)</label>
                                 <input 
                                    type="number"
                                    placeholder="২৬"
                                    value={workingDays}
                                    onChange={(e) => setWorkingDays(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 font-black text-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-white placeholder:text-slate-600"
                                 />
                              </div>
                              <div className="pt-4 flex gap-4">
                                 <button 
                                    onClick={() => setSelectedRepForTarget(null)}
                                    className="flex-1 py-4 rounded-2xl bg-slate-800 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all"
                                 >বাতিল</button>
                                 <button 
                                    onClick={handleSetTarget}
                                    disabled={isSavingTarget}
                                    className="flex-[2] py-4 rounded-2xl bg-blue-600 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-3"
                                 >
                                    {isSavingTarget ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                                    টার্গেট কনফার্ম করুন
                                 </button>
                              </div>
                           </div>
                        </>
                      ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-center">
                           <TargetIcon className="w-16 h-16 text-slate-700 mb-6 opacity-20" />
                           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">বামে থেকে একজন প্রতিনিধি নির্বাচন করুন <br /> এবং তার মাসিক টার্গেট সেট করুন।</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
           </div>
        </section>
      )}

      {activeTab === 'routes' && (
        <section className="space-y-8">
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                 <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                   <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                     <MapPin className="w-6 h-6" />
                   </div>
                   টিম রুট ম্যানেজমেন্ট
                 </h2>
                 <div className="w-full md:w-64">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1 block">প্রতিনিধি নির্বাচন করুন</label>
                    <select 
                      value={selectedRouteRep || ''}
                      onChange={(e) => setSelectedRouteRep(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none focus:ring-4 focus:ring-indigo-100"
                    >
                       <option value="">সিলেক্ট করুন...</option>
                       {team.map(rep => (
                         <option key={rep.id} value={rep.id}>{rep.name}</option>
                       ))}
                    </select>
                 </div>
              </div>

              {selectedRouteRep ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {[1, 2, 3, 4, 5, 6].map(day => {
                     const route = allRoutes.find(r => r.userId === selectedRouteRep && r.dayNumber === day);
                     return (
                       <div key={day} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 group">
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">দিন {day}</p>
                                <h4 className="font-black text-slate-900 uppercase tracking-tight">{route?.routeName || 'রুট সেট করা নেই'}</h4>
                             </div>
                          </div>
                          {route && (
                            <div className="mt-4 flex gap-4">
                               <div className="text-center">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">{t.outlets}</p>
                                  <p className="font-black text-slate-900">{route.outletIds.length}</p>
                               </div>
                               <div className="text-center">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">{t.weight}</p>
                                  <p className="font-black text-indigo-600">{route.weightPercentage}%</p>
                               </div>
                            </div>
                          )}
                       </div>
                     );
                   })}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                   <MapPin className="w-12 h-12 text-slate-200 mb-4" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">প্রতিনিধি নির্বাচন করুন রুট দেখার জন্য</p>
                </div>
              )}
           </div>
        </section>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-8">
          {/* Filters Bar */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50 flex flex-col xl:flex-row gap-6 items-center">
            <div className="flex-1 w-full flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="দোকান, মেমো বা প্রতিনিধির নাম..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-[1.25rem] bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-blue-50 font-bold text-slate-700 transition-all"
                />
              </div>
              <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-[1.25rem] border border-slate-100">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent p-2 outline-none text-xs font-black uppercase text-slate-600"
                />
                <span className="text-slate-300 font-bold px-2">থেকে</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent p-2 outline-none text-xs font-black uppercase text-slate-600"
                />
              </div>
            </div>
            
            <div className="flex gap-4 w-full xl:w-auto">
              <div className="bg-blue-50 px-6 py-4 rounded-[1.25rem] border border-blue-100 flex flex-col justify-center">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">মোট বিক্রয়</p>
                <p className="text-xl font-black text-blue-700">৳{totalSalesInRange.toLocaleString()}</p>
              </div>
              <button 
                onClick={downloadReport}
                className="bg-slate-900 text-white px-8 py-4 rounded-[1.25rem] hover:bg-slate-800 transition-all flex items-center gap-3 font-black uppercase tracking-tighter shadow-lg shadow-slate-200 active:scale-95"
              >
                <Download className="w-5 h-5" />
                রিপোর্ট ডাউনলোড
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-100/50 overflow-hidden border-t-8 border-t-blue-600">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight">সেলস অ্যাক্টিভিটি রিপোর্ট</h3>
                <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">{format(new Date(startDate), 'PP')} - {format(new Date(endDate), 'PP')}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-900">{filteredOrders.length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase">মোট মেমো</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest">
                  <tr>
                    <th className="px-8 py-5">সময় ও মেমো</th>
                    <th className="px-8 py-5">ক্রেতা ও ঠিকানা</th>
                    <th className="px-8 py-5">বিক্রয় প্রতিনিধি</th>
                    <th className="px-8 py-5">পণ্য তালিকা</th>
                    <th className="px-8 py-5 text-right">মোট টাকা</th>
                    <th className="px-8 py-5 text-center">অবস্থা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center">
                          <Package className="w-12 h-12 text-slate-200 mb-4" />
                          <p className="text-slate-400 font-bold">কোনো ডেটা পাওয়া যায়নি</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => (
                      <tr 
                        key={order.id} 
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <p className="text-xs font-black text-slate-900">{order.timestamp?.toDate ? format(order.timestamp.toDate(), 'PP p') : '-'}</p>
                          <p className="text-[10px] font-black text-blue-600 mt-1 uppercase">MEMO: {order.memoNumber || 'N/A'}</p>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-900 uppercase leading-tight">{order.customerName}</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-1 line-clamp-1">{order.address}</p>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">
                              {order.salesRepName.substring(0, 2).toUpperCase()}
                            </div>
                            <p className="text-sm font-bold text-slate-700">{order.salesRepName}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="space-y-1">
                            {order.items.slice(0, 2).map((item, idx) => (
                              <p key={idx} className="text-[10px] font-bold text-slate-600 flex justify-between gap-4">
                                <span className="line-clamp-1">{item.name}</span>
                                <span className="shrink-0 text-slate-400">x{item.quantity}</span>
                              </p>
                            ))}
                            {order.items.length > 2 && (
                              <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">+{order.items.length - 2} আরো পণ্য</p>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <p className="text-lg font-black text-slate-900 tracking-tighter">৳{order.totalAmount.toLocaleString()}</p>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <span className={cn(
                                "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border whitespace-nowrap",
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-[101] overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">অর্ডার মেমো</h3>
                <p className="text-blue-600 font-black text-xs uppercase mt-1">MEMO: {selectedOrder.memoNumber || 'N/A'}</p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ক্রেতার তথ্য</p>
                  <p className="font-black text-slate-900 text-lg">{selectedOrder.customerName}</p>
                  <p className="text-sm font-bold text-slate-500 mt-1">{selectedOrder.customerPhone}</p>
                  <p className="text-sm text-slate-500 mt-1">{selectedOrder.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">প্রতিনিধির তথ্য</p>
                  <p className="font-black text-slate-900">{selectedOrder.salesRepName}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{selectedOrder.timestamp?.toDate ? format(selectedOrder.timestamp.toDate(), 'PPP p') : '-'}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="pb-4 text-left">বিবরণ</th>
                      <th className="pb-4 text-center">পরিমাণ</th>
                      <th className="pb-4 text-right">মূল্য</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx} className="text-sm">
                        <td className="py-4 font-bold text-slate-900">{item.name}</td>
                        <td className="py-4 text-center font-bold text-slate-600">x{item.quantity}</td>
                        <td className="py-4 text-right font-black text-slate-900">৳{item.price * item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 pt-4">
                      <td colSpan={2} className="pt-6 font-black text-slate-900 text-lg uppercase">সর্বমোট</td>
                      <td className="pt-6 text-right font-black text-slate-900 text-2xl">৳{selectedOrder.totalAmount}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">অর্ডারের অবস্থা পরিবর্তন করুন</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    disabled={selectedOrder.status === 'pending' || updating}
                    onClick={() => handleUpdateStatus('pending')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black transition-all border",
                      selectedOrder.status === 'pending' 
                        ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100" 
                        : "bg-white text-amber-500 border-amber-100 hover:bg-amber-50"
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" /> অপেক্ষমাণ
                  </button>
                  <button
                    disabled={selectedOrder.status === 'confirmed' || updating}
                    onClick={() => handleUpdateStatus('confirmed')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black transition-all border",
                      selectedOrder.status === 'confirmed' 
                        ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100" 
                        : "bg-white text-blue-600 border-blue-100 hover:bg-blue-50"
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> কনফার্ম
                  </button>
                  {isSupervisor && selectedOrder.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus('approved')}
                      disabled={updating}
                      className="bg-emerald-600 text-white py-3 rounded-2xl text-[10px] font-black shadow-lg shadow-emerald-100 border border-emerald-600 col-span-2 mt-2 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> সুপারভাইজার অনুমোদীত
                    </button>
                  )}
                  <button
                    disabled={selectedOrder.status === 'delivered' || updating}
                    onClick={() => handleUpdateStatus('delivered')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black transition-all border",
                      selectedOrder.status === 'delivered' 
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-100" 
                        : "bg-white text-emerald-500 border-emerald-100 hover:bg-emerald-50"
                    )}
                  >
                    <Package className="w-3.5 h-3.5" /> ডেলিভার্ড
                  </button>
                  <button
                    disabled={selectedOrder.status === 'cancelled' || updating}
                    onClick={() => handleUpdateStatus('cancelled')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black transition-all border",
                      selectedOrder.status === 'cancelled' 
                        ? "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-100" 
                        : "bg-white text-rose-500 border-rose-100 hover:bg-rose-50"
                    )}
                  >
                    <XCircle className="w-3.5 h-3.5" /> বাতিল
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-50">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-[1.25rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  প্রিন্ট করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <section className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
                  <UserIcon className="w-6 h-6" />
                </div>
                টিম মেম্বার লিস্ট
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                      <th className="px-8 py-5">নাম ও আইডি</th>
                      <th className="px-8 py-5">পদবী (Role)</th>
                      <th className="px-8 py-5">সুপারভাইজার</th>
                      {isAdmin && <th className="px-8 py-5 text-right">ম্যানেজ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(isAdmin ? allUsers : team).map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <img src={u.photoUrl} className="w-10 h-10 rounded-full border border-slate-200" alt="" />
                            <div>
                              <p className="font-black text-slate-900 uppercase tracking-tight">{u.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {u.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn(
                            "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            u.role === 'admin' ? "bg-rose-50 text-rose-600 border-rose-100" :
                            u.role === 'supervisor' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-blue-50 text-blue-600 border-blue-100"
                          )}>
                            {u.role === 'admin' ? 'অ্যাডমিন' : u.role === 'supervisor' ? 'সুপারভাইজার' : 'সেলস'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-slate-700">
                            {allUsers.find(sv => sv.id === u.supervisorId)?.name || 'N/A'}
                          </p>
                        </td>
                        {isAdmin && (
                          <td className="px-8 py-6 text-right">
                            <button 
                              onClick={() => setEditingUser(u)}
                              className="text-blue-600 font-bold hover:underline"
                            >
                              এডিট
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'sales' && (
        <section className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-200">
                  <TrendingUp className="w-6 h-6" />
                </div>
                {t.sales} (কনফার্মকৃত)
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.totalSales}</p>
                 <p className="text-2xl font-black text-slate-900">৳{orders.filter(o => o.status === 'confirmed' || o.status === 'delivered').reduce((acc, o) => acc + o.totalAmount, 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট মেমো</p>
                 <p className="text-2xl font-black text-slate-900">{orders.filter(o => o.status === 'confirmed' || o.status === 'delivered').length}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                      <th className="px-8 py-5">{t.customer}</th>
                      <th className="px-8 py-5">{t.salesRef}</th>
                      <th className="px-8 py-5">{t.amount}</th>
                      <th className="px-8 py-5">{t.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.filter(o => o.status === 'confirmed' || o.status === 'delivered').map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6">
                           <p className="font-black text-slate-900 uppercase tracking-tight">{order.customerName}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">মেমো: {order.memoNumber || 'N/A'}</p>
                        </td>
                        <td className="px-8 py-6 font-bold text-slate-700">{order.salesRepName}</td>
                        <td className="px-8 py-6 font-black text-blue-600">৳{order.totalAmount}</td>
                        <td className="px-8 py-6">
                           <span className={cn(
                             "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                             order.status === 'delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                           )}>
                             {order.status === 'delivered' ? t.delivered : t.confirmed}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        </section>
      )}

      {activeTab === 'attendance' && (
        <section className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-rose-200">
                  <Clock className="w-6 h-6" />
                </div>
                {t.attendanceStatus}
              </h2>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{format(new Date(), 'PP')}</span>
                <span className="text-sm font-black text-slate-900">আজকের পেন্ডিং হাজীরা: {attendances.filter(a => a.status === 'pending').length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                      <th className="px-8 py-5">প্রতিনিধি</th>
                      <th className="px-8 py-5">টাইপ</th>
                      <th className="px-8 py-5">সময়</th>
                      <th className="px-8 py-5">অবস্থান</th>
                      <th className="px-8 py-5 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendances.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400">
                                 {att.userName?.substring(0, 1) || 'U'}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 uppercase tracking-tight">{att.userName || 'Unknown'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {att.userId.slice(-6)}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-6 uppercase font-black text-[10px] tracking-widest">
                           <span className={cn(
                             "px-3 py-1 rounded-full",
                             att.type === 'present' ? "bg-emerald-50 text-emerald-600" :
                             att.type === 'absent' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                           )}>
                             {att.type === 'present' ? t.present : att.type === 'absent' ? t.absent : t.leave}
                           </span>
                        </td>
                        <td className="px-8 py-6 text-xs font-bold text-slate-600">
                           {att.timestamp?.toDate ? format(att.timestamp.toDate(), 'p') : 'Pending'}
                        </td>
                        <td className="px-8 py-6">
                           {att.location ? (
                             <a 
                               href={`https://www.google.com/maps?q=${att.location.lat},${att.location.lng}`} 
                               target="_blank" 
                               rel="noreferrer"
                               className="text-blue-600 hover:underline flex items-center gap-1 text-[10px] font-black uppercase"
                             >
                               <MapPin className="w-3 h-3" /> লোকেশন দেখুন
                             </a>
                           ) : 'N/A'}
                        </td>
                        <td className="px-8 py-6 text-center">
                           {att.status === 'pending' ? (
                             <div className="flex justify-center gap-2">
                               <button 
                                 onClick={() => handleUpdateAttendance(att.id!, 'confirmed')}
                                 className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                 title="Confirm"
                               >
                                 <CheckCircle2 className="w-5 h-5" />
                               </button>
                               <button 
                                 onClick={() => handleUpdateAttendance(att.id!, 'rejected')}
                                 className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                 title="Reject"
                               >
                                 <XCircle className="w-5 h-5" />
                               </button>
                             </div>
                           ) : (
                             <span className={cn(
                               "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                               att.status === 'confirmed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                             )}>
                               {att.status === 'confirmed' ? 'অনুমোদিত' : 'বাতিল'}
                             </span>
                           )}
                        </td>
                      </tr>
                    ))}
                    {attendances.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-slate-300 font-bold uppercase tracking-widest">
                           আজকের কোনো হাজীরা রেকর্ড পাওয়া যায়নি
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
          </div>
        </section>
      )}

      {activeTab === 'territory' && (
        <section className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                  <Flag className="w-6 h-6" />
                </div>
                {t.territory} লিস্ট
              </h2>
              {isAdmin && (
                <button 
                  onClick={() => setIsAddingTerritory(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 flex items-center gap-2 active:scale-95"
                >
                  <Plus className="w-4 h-4" /> {t.addTerritory}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {territories.map(t => (
                <div key={t.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 group hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      <Flag className="w-7 h-7" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">{t.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                    {lang === 'bn' ? 'সুপারভাইজার' : 'Supervisor'}: {allUsers.find(u => u.id === t.supervisorId)?.name || 'N/A'}
                  </div>

                  <div className="pt-6 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">টিম মেম্বার ({t.memberIds.length})</p>
                    <div className="flex -space-x-3 overflow-hidden">
                      {t.memberIds.map(mid => {
                        const member = allUsers.find(u => u.id === mid);
                        return member ? (
                          <img key={mid} src={member.photoUrl} className="inline-block h-10 w-10 rounded-full ring-4 ring-white" title={member.name} alt="" />
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isAddingTerritory && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddingTerritory(false)}></div>
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-[201] p-10 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-3xl font-black text-slate-900 mb-2">{t.addTerritory}</h3>
            <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-[10px]">{lang === 'bn' ? 'অঞ্চল এবং টিম গঠন করুন' : 'Form regions and teams'}</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">{t.territoryName}</label>
                <input 
                  type="text" 
                  placeholder={lang === 'bn' ? "যেমন: কুমিল্লা সদর" : "e.g. Comilla Sadar"}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-indigo-100"
                  value={newTerritoryName}
                  onChange={(e) => setNewTerritoryName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">{t.selectSupervisor}</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-indigo-100"
                  value={selectedTerritorySupervisor}
                  onChange={(e) => setSelectedTerritorySupervisor(e.target.value)}
                >
                  <option value="">নির্বাচন করুন</option>
                  {allUsers.filter(u => u.role === 'supervisor').map(sv => (
                    <option key={sv.id} value={sv.id}>{sv.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">{t.selectMembers}</label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {allUsers.filter(u => u.role === 'sales').map(member => (
                    <label key={member.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-50 shadow-sm cursor-pointer hover:border-blue-200 transition-all">
                      <input 
                        type="checkbox" 
                        checked={selectedTerritoryMembers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTerritoryMembers([...selectedTerritoryMembers, member.id]);
                          else setSelectedTerritoryMembers(selectedTerritoryMembers.filter(id => id !== member.id));
                        }}
                        className="w-5 h-5 rounded-lg border-slate-200 text-blue-600 focus:ring-blue-500"
                      />
                      <img src={member.photoUrl} className="w-8 h-8 rounded-full" alt="" />
                      <span className="text-sm font-bold text-slate-700">{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => setIsAddingTerritory(false)}
                  className="flex-1 py-5 rounded-3xl bg-slate-100 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                >বাতিল</button>
                <button 
                  onClick={handleSaveTerritory}
                  disabled={isSavingTerritory || !newTerritoryName || !selectedTerritorySupervisor}
                  className="flex-[2] py-5 rounded-3xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300 disabled:shadow-none"
                >
                  {isSavingTerritory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingUser(null)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-[201] p-10 border border-slate-100">
            <h3 className="text-2xl font-black text-slate-900 mb-2">মেম্বার এডিট করুন</h3>
            <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-[10px]">{editingUser.name}</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">পদবী (Role)</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-blue-100"
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                >
                  <option value="sales">সেলস প্রতিনিধি</option>
                  <option value="supervisor">সুপারভাইজার</option>
                  <option value="admin">অ্যাডমিন</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">সুপারভাইজার নিযুক্ত করুন</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-blue-100"
                  value={editingUser.supervisorId || ''}
                  onChange={(e) => setEditingUser({...editingUser, supervisorId: e.target.value})}
                >
                  <option value="">সুপারভাইজার নেই</option>
                  {allUsers.filter(u => u.role === 'supervisor').map(sv => (
                    <option key={sv.id} value={sv.id}>{sv.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">পাসওয়ার্ড (Password)</label>
                <input 
                  type="text" 
                  value={editingUser.password || ''} 
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-blue-100 placeholder:text-slate-300"
                  placeholder="পাসওয়ার্ড সেট করুন"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-5 rounded-3xl bg-slate-100 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                >বাতিল</button>
                <button 
                  onClick={() => handleUpdateUser(editingUser.id, { role: editingUser.role, supervisorId: editingUser.supervisorId, password: editingUser.password })}
                  disabled={isUpdatingUser}
                  className="flex-[2] py-5 rounded-3xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                >
                  {isUpdatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  সেভ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative z-[201] p-8 text-center border border-white/20">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500 ring-8 ring-amber-50/50">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">আপনি কি নিশ্চিত?</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              আপনি কি এই অর্ডারের অবস্থা <span className="font-black text-slate-900 uppercase">'{pendingStatus === 'delivered' ? 'ডেলিভার্ড' : 'বাতিল'}'</span> এ পরিবর্তন করতে চান? এটি পরবর্তীতে পরিবর্তন করা সম্ভব নাও হতে পারে।
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setShowConfirm(false); setPendingStatus(null); }}
                className="py-4 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
              >
                না, ফিরে যান
              </button>
              <button 
                onClick={() => pendingStatus && handleUpdateStatus(pendingStatus)}
                className={cn(
                  "py-4 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95",
                  pendingStatus === 'delivered' ? "bg-emerald-500 shadow-emerald-100" : "bg-rose-500 shadow-rose-100"
                )}
              >
                হ্যাঁ, পরিবর্তন করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, trend, trendColor, color }: { label: string; value: string; icon: ReactNode; trend: string; trendColor: string; color: string }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50 flex flex-col justify-between group hover:border-blue-200 transition-all relative overflow-hidden">
      <div className="flex items-center gap-6 mb-6">
        <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center text-white shadow-2xl transition-transform group-hover:scale-110 shrink-0", color)}>
          {icon}
        </div>
        <div className="flex-1 text-right">
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{label}</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
        </div>
      </div>
      <div className="pt-6 border-t border-slate-50 flex items-center gap-2">
        <span className={cn("text-xs font-black uppercase tracking-tight", trendColor)}>{trend}</span>
      </div>
    </div>
  );
}

