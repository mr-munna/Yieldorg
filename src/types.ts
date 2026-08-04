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
  organizationId?: string;
  organizationName?: string;
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
  status: 'Paid' | 'Pending' | 'Verifying' | 'Late';
  fine: number;
  paymentMethod?: string;
  transactionId?: string;
  approvedBy?: string;
  submittedBy?: string;
  organizationId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  status: 'Available' | 'In Use' | 'Archived';
  assignedTo?: string;
  organizationId?: string;
}

export interface OrgStats {
  totalMembers: number;
  totalCollected: number;
  monthlyTarget: number;
  pendingDues: number;
}
