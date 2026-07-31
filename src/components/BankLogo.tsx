import React from 'react';
import { Landmark, CreditCard, Smartphone } from 'lucide-react';
import { POPULAR_BANKS } from '../lib/bankData';

interface BankLogoProps {
  bankName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BankLogo: React.FC<BankLogoProps> = ({ bankName, size = 'md', className = '' }) => {
  const cleanName = bankName.toLowerCase();

  // Find matching popular bank
  const matched = POPULAR_BANKS.find(b => 
    cleanName.includes(b.id) || 
    cleanName.includes(b.shortName.toLowerCase()) || 
    cleanName.includes(b.name.toLowerCase())
  );

  const dimensionClass = size === 'sm' ? 'w-6 h-6 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';

  if (!bankName) {
    return (
      <div className={`rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center font-bold shrink-0 ${dimensionClass} ${className}`}>
        <Landmark size={size === 'sm' ? 14 : size === 'lg' ? 24 : 18} />
      </div>
    );
  }

  // bKash Logo
  if (cleanName.includes('bkash') || cleanName.includes('বিকাশ')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-pink-500 text-white font-black flex items-center justify-center shadow-sm shrink-0 ${dimensionClass} ${className}`} title="bKash">
        <span className="font-extrabold tracking-tighter text-[11px] leading-none">bK</span>
      </div>
    );
  }

  // Nagad Logo
  if (cleanName.includes('nagad') || cleanName.includes('নগদ')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-500 text-white font-black flex items-center justify-center shadow-sm shrink-0 ${dimensionClass} ${className}`} title="Nagad">
        <span className="font-extrabold tracking-tight text-[11px] leading-none">নগদ</span>
      </div>
    );
  }

  // Rocket Logo
  if (cleanName.includes('rocket') || cleanName.includes('রকেট')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-purple-700 via-violet-600 to-indigo-600 text-white font-black flex items-center justify-center shadow-sm shrink-0 ${dimensionClass} ${className}`} title="Rocket">
        <Smartphone size={size === 'sm' ? 14 : size === 'lg' ? 22 : 17} className="text-amber-300" />
      </div>
    );
  }

  // Dutch Bangla Bank (DBBL)
  if (cleanName.includes('dutch') || cleanName.includes('dbbl') || cleanName.includes('ডাচ')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-emerald-800 via-teal-700 to-teal-600 text-amber-300 font-black flex items-center justify-center border border-amber-400/30 shadow-sm shrink-0 ${dimensionClass} ${className}`} title="Dutch-Bangla Bank">
        <span className="font-black tracking-tighter text-[10px] leading-none text-white">DB<span className="text-amber-300">BL</span></span>
      </div>
    );
  }

  // Islami Bank
  if (cleanName.includes('islami') || cleanName.includes('ইসলামী')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-green-800 via-emerald-700 to-green-600 text-white font-black flex items-center justify-center border border-emerald-400/30 shadow-sm shrink-0 ${dimensionClass} ${className}`} title="Islami Bank">
        <span className="font-extrabold tracking-tighter text-[10px] leading-none text-amber-300">IBB</span>
      </div>
    );
  }

  // BRAC Bank
  if (cleanName.includes('brac') || cleanName.includes('ব্র্যাক')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-blue-800 via-indigo-700 to-blue-600 text-amber-300 font-black flex items-center justify-center shadow-sm shrink-0 ${dimensionClass} ${className}`} title="BRAC Bank">
        <span className="font-extrabold tracking-tighter text-[10px] leading-none text-white">BRAC</span>
      </div>
    );
  }

  // City Bank
  if (cleanName.includes('city') || cleanName.includes('সিটি')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-red-700 via-rose-600 to-red-600 text-white font-black flex items-center justify-center shadow-sm shrink-0 ${dimensionClass} ${className}`} title="City Bank">
        <span className="font-bold tracking-tighter text-[10px] leading-none">CITY</span>
      </div>
    );
  }

  // Sonali Bank
  if (cleanName.includes('sonali') || cleanName.includes('সোনালী')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-blue-900 via-indigo-900 to-amber-600 text-amber-300 font-black flex items-center justify-center shadow-sm shrink-0 ${dimensionClass} ${className}`} title="Sonali Bank">
        <span className="font-black tracking-tighter text-[9px] leading-none">SONALI</span>
      </div>
    );
  }

  // EBL
  if (cleanName.includes('ebl') || cleanName.includes('eastern')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-sky-900 via-slate-800 to-blue-950 text-sky-400 font-black flex items-center justify-center border border-sky-400/30 shadow-sm shrink-0 ${dimensionClass} ${className}`} title="Eastern Bank">
        <span className="font-black tracking-tighter text-[10px] leading-none">EBL</span>
      </div>
    );
  }

  // Upay
  if (cleanName.includes('upay') || cleanName.includes('উপায়')) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-black flex items-center justify-center shadow-sm shrink-0 ${dimensionClass} ${className}`} title="Upay">
        <span className="font-bold tracking-tighter text-[10px] leading-none">upay</span>
      </div>
    );
  }

  // Generic matching fallback with initials
  if (matched) {
    return (
      <div className={`rounded-xl bg-gradient-to-tr from-slate-800 to-slate-900 text-white font-bold flex items-center justify-center border border-slate-700 shadow-sm shrink-0 ${dimensionClass} ${className}`}>
        <span className="text-[10px] leading-none font-bold uppercase">{matched.shortName.slice(0, 3)}</span>
      </div>
    );
  }

  // Default Bank Icon
  const initials = bankName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  return (
    <div className={`rounded-xl bg-gradient-to-tr from-slate-800 to-emerald-950 text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/30 shadow-sm shrink-0 ${dimensionClass} ${className}`}>
      {initials.length >= 2 ? (
        <span className="text-[10px] leading-none font-extrabold">{initials}</span>
      ) : (
        <Landmark size={size === 'sm' ? 14 : size === 'lg' ? 22 : 17} />
      )}
    </div>
  );
};
