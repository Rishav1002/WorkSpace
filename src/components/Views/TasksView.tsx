import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Repeat
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { OFFICIAL_SUBJECTS, COURSE_CODE_SHORTCUTS, getSubjectsForAcademicGroup } from '../../data/masterData';
import { TaskItem, TaskPriority, TaskStatus } from '../../types';

export const TasksView: React.FC = () => {
  const { user } = useAuth();
  const { tasks, addTask, updateTask, deleteTask, toggleTaskComplete } = useApp();

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const availableSubjects = getSubjectsForAcademicGroup(user?.group);

  // Form states
  const [courseCode, setCourseCode] = useState(() => availableSubjects[0]?.code || 'MCA110226');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const nowIso = new Date().toISOString().split('T')[0];

  const pendingTasks = tasks.filter(t => t.status !== 'DONE');
  const completedTasks = tasks.filter(t => t.status === 'DONE');
  const dueThisWeekTasks = pendingTasks.filter(t => {
    const d = new Date(t.dueDate);
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    return d >= now && d <= nextWeek;
  });

  const displayedTasks = tasks
    .filter(t => {
      if (filter === 'pending') return t.status !== 'DONE';
      if (filter === 'completed') return t.status === 'DONE';
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const handleOpenAdd = () => {
    setEditingTaskId(null);
    setCourseCode('MCA110226');
    setTitle('');
    setDescription('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setPriority('MEDIUM');
    setIsRecurring(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setCourseCode(task.courseCode);
    setTitle(task.title);
    setDescription(task.description || '');
    setDueDate(task.dueDate);
    setPriority(task.priority);
    setIsRecurring(task.isRecurring || false);
    setRecurrenceRule(task.recurrenceRule || 'weekly');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTaskId) {
      updateTask(editingTaskId, {
        courseCode,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        priority,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule : undefined
      });
    } else {
      addTask({
        courseCode,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        priority,
        status: 'TODO',
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule : undefined
      });
    }

    setModalOpen(false);
  };

  const priorityColors: Record<TaskPriority, string> = {
    LOW: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
    MEDIUM: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    HIGH: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    URGENT: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">Tasks & Homework</h2>
          <p className="text-xs text-muted font-mono">Assignments, deadlines & problem sheets</p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-3.5 py-2 text-xs font-bold text-white bg-brand hover:opacity-90 active:scale-95 rounded-xl transition-all shadow-subtle flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card rounded-2xl p-4 flex flex-col justify-between border-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
            Pending Tasks
          </span>
          <span className="font-display text-2xl font-bold text-amber-500 mt-1">
            {pendingTasks.length}
          </span>
        </div>

        <div className="card rounded-2xl p-4 flex flex-col justify-between border-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
            Due This Week
          </span>
          <span className="font-display text-2xl font-bold text-rose-500 mt-1">
            {dueThisWeekTasks.length}
          </span>
        </div>

        <div className="card rounded-2xl p-4 flex flex-col justify-between border-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
            Completed
          </span>
          <span className="font-display text-2xl font-bold text-emerald-500 mt-1">
            {completedTasks.length}
          </span>
        </div>
      </div>

      {/* TASKS LIST */}
      <div className="card rounded-2xl p-4 shadow-subtle border-border space-y-3">
        {/* FILTER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex gap-1.5">
            {(['all', 'pending', 'completed'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                  filter === tab
                    ? 'bg-primary text-background shadow-sm'
                    : 'text-muted hover:bg-surface-hover'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted font-mono">
            {displayedTasks.length} task{displayedTasks.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* ITEMS */}
        <div className="space-y-2.5">
          {displayedTasks.length > 0 ? (
            displayedTasks.map(task => {
              const abbr = COURSE_CODE_SHORTCUTS[task.courseCode] || task.courseCode;
              const isPastDue = task.dueDate < nowIso && task.status !== 'DONE';
              const isDone = task.status === 'DONE';

              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all hover:border-brand/40 shadow-subtle ${
                    isDone ? 'opacity-60 bg-surface-hover/30 border-border' : 'bg-surface border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleTaskComplete(task.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-border bg-background hover:border-brand'
                      }`}
                    >
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                          {abbr}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                            priorityColors[task.priority]
                          }`}
                        >
                          {task.priority}
                        </span>
                        {task.isRecurring && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                            <Repeat className="w-2.5 h-2.5" /> {task.recurrenceRule}
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-xs font-bold text-primary truncate mt-1 ${
                          isDone ? 'line-through text-muted' : ''
                        }`}
                      >
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted mt-1">
                        <span className={`flex items-center gap-1 ${isPastDue ? 'text-rose-500 font-bold' : ''}`}>
                          <Calendar className="w-3 h-3" /> Due {task.dueDate} {isPastDue && '• Overdue'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(task)}
                      className="p-1.5 text-muted hover:text-primary rounded-lg transition-colors"
                      title="Edit task"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 text-muted hover:text-rose-500 rounded-lg transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted">
              <CheckSquare className="w-7 h-7 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No tasks in this view</p>
              <p className="text-[11px] text-muted mt-0.5">Keep it up or add a new homework!</p>
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT TASK MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface p-5 shadow-2xl animate-in zoom-in-95 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h4 className="font-display text-base font-bold text-primary">
                {editingTaskId ? 'Edit Task' : 'New Task / Homework'}
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Subject
                </label>
                <select
                  value={courseCode}
                  onChange={e => setCourseCode(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                >
                  {availableSubjects.map(c => (
                    <option key={c.code} value={c.code} title={c.title}>
                      {COURSE_CODE_SHORTCUTS[c.code] || c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Tree Traversal Code Implementation"
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Additional problem numbers, links or references..."
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={e => setIsRecurring(e.target.checked)}
                    className="rounded border-border text-brand focus:ring-brand accent-brand"
                  />
                  <span className="text-xs font-semibold text-primary">Recurring Task</span>
                </label>
                {isRecurring && (
                  <div className="mt-2 pl-6">
                    <select
                      value={recurrenceRule}
                      onChange={e => setRecurrenceRule(e.target.value as any)}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-1.5 text-xs text-primary"
                    >
                      <option value="daily">Repeats Daily</option>
                      <option value="weekly">Repeats Weekly</option>
                      <option value="monthly">Repeats Monthly</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-95"
                >
                  {editingTaskId ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
