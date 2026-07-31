import React from 'react';

export interface BankItem {
  id: string;
  name: string;
  shortName: string;
  type: 'bank' | 'mfs';
  color: string;
  bgGradient: string;
  logoSvg: string;
}

export const POPULAR_BANKS: BankItem[] = [
  {
    id: 'dbbl',
    name: 'Dutch-Bangla Bank Ltd (DBBL)',
    shortName: 'DBBL',
    type: 'bank',
    color: '#007A5E',
    bgGradient: 'from-emerald-800 to-teal-950',
    logoSvg: 'dbbl'
  },
  {
    id: 'islami',
    name: 'Islami Bank Bangladesh PLC',
    shortName: 'Islami Bank',
    type: 'bank',
    color: '#008752',
    bgGradient: 'from-green-800 to-emerald-950',
    logoSvg: 'islami'
  },
  {
    id: 'brac',
    name: 'BRAC Bank PLC',
    shortName: 'BRAC Bank',
    type: 'bank',
    color: '#0054A6',
    bgGradient: 'from-blue-800 to-indigo-950',
    logoSvg: 'brac'
  },
  {
    id: 'city',
    name: 'City Bank PLC',
    shortName: 'City Bank',
    type: 'bank',
    color: '#E31B23',
    bgGradient: 'from-red-900 to-rose-950',
    logoSvg: 'city'
  },
  {
    id: 'sonali',
    name: 'Sonali Bank PLC',
    shortName: 'Sonali Bank',
    type: 'bank',
    color: '#004B87',
    bgGradient: 'from-amber-700 to-blue-950',
    logoSvg: 'sonali'
  },
  {
    id: 'ebl',
    name: 'Eastern Bank PLC (EBL)',
    shortName: 'EBL',
    type: 'bank',
    color: '#002B49',
    bgGradient: 'from-sky-900 to-slate-950',
    logoSvg: 'ebl'
  },
  {
    id: 'prime',
    name: 'Prime Bank PLC',
    shortName: 'Prime Bank',
    type: 'bank',
    color: '#0A2540',
    bgGradient: 'from-indigo-900 to-slate-950',
    logoSvg: 'prime'
  },
  {
    id: 'dhaka',
    name: 'Dhaka Bank PLC',
    shortName: 'Dhaka Bank',
    type: 'bank',
    color: '#003399',
    bgGradient: 'from-blue-900 to-slate-950',
    logoSvg: 'dhaka'
  },
  {
    id: 'pubali',
    name: 'Pubali Bank PLC',
    shortName: 'Pubali Bank',
    type: 'bank',
    color: '#006837',
    bgGradient: 'from-emerald-900 to-green-950',
    logoSvg: 'pubali'
  },
  {
    id: 'bkash',
    name: 'bKash (Merchant / Personal)',
    shortName: 'bKash',
    type: 'mfs',
    color: '#E2136E',
    bgGradient: 'from-pink-700 to-rose-950',
    logoSvg: 'bkash'
  },
  {
    id: 'nagad',
    name: 'Nagad (Merchant / Personal)',
    shortName: 'Nagad',
    type: 'mfs',
    color: '#F7931E',
    bgGradient: 'from-orange-700 to-amber-950',
    logoSvg: 'nagad'
  },
  {
    id: 'rocket',
    name: 'Rocket (DBBL Mobile Banking)',
    shortName: 'Rocket',
    type: 'mfs',
    color: '#8C2D84',
    bgGradient: 'from-purple-800 to-violet-950',
    logoSvg: 'rocket'
  },
  {
    id: 'upay',
    name: 'Upay (UCB Mobile Financial)',
    shortName: 'Upay',
    type: 'mfs',
    color: '#00AEEF',
    bgGradient: 'from-cyan-700 to-blue-950',
    logoSvg: 'upay'
  }
];

// Area branch mappings for Bangladeshi banks
export const AREA_BRANCHES_DATA: Record<string, string[]> = {
  uttara: [
    'Uttara Branch (House 3, Road 7, Sector 3, Uttara, Dhaka)',
    'Uttara Sector 11 Branch (Garete building, Sector 11, Uttara)',
    'Uttara Sector 7 SME Branch',
    'Uttara Fast Track & Service Centre',
    'Uttara Sonargaon Janapath Branch'
  ],
  dhanmondi: [
    'Dhanmondi Branch (Satmasjid Road, Dhanmondi 9/A, Dhaka)',
    'Dhanmondi 2 Branch (Road 2, Dhanmondi)',
    'Dhanmondi Sobhanbagh Branch (Mirpur Road)',
    'Dhanmondi Executive SME Centre',
    'Dhanmondi Central Branch (Kalabagan)'
  ],
  gulshan: [
    'Gulshan Corporate Branch (Gulshan 1 Circle, Dhaka)',
    'Gulshan Avenue Branch (Gulshan 2, South Avenue)',
    'Gulshan Pink City Branch',
    'Gulshan South Avenue Branch',
    'Gulshan SEBL Tower Branch'
  ],
  mirpur: [
    'Mirpur 1 Branch (Mirpur 1 Bus Stand, Dhaka)',
    'Mirpur 10 Branch (Mirpur 10 Goalchattar, Dhaka)',
    'Mirpur Section 11 Branch (Purobi Cinema Hall Road)',
    'Mirpur DOHS Branch',
    'Mirpur Kazipara Branch'
  ],
  motijheel: [
    'Motijheel Main Corporate Branch (Motijheel C/A, Dhaka)',
    'Motijheel Local Office (Dilkusha C/A, Dhaka)',
    'Motijheel Extension Branch',
    'Motijheel Stock Exchange Branch'
  ],
  banani: [
    'Banani Branch (Kamal Ataturk Avenue, Banani, Dhaka)',
    'Banani Chairmanbari Branch',
    'Banani Block 11 Branch'
  ],
  mohakhali: [
    'Mohakhali Branch (Wireless Gate, Mohakhali, Dhaka)',
    'Mohakhali DOHS Branch',
    'Mohakhali Commercial Area Branch'
  ],
  kawran: [
    'Kawran Bazar Branch (BDBL Bhaban, Kawran Bazar, Dhaka)',
    'Kawran Bazar Corporate Branch (Panthapath, Dhaka)',
    'Tejgaon Industrial Area Branch'
  ],
  mohammadpur: [
    'Mohammadpur Branch (Asad Avenue, Mohammadpur, Dhaka)',
    'Mohammadpur Ring Road Branch',
    'Mohammadpur Tajmahal Road Branch',
    'Japan Garden City Branch'
  ],
  badda: [
    'Badda Branch (Pragati Sarani, Middle Badda, Dhaka)',
    'Merul Badda Branch',
    'Kuril Biswa Road Branch'
  ],
  malibagh: [
    'Malibagh Branch (Chowdhurypara, Malibagh, Dhaka)',
    'Mouchak Market Branch',
    'Rampura Main Road Branch'
  ],
  jatrabari: [
    'Jatrabari Branch (Donia, Jatrabari, Dhaka)',
    'Sayedabad Bus Terminal Branch',
    'Shani Rahr Tek Branch'
  ],
  savar: [
    'Savar Main Branch (Bazar Bus Stand, Savar, Dhaka)',
    'Savar EPZ Branch (DEPZ Area)',
    'Hemayetpur Branch'
  ],
  gazipur: [
    'Gazipur Main Branch (Joydebpur Chowrasta, Gazipur)',
    'Board Bazar Branch (Gazipur)',
    'Tongi Branch (Station Road, Tongi)',
    'Konabari Branch (Gazipur)'
  ],
  narayanganj: [
    'Narayanganj Main Branch (BB Road, Narayanganj)',
    'Chittagong Road Branch (Kachpur)',
    'Fatullah Branch'
  ],
  agrabad: [
    'Agrabad Corporate Branch (Agrabad Commercial Area, Chattogram)',
    'Agrabad CDA Avenue Branch',
    'Agrabad Strand Road Branch'
  ],
  chattogram: [
    'GEC Circle Branch (CDA Avenue, Chattogram)',
    'Chawkbazar Branch (Chattogram)',
    'Khatunganj Wholesale Branch (Chattogram)',
    'Halishahar Branch (Chattogram)',
    'Nasirabad Industrial Area Branch'
  ],
  chittagong: [
    'GEC Circle Branch (CDA Avenue, Chattogram)',
    'Agrabad Corporate Branch (Agrabad C/A, Chattogram)',
    'Khatunganj Branch (Chattogram)',
    'Nasirabad Branch (Chattogram)',
    'Halishahar Branch (Chattogram)'
  ],
  sylhet: [
    'Sylhet Main Corporate Branch (Zindabazar, Sylhet)',
    'Sylhet Subidbazar Branch',
    'Sylhet Amberkhana Branch',
    'Sylhet Shahjalal Upashahar Branch'
  ],
  rajshahi: [
    'Rajshahi Main Branch (Shaheb Bazar, Rajshahi)',
    'Rajshahi New Market Branch',
    'Rajshahi Kazla RU Branch'
  ],
  khulna: [
    'Khulna Main Branch (KDA Avenue, Khulna)',
    'Khulna Upper Jessore Road Branch',
    'Khulna Sir Iqbal Road Branch'
  ],
  barishal: [
    'Barishal Main Branch (Sadar Road, Barishal)',
    'Barishal Choumatha Branch'
  ],
  bogura: [
    'Bogura Main Branch (Sevenmatha, Bogura)',
    'Bogura Dupchanchia SME Branch',
    'Bogura Sherpur Branch'
  ],
  bogra: [
    'Bogura Main Branch (Sevenmatha, Bogura)',
    'Bogura Dupchanchia SME Branch'
  ],
  mymensingh: [
    'Mymensingh Main Branch (Ganginarpar, Mymensingh)',
    'Mymensingh Town Hall Branch'
  ],
  comilla: [
    'Comilla Main Branch (Kandirpar, Cumilla)',
    'Comilla EPZ Branch'
  ],
  cumilla: [
    'Comilla Main Branch (Kandirpar, Cumilla)',
    'Comilla EPZ Branch'
  ],
  feni: [
    'Feni Main Branch (Trunk Road, Feni)',
    'Feni SS Academy Road Branch'
  ],
  coxsbazar: [
    'Cox\'s Bazar Main Branch (Main Road, Cox\'s Bazar)',
    'Cox\'s Bazar Hotel Motel Zone Branch'
  ],
  kushtia: [
    'Kushtia Main Branch (NS Road, Kushtia)',
    'Kushtia High School Road Branch'
  ],
  jashore: [
    'Jashore Main Branch (MK Road, Jashore)',
    'Jashore Collectorate Branch'
  ],
  tangail: [
    'Tangail Main Branch (Main Road, Tangail)'
  ]
};

export function getMatchingBranches(areaQuery: string, bankName?: string): string[] {
  if (!areaQuery || areaQuery.trim().length < 2) return [];

  const cleanQuery = areaQuery.trim().toLowerCase();
  const matchedBranches: string[] = [];

  // Look for exact or partial key match in AREA_BRANCHES_DATA
  Object.keys(AREA_BRANCHES_DATA).forEach((areaKey) => {
    if (cleanQuery.includes(areaKey) || areaKey.includes(cleanQuery)) {
      AREA_BRANCHES_DATA[areaKey].forEach((branch) => {
        if (!matchedBranches.includes(branch)) {
          matchedBranches.push(branch);
        }
      });
    }
  });

  // If no predefined area matched, generate generic branch suggestions for the typed query
  if (matchedBranches.length === 0 && cleanQuery.length >= 2) {
    const formattedArea = areaQuery.trim().charAt(0).toUpperCase() + areaQuery.trim().slice(1);
    const bName = bankName ? bankName.split(' ')[0] : 'Bank';
    matchedBranches.push(`${formattedArea} Main Branch`);
    matchedBranches.push(`${formattedArea} Commercial Area Branch`);
    matchedBranches.push(`${formattedArea} SME & Agri Branch`);
    matchedBranches.push(`${formattedArea} Evening Branch`);
  }

  return matchedBranches.slice(0, 8);
}
