import React, { useState } from 'react';
import { BookOpen, Users, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function Governance() {
  const [openSection, setOpenSection] = useState<string | null>('structure');

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const sections = [
    {
      id: 'structure',
      title: 'Organizational Structure',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>The Yield Organization is governed by an elected executive committee comprising the following key roles:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-bold text-slate-900">President</h4>
              <p className="text-sm mt-2">Oversees all operations, chairs meetings, and acts as the primary representative of the society.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-bold text-slate-900">Secretary</h4>
              <p className="text-sm mt-2">Maintains records, manages correspondence, and ensures compliance with the constitution.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-bold text-slate-900">Treasurer</h4>
              <p className="text-sm mt-2">Manages all financial assets, collects dues, disburses loans, and maintains the ledger.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'constitution',
      title: 'Constitution & Rules',
      icon: BookOpen,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>The written rules governing the operations of Yield Organization:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Membership:</strong> Open to individuals over 18 years of age. Requires a one-time admission fee and regular monthly contributions.</li>
            <li><strong>Monthly Dues:</strong> Must be paid by the 5th of every month. Late payments incur a fine of $5 per day.</li>
            <li><strong>Loans:</strong> Members can apply for loans up to 3x their total contribution after 6 months of active membership. Interest rate is fixed at 5% per annum.</li>
            <li><strong>Profit Sharing:</strong> Net profits generated from loan interest and investments are distributed annually as dividends based on member contribution ratio.</li>
            <li><strong>Meetings:</strong> General body meetings are held quarterly. Emergency meetings can be called by the President with 48 hours notice.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'ethics',
      title: 'Ethical Guidelines',
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>Unwritten and ethical rules that all members are expected to uphold:</p>
          <div className="space-y-4 mt-4">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Transparency
              </h4>
              <p className="text-sm mt-1 pl-4">All financial records and meeting minutes are open for inspection by any active member upon request.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Privacy
              </h4>
              <p className="text-sm mt-1 pl-4">Personal and financial information of members (especially loan details) must be kept strictly confidential by the executive committee.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Neutrality
              </h4>
              <p className="text-sm mt-1 pl-4">Decisions regarding loan approvals and dispute resolutions must be made objectively, without personal bias or favoritism.</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Governance Section</h2>
        <p className="text-slate-500 mt-1">Rules, structure, and ethical guidelines of Yield Organization.</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;

          return (
            <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", section.bgColor, section.color)}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{section.title}</h3>
                </div>
                {isOpen ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </button>
              
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6 pt-2 border-t border-slate-50">
                      {section.content}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
