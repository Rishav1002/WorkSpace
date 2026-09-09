import React, { useState, useEffect } from 'react';
import { Search, X, BookOpen, Clock, Calendar, CheckSquare, Sparkles } from 'lucide-react';
import { OFFICIAL_SUBJECTS, COURSE_CODE_SHORTCUTS } from '../../data/masterData';
import { useApp } from '../../context/AppContext';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCourse?: (courseCode: string) => void;
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose, onSelectCourse }) => {
  const [query, setQuery] = useState('');
  const { setActiveTab } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedCourses = Object.values(OFFICIAL_SUBJECTS).filter(c => {
    if (!q) return true;
    const abbr = COURSE_CODE_SHORTCUTS[c.code] || '';
    return (
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      abbr.toLowerCase().includes(q) ||
      c.teacher.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-md flex items-start justify-center p-4 pt-16 sm:pt-24">
      <div className="card w-full max-w-lg bg-surface shadow-2xl overflow-hidden animate-in zoom-in-95 border-border">
        <div className="flex items-center px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search subjects, faculty, schedule, or tasks..."
            autoFocus
            className="w-full bg-transparent border-none focus:outline-none text-xs py-3.5 px-3 text-primary placeholder:text-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted hover:text-primary p-1 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block font-mono text-[10px] text-muted bg-background border border-border px-1.5 py-0.5 rounded-lg ml-2">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
            Courses & Subjects ({matchedCourses.length})
          </div>
          {matchedCourses.map(course => (
            <button
              key={course.code}
              type="button"
              onClick={() => {
                onClose();
                setActiveTab('hub');
                if (onSelectCourse) onSelectCourse(course.code);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-hover text-left transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs font-bold font-mono shrink-0">
                  {COURSE_CODE_SHORTCUTS[course.code] || 'CS'}
                </div>
                <div className="min-w-0">
                  <h6 className="text-xs font-bold text-primary truncate group-hover:text-brand transition-colors">
                    {course.title}
                  </h6>
                  <p className="text-[10px] font-mono text-muted truncate">
                    {course.code} · {course.teacher}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-background border border-border text-muted shrink-0">
                {course.type}
              </span>
            </button>
          ))}

          <div className="pt-2 px-2 text-[10px] font-mono text-muted uppercase tracking-wider font-bold border-t border-border mt-2">
            Quick Navigation
          </div>
          <div className="grid grid-cols-2 gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('today');
                onClose();
              }}
              className="flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-primary hover:bg-surface-hover"
            >
              <Clock className="w-3.5 h-3.5 text-brand" /> Today's Routine
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('schedule');
                onClose();
              }}
              className="flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-primary hover:bg-surface-hover"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Master Schedule
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('tasks');
                onClose();
              }}
              className="flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-primary hover:bg-surface-hover"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-500" /> Tasks & Homework
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('hostel');
                onClose();
              }}
              className="flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-primary hover:bg-surface-hover"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Mess & Laundry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
