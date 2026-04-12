export interface Member {
  id: string;
  memberId?: string | null;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  contact: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Pending';
}

export interface Payment {
  id: string;
  userId?: string;
  memberId: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  paidDate?: string;
  status: 'Paid' | 'Pending' | 'Late';
  fine: number;
  paymentMethod?: string;
  transactionId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  status: 'Available' | 'In Use' | 'Archived';
  assignedTo?: string;
}

export interface OrgStats {
  totalMembers: number;
  totalCollected: number;
  monthlyTarget: number;
  pendingDues: number;
}
