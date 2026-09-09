import React, { useState } from 'react';
import {
  Utensils,
  Shirt,
  Phone,
  Clock,
  Send,
  Building,
  User,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Info,
  X,
  Edit2,
  Plus,
  RotateCcw,
  MapPin
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  OFFICIAL_MESS_SCHEDULE,
  OFFICIAL_HOSTELS,
  WARDEN_DIRECTORY,
  LAUNDRY_MANAGER
} from '../../data/masterData';
import { parseMealPills } from '../../lib/timeUtils';

export const HostelView: React.FC = () => {
  const {
    hostels,
    selectedHostel,
    requestHostelGlobal,
    campusBlocks,
    updateCampusBlock,
    customMealRoutine,
    updateCustomMealDay
  } = useApp();
  const { user, updateProfile } = useAuth();

  const [activeMenuDay, setActiveMenuDay] = useState<number>(() => new Date().getDay());
  const [scheduleMode, setScheduleMode] = useState<'regular' | 'weekend'>('regular');
  const [globalRequestOpen, setGlobalRequestOpen] = useState(false);
  const [reqHostelName, setReqHostelName] = useState(user?.hostel || 'Einstein Hall (Boys)');
  const [reqNotes, setReqNotes] = useState('');
  const [reqPhone, setReqPhone] = useState('');

  // Personal meal customization state
  const [customMealModalOpen, setCustomMealModalOpen] = useState(false);
  const [customBreakfast, setCustomBreakfast] = useState('');
  const [customLunch, setCustomLunch] = useState('');
  const [customSnacks, setCustomSnacks] = useState('');
  const [customDinner, setCustomDinner] = useState('');

  // Campus block naming state
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState('');
  const [editingBlockRooms, setEditingBlockRooms] = useState('');

  const daysList = [
    { num: 1, label: 'Mon' },
    { num: 2, label: 'Tue' },
    { num: 3, label: 'Wed' },
    { num: 4, label: 'Thu' },
    { num: 5, label: 'Fri' },
    { num: 6, label: 'Sat' },
    { num: 0, label: 'Sun' }
  ];

  const currentDayMenu = OFFICIAL_MESS_SCHEDULE.weeklyMenu[activeMenuDay];
  const activeTimings =
    scheduleMode === 'regular'
      ? OFFICIAL_MESS_SCHEDULE.regular
      : OFFICIAL_MESS_SCHEDULE.weekendAndHoliday;

  const currentCustomDay = customMealRoutine[activeMenuDay];

  const handleOpenCustomMealModal = () => {
    setCustomBreakfast(currentCustomDay?.breakfast || currentDayMenu?.breakfast || '');
    setCustomLunch(currentCustomDay?.lunch || currentDayMenu?.lunch || '');
    setCustomSnacks(currentCustomDay?.snacks || currentDayMenu?.snacks || '');
    setCustomDinner(currentCustomDay?.dinner || currentDayMenu?.dinner || '');
    setCustomMealModalOpen(true);
  };

  const handleSaveCustomMeal = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomMealDay({
      day: activeMenuDay,
      breakfast: customBreakfast.trim(),
      lunch: customLunch.trim(),
      snacks: customSnacks.trim(),
      dinner: customDinner.trim(),
      updatedAt: new Date().toISOString()
    });
    setCustomMealModalOpen(false);
  };

  const handleResetCustomMeal = () => {
    updateCustomMealDay({
      day: activeMenuDay,
      breakfast: currentDayMenu.breakfast,
      lunch: currentDayMenu.lunch,
      snacks: currentDayMenu.snacks,
      dinner: currentDayMenu.dinner,
      updatedAt: new Date().toISOString()
    });
    setCustomMealModalOpen(false);
  };

  const handleStartEditBlock = (b: { id: string; number: number; name: string }) => {
    setEditingBlockId(b.id);
    setEditingBlockName(b.name);
  };

  const handleSaveBlock = (blockNumber: number) => {
    if (!editingBlockName.trim()) return;
    updateCampusBlock(blockNumber, editingBlockName.trim());
    setEditingBlockId(null);
  };

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqNotes.trim()) return;

    requestHostelGlobal({
      hostelName: reqHostelName,
      notes: reqNotes.trim(),
      wardenPhone: reqPhone.trim() || undefined
    });

    setGlobalRequestOpen(false);
    setReqNotes('');
    setReqPhone('');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER & HOSTEL SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">Hostel & Mess Life</h2>
          <p className="text-xs text-muted font-mono">
            {selectedHostel?.name} · Room {user?.hostelRoom || 'Not set'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={user?.hostel || 'Einstein Hall (Boys)'}
            onChange={e => updateProfile({ hostel: e.target.value })}
            className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs text-primary font-bold shadow-subtle focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {hostels.map(h => (
              <option key={h.id} value={h.name}>
                {h.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setGlobalRequestOpen(true)}
            className="px-3 py-1.5 text-xs font-bold text-brand bg-brand/10 hover:bg-brand/20 active:scale-95 rounded-xl transition-all border border-brand/20 flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Request Update</span>
          </button>
        </div>
      </div>

      {/* MESS MENU SECTION */}
      <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-brand" />
            <h3 className="font-display font-bold text-base text-primary">
              Weekly Dining Hall Menu
            </h3>
          </div>

          <div className="flex bg-surface-hover border border-border rounded-xl p-0.5 font-mono text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setScheduleMode('regular')}
              className={`px-3 py-1 rounded-lg transition-all ${
                scheduleMode === 'regular'
                  ? 'bg-primary text-background shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Regular Days
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('weekend')}
              className={`px-3 py-1 rounded-lg transition-all ${
                scheduleMode === 'weekend'
                  ? 'bg-primary text-background shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Weekends & Holidays
            </button>
          </div>
        </div>

        {/* DAY SELECTOR PILLS */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {daysList.map(d => {
            const isSelected = activeMenuDay === d.num;
            const isToday = new Date().getDay() === d.num;

            return (
              <button
                key={d.num}
                type="button"
                onClick={() => setActiveMenuDay(d.num)}
                className={`py-2 px-4 rounded-xl text-xs font-bold font-mono transition-all flex flex-col items-center gap-0.5 shrink-0 ${
                  isSelected
                    ? 'bg-brand text-white shadow-md'
                    : 'bg-surface hover:bg-surface-hover text-muted border border-border'
                }`}
              >
                <span>{d.label}</span>
                {isToday && (
                  <span className={`text-[9px] font-bold ${isSelected ? 'text-white/90' : 'text-brand'}`}>
                    TODAY
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* MEAL CARDS GRID */}
        {currentDayMenu && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Breakfast */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Breakfast
                  </h4>
                  <span className="text-[10px] font-mono text-muted">
                    {activeTimings[0]?.timeDisplay}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parseMealPills(currentDayMenu.breakfast).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-surface-hover border border-border text-primary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Lunch */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Lunch
                  </h4>
                  <span className="text-[10px] font-mono text-muted">
                    {activeTimings[1]?.timeDisplay}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parseMealPills(currentDayMenu.lunch).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-surface-hover border border-border text-primary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Evening Snacks */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Evening Snacks
                  </h4>
                  <span className="text-[10px] font-mono text-muted">
                    {activeTimings[2]?.timeDisplay}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parseMealPills(currentDayMenu.snacks).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-surface-hover border border-border text-primary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Dinner */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Dinner
                  </h4>
                  <span className="text-[10px] font-mono text-muted">
                    {activeTimings[3]?.timeDisplay}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parseMealPills(currentDayMenu.dinner).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-surface-hover border border-border text-primary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LAUNDRY & WARDEN DIRECTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LAUNDRY CARD */}
        <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-display font-bold text-base text-primary flex items-center gap-1.5">
              <Shirt className="w-4 h-4 text-brand" />
              Laundry Routine & Distribution
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-hover text-muted">
              4:00 PM – 6:00 PM
            </span>
          </div>

          <p className="text-xs text-muted leading-relaxed font-medium">
            Bi-weekly rotational schedule for campus residences. Clothes submitted are processed and returned on alternating cycles.
          </p>

          <div className="space-y-2 pt-1">
            {selectedHostel?.laundryDays.map((ld, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-border bg-surface-hover/30 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-primary">{ld.dayName}</span>
                  <p className="text-[11px] text-muted mt-0.5">{ld.description}</p>
                </div>
                <span className="text-[10px] font-mono text-muted bg-surface px-2 py-0.5 rounded border border-border">
                  {ld.timeSlot}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
            <span>Supervisor: {LAUNDRY_MANAGER.name}</span>
            <a
              href={`tel:+91${LAUNDRY_MANAGER.phone}`}
              className="text-brand font-bold underline flex items-center gap-1"
            >
              <Phone className="w-3 h-3" /> {LAUNDRY_MANAGER.phone}
            </a>
          </div>
        </div>

        {/* WARDEN DIRECTORY */}
        <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-display font-bold text-base text-primary flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-brand" />
              Warden & Support Directory
            </h3>
            <span className="text-[10px] font-mono text-muted">24/7 Campus Dispatch</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {WARDEN_DIRECTORY.map((contact, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl border border-border flex items-center justify-between hover:bg-surface-hover/50 transition-colors"
              >
                <div>
                  <h5 className="text-xs font-bold text-primary">{contact.name}</h5>
                  <p className="text-[10px] font-mono text-muted">{contact.role}</p>
                </div>
                <a
                  href={`tel:+91${contact.phone}`}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border text-brand text-xs font-mono font-bold hover:bg-brand/10 transition-colors flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" /> {contact.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REQUEST GLOBAL UPDATE MODAL */}
      {globalRequestOpen && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface p-5 shadow-2xl animate-in zoom-in-95 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <h4 className="font-display text-base font-bold text-primary">
                  Submit Hostel Correction
                </h4>
                <p className="text-[11px] font-mono text-muted">
                  Request updates to mess menu or warden contacts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGlobalRequestOpen(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGlobalSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Hostel
                </label>
                <select
                  value={reqHostelName}
                  onChange={e => setReqHostelName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                >
                  {hostels.map(h => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Correction Details / New Menu Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={reqNotes}
                  onChange={e => setReqNotes(e.target.value)}
                  placeholder="Describe the schedule correction or menu discrepancy..."
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                ></textarea>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Contact Phone (Optional)
                </label>
                <input
                  type="text"
                  value={reqPhone}
                  onChange={e => setReqPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setGlobalRequestOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-95"
                >
                  Submit for Global Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
