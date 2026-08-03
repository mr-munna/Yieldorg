import React, { useEffect, useState } from 'react';
import { Sparkles, Heart, Gift, Cake, Calendar, Edit3, Save, X, PartyPopper, CheckCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface AnniversaryBirthdayWishProps {
  isAdmin?: boolean;
}

export function AnniversaryBirthdayWish({ isAdmin = false }: AnniversaryBirthdayWishProps) {
  const { userProfile } = useAuth();
  const [foundationDate, setFoundationDate] = useState<string>('');
  const [showDateModal, setShowDateModal] = useState<boolean>(false);
  const [tempDate, setTempDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [isFoundationDay, setIsFoundationDay] = useState<boolean>(false);
  const [anniversaryYears, setAnniversaryYears] = useState<number>(0);
  
  const [birthdayMembers, setBirthdayMembers] = useState<any[]>([]);
  const [currentMemberBirthday, setCurrentMemberBirthday] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  useEffect(() => {
    // 1. Subscribe to settings/general for foundationDate
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fDate = data.foundationDate || '';
        setFoundationDate(fDate);
        setTempDate(fDate);

        if (fDate) {
          checkFoundationAnniversary(fDate);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/general'));

    // 2. Subscribe to users for member birthdays
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList: any[] = [];
      snapshot.forEach(d => usersList.push({ id: d.id, ...d.data() }));

      checkMemberBirthdays(usersList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubSettings();
      unsubUsers();
    };
  }, [userProfile]);

  const checkFoundationAnniversary = async (fDateStr: string) => {
    try {
      const foundation = new Date(fDateStr);
      const today = new Date();

      if (isNaN(foundation.getTime())) return;

      const fMonth = foundation.getMonth() + 1;
      const fDay = foundation.getDate();

      const tMonth = today.getMonth() + 1;
      const tDay = today.getDate();

      if (fMonth === tMonth && fDay === tDay) {
        const years = today.getFullYear() - foundation.getFullYear();
        setIsFoundationDay(true);
        setAnniversaryYears(years > 0 ? years : 1);

        // Auto-post anniversary notice to notifications if not already posted today/this year
        const currentYearStr = today.getFullYear().toString();
        const autoNoticeTag = `foundation_anniversary_${currentYearStr}`;

        const qNotif = query(collection(db, 'notifications'), where('tag', '==', autoNoticeTag));
        const notifSnap = await getDocs(qNotif);

        if (notifSnap.empty) {
          await addDoc(collection(db, 'notifications'), {
            title: `🎉 Happy ${years > 0 ? `${years}th` : ''} Foundation Day of Yield Organization!`,
            message: `Today, ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, marks our organization's anniversary! Warmest wishes & heartfelt thanks to all our members for your dedication, unity, and continuous support! 🎂🎈🥳`,
            createdBy: 'System (Auto Wish)',
            createdAt: new Date().toISOString(),
            tag: autoNoticeTag
          });
        }
      } else {
        setIsFoundationDay(false);
      }
    } catch (err) {
      console.error('Error checking foundation anniversary:', err);
    }
  };

  const checkMemberBirthdays = async (users: any[]) => {
    try {
      const today = new Date();
      const tMonth = today.getMonth() + 1;
      const tDay = today.getDate();
      const currentYearStr = today.getFullYear().toString();

      const todayBirthdayList: any[] = [];
      let isMyBirthday = false;

      for (const u of users) {
        const dobStr = u.dateOfBirth || u.dob || u.birthDate;
        if (dobStr) {
          const dob = new Date(dobStr);
          if (!isNaN(dob.getTime())) {
            const bMonth = dob.getMonth() + 1;
            const bDay = dob.getDate();

            if (bMonth === tMonth && bDay === tDay && u.status === 'Active') {
              todayBirthdayList.push(u);

              if (userProfile && (u.id === userProfile.id || u.memberId === userProfile.memberId)) {
                isMyBirthday = true;
              }

              // Auto-post birthday wish notice for this member if not already posted for this year
              const autoNoticeTag = `birthday_${u.memberId || u.id}_${currentYearStr}`;
              const qNotif = query(collection(db, 'notifications'), where('tag', '==', autoNoticeTag));
              const notifSnap = await getDocs(qNotif);

              if (notifSnap.empty) {
                await addDoc(collection(db, 'notifications'), {
                  title: `🎂 Happy Birthday to ${u.name}!`,
                  message: `Yield Organization sends warmest birthday wishes to ${u.name} (${u.memberId || 'Member'})! Wishing you good health, happiness, and success in the coming year! 🎉🎈`,
                  createdBy: 'System (Auto Wish)',
                  createdAt: new Date().toISOString(),
                  tag: autoNoticeTag
                });
              }
            }
          }
        }
      }

      setBirthdayMembers(todayBirthdayList);
      setCurrentMemberBirthday(isMyBirthday);
    } catch (err) {
      console.error('Error checking member birthdays:', err);
    }
  };

  const handleSaveFoundationDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempDate) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        foundationDate: tempDate
      }, { merge: true });

      setFoundationDate(tempDate);
      setShowDateModal(false);
      checkFoundationAnniversary(tempDate);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/general');
    } finally {
      setIsSaving(false);
    }
  };

  const isEffectiveDemo = isAdmin && demoMode;
  const showAnniversaryBanner = isFoundationDay || isEffectiveDemo;
  const showBirthdayBanner = birthdayMembers.length > 0 || isEffectiveDemo;
  const showPersonalBirthdayCard = currentMemberBirthday || isEffectiveDemo;

  return (
    <div className="space-y-3">
      {/* Demo Mode Toggle Bar - Only visible to Admin */}
      {isAdmin && (
        <div className="flex items-center justify-between bg-purple-50/70 border border-purple-200/80 rounded-xl px-3 py-2 text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-purple-600 shrink-0" />
            <span className="font-semibold">
              {demoMode ? '🎉 Admin Demo Mode Active' : 'Automated Wishes & Anniversary System Active'}
            </span>
            {foundationDate && (
              <span className="hidden sm:inline-block text-[11px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md font-mono">
                Founding Date: {foundationDate}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDateModal(true)}
              className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 underline flex items-center gap-1"
            >
              <Calendar size={13} />
              {foundationDate ? 'Edit Date' : 'Set Date'}
            </button>

            <button
              type="button"
              onClick={() => setDemoMode(!demoMode)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all shadow-sm border flex items-center gap-1",
                demoMode
                  ? "bg-purple-600 text-white border-purple-700"
                  : "bg-white text-purple-700 hover:bg-purple-100 border-purple-300"
              )}
            >
              <PartyPopper size={13} />
              {demoMode ? 'Exit Demo' : 'View Banner Demo'}
            </button>
          </div>
        </div>
      )}

      {/* 1. Foundation Day Celebration Banner */}
      {showAnniversaryBanner && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg border border-amber-300 animate-fade-in">
          {/* Decorative Sparkles & Confetti Background Effects */}
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              🎉
            </div>

            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-bold uppercase tracking-wider mb-2 text-yellow-100">
                <PartyPopper size={14} className="text-yellow-300 animate-bounce" />
                {demoMode && <span className="bg-yellow-400 text-slate-900 px-1.5 py-0.2 rounded text-[10px] font-black mr-1">DEMO</span>}
                Happy Founding Anniversary!
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Yield Organization is Celebrating {anniversaryYears > 0 ? `${anniversaryYears} Year${anniversaryYears > 1 ? 's' : ''}` : '5 Years'} of Excellence! 🥳🎂
              </h2>

              <p className="text-xs sm:text-sm text-amber-100 mt-1 max-w-2xl leading-relaxed">
                Today marks our official Foundation Anniversary! Warmest wishes to all our valued members, leaders, and contributors. Thank you for your unwavering commitment and teamwork!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Today's Member Birthday Banner (If any member has birthday today or in demo mode) */}
      {showBirthdayBanner && (
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-purple-300">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl shrink-0">
              🎂
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                Today's Birthday Wishes! 🎉
                {demoMode && <span className="bg-pink-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded">DEMO</span>}
              </h3>
              <p className="text-xs text-purple-100 mt-0.5 truncate">
                Sending best wishes to: {birthdayMembers.length > 0 ? birthdayMembers.map(m => m.name).join(', ') : 'Bijoy Ahmed (DEM001), Tanvir Hossain (MEM002)'}!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Personal Birthday Card if logged in member's birthday is today or in demo mode */}
      {showPersonalBirthdayCard && (
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 text-white shadow-md border border-pink-300 flex items-center gap-3">
          <Cake size={28} className="text-yellow-200 shrink-0 animate-pulse" />
          <div>
            <h4 className="font-bold text-sm sm:text-base">
              🎉 Happy Birthday, {userProfile?.name || 'Valued Member'}!
              {demoMode && <span className="ml-2 bg-yellow-300 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded">DEMO</span>}
            </h4>
            <p className="text-xs text-pink-100">
              Yield Organization wishes you a joyful, prosperous, and successful year ahead!
            </p>
          </div>
        </div>
      )}

      {/* Foundation Date Setter Button for Admin if not set */}
      {isAdmin && !foundationDate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <Calendar size={16} className="text-amber-600" />
            <span>Foundation Date is not set yet. Set it to activate automatic yearly anniversary wishes!</span>
          </div>
          <button
            onClick={() => setShowDateModal(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-colors"
          >
            Set Foundation Date
          </button>
        </div>
      )}

      {/* Modal for Setting/Updating Foundation Date */}
      {showDateModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowDateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Set Foundation Date</h3>
                <p className="text-xs text-slate-500">Enable automatic yearly foundation birthday wishes</p>
              </div>
            </div>

            <form onSubmit={handleSaveFoundationDate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization Founding Date
                </label>
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shadow-sm"
                >
                  {isSaving ? 'Saving...' : 'Save Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
