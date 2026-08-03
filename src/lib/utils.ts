import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getEffectiveDueDate(month: string, joinDate?: string | null): string {
  const defaultDueDate = `${month}-10`;
  if (!joinDate) return defaultDueDate;

  const joinMonth = joinDate.substring(0, 7);
  if (month === joinMonth) {
    const joinDay = parseInt(joinDate.substring(8, 10), 10);
    if (!isNaN(joinDay) && joinDay > 10) {
      return joinDate;
    }
  }
  return defaultDueDate;
}

export function calculateLateFine(
  month: string,
  dueDateInput: string | undefined,
  joinDate: string | undefined | null,
  dailyFine: number,
  nowTimestamp: number = Date.now()
): number {
  const effectiveDueDate = (dueDateInput && dueDateInput !== `${month}-10`)
    ? dueDateInput
    : getEffectiveDueDate(month, joinDate);

  const today = new Date(nowTimestamp);
  const due = new Date(`${effectiveDueDate}T23:59:59`);

  if (today > due) {
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays) * dailyFine;
  }
  return 0;
}

export const formatCurrency = (amount: number) => {
  return `৳${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const formatDate = (dateInput: string | Date | undefined | null) => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

export function getMonthsRange(startMonthStr: string, endMonthStr: string): string[] {
  if (!startMonthStr || !endMonthStr) return [endMonthStr];
  if (startMonthStr > endMonthStr) return [];

  const months: string[] = [];
  const [startYear, startMonth] = startMonthStr.split('-').map(Number);
  const [endYear, endMonth] = endMonthStr.split('-').map(Number);

  if (isNaN(startYear) || isNaN(startMonth) || isNaN(endYear) || isNaN(endMonth)) {
    return [endMonthStr];
  }

  let curY = startYear;
  let curM = startMonth;

  while (curY < endYear || (curY === endYear && curM <= endMonth)) {
    const monthFormatted = `${curY}-${String(curM).padStart(2, '0')}`;
    months.push(monthFormatted);

    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  return months;
}
