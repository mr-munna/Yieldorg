import { Member, Payment, InventoryItem, OrgStats } from '../types';

export const mockMembers: Member[] = [
  { id: '1', memberId: 'YO-001', name: 'Alice Johnson', joinDate: '2025-01-15', contact: 'alice@example.com', role: 'President', status: 'Active' },
  { id: '2', memberId: 'YO-002', name: 'Bob Smith', joinDate: '2025-01-20', contact: 'bob@example.com', role: 'Secretary', status: 'Active' },
  { id: '3', memberId: 'YO-003', name: 'Charlie Davis', joinDate: '2025-02-01', contact: 'charlie@example.com', role: 'Treasurer', status: 'Active' },
  { id: '4', memberId: 'YO-004', name: 'Diana Prince', joinDate: '2025-02-10', contact: 'diana@example.com', role: 'Member', status: 'Active' },
  { id: '5', memberId: 'YO-005', name: 'Evan Wright', joinDate: '2025-03-05', contact: 'evan@example.com', role: 'Member', status: 'Active' },
  { id: '6', memberId: 'YO-006', name: 'Fiona Gallagher', joinDate: '2025-03-12', contact: 'fiona@example.com', role: 'Member', status: 'Inactive' },
];

export const mockPayments: Payment[] = [
  { id: 'p1', memberId: 'YO-001', month: '2026-04', amountDue: 100, amountPaid: 100, dueDate: '2026-04-05', paidDate: '2026-04-02', status: 'Paid', fine: 0 },
  { id: 'p2', memberId: 'YO-002', month: '2026-04', amountDue: 100, amountPaid: 100, dueDate: '2026-04-05', paidDate: '2026-04-04', status: 'Paid', fine: 0 },
  { id: 'p3', memberId: 'YO-003', month: '2026-04', amountDue: 100, amountPaid: 0, dueDate: '2026-04-05', status: 'Late', fine: 35 },
  { id: 'p4', memberId: 'YO-004', month: '2026-04', amountDue: 100, amountPaid: 50, dueDate: '2026-04-05', paidDate: '2026-04-05', status: 'Pending', fine: 0 },
  { id: 'p5', memberId: 'YO-005', month: '2026-04', amountDue: 100, amountPaid: 0, dueDate: '2026-04-05', status: 'Late', fine: 35 },
];

export const mockInventory: InventoryItem[] = [
  { id: 'i1', name: 'Resolution Book', description: 'Official record of all society resolutions and meeting minutes.', status: 'Available' },
  { id: 'i2', name: 'Cash Book', description: 'Daily log of all cash inflows and outflows.', status: 'In Use', assignedTo: 'Charlie Davis' },
  { id: 'i3', name: 'General Ledger', description: 'Master record of all financial accounts.', status: 'Available' },
  { id: 'i4', name: 'Society Seal/Stamp', description: 'Official Yield Organization rubber stamp.', status: 'In Use', assignedTo: 'Alice Johnson' },
  { id: 'i5', name: 'Receipt Book', description: 'Carbon-copy receipt book for member dues.', status: 'Available' },
];

export const mockStats: OrgStats = {
  totalMembers: 6,
  totalCollected: 12500,
  monthlyTarget: 600,
  pendingDues: 250,
};

export const mockChartData = [
  { name: 'Nov', collected: 450, target: 500 },
  { name: 'Dec', collected: 500, target: 500 },
  { name: 'Jan', collected: 550, target: 550 },
  { name: 'Feb', collected: 550, target: 600 },
  { name: 'Mar', collected: 600, target: 600 },
  { name: 'Apr', collected: 250, target: 600 },
];
