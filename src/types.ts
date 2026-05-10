export type UserRole = 'admin' | 'supervisor' | 'sales';
export type Language = 'bn' | 'en';

export interface UserProfile {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  role: UserRole;
  photoUrl?: string;
  lastActive?: string;
  supervisorId?: string; // ID of the supervisor managing this user
  territoryId?: string;
  language?: Language;
  password?: string;
}

export interface Territory {
  id?: string;
  name: string;
  supervisorId: string;
  memberIds: string[];
  createdAt: any;
}

export interface UserLocation {
  id?: string;
  userId: string;
  userName?: string;
  lat: number;
  lng: number;
  timestamp: any;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id?: string;
  salesRepId: string;
  salesRepName: string;
  supervisorId?: string; // Captured at order time
  memoNumber?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'confirmed' | 'delivered' | 'cancelled' | 'returned';
  type: 'order' | 'sale' | 'return';
  outletId?: string;
  territoryId?: string;
  timestamp: any;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface AppNotification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'target' | 'system';
  read: boolean;
  timestamp: any;
}

export interface Attendance {
  id?: string;
  userId: string;
  userName?: string;
  supervisorId?: string;
  type: 'present' | 'absent' | 'leave' | 'check-out';
  status: 'pending' | 'confirmed' | 'rejected';
  timestamp: any;
  date: string; // YYYY-MM-DD for easier querying
  location?: {
    lat: number;
    lng: number;
  };
  备注?: string;
}

export interface Outlet {
  id?: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  salesRepId: string;
  createdAt: any;
}

export interface Target {
  id?: string;
  userId: string;
  userName?: string;
  month: string;
  year: number;
  monthlyTarget: number;
  workingDays: number;
  dailyTarget: number;
  monthlyProductTarget?: number;
  dailyProductTarget?: number;
  updatedAt: any;
}

export interface Route {
  id?: string;
  userId: string;
  dayNumber: number; // 1 to 6
  routeName: string;
  outletIds: string[];
  weightPercentage: number;
  createdAt: any;
  updatedAt: any;
}
