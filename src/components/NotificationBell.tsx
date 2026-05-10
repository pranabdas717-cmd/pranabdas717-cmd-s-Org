import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { AppNotification } from '../types';
import { Bell, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        if (n.id) await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (error) {
      console.error("Error marking all as read", error);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all relative border border-slate-100 group active:scale-95"
      >
        <Bell className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm ring-2 ring-rose-100">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setShowDropdown(false)}></div>
          <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[101] overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">নোটিফিকেসন</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-black text-blue-600 uppercase hover:underline"
                >
                  সবগুলো পড়া হয়েছে
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  <p className="text-sm font-bold">কোনো নোটিফিকেসন নেই</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-5 border-b border-slate-50 last:border-0 transition-colors group relative",
                      !n.read ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-slate-50"
                    )}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <p className={cn("text-sm transition-colors", !n.read ? "font-black text-slate-900" : "font-bold text-slate-600")}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <button 
                          onClick={() => n.id && markAsRead(n.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed underline-offset-4 decoration-slate-200">
                      {n.message}
                    </p>
                    <p className="text-[9px] font-black text-slate-300 mt-2 uppercase tracking-widest">
                      {n.timestamp?.toDate ? format(n.timestamp.toDate(), 'PPP p') : 'Pending'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
