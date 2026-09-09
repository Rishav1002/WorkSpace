export function dateToIso(d: Date | string | number): string {
  const nd = new Date(d);
  if (isNaN(nd.getTime())) return '';
  return new Date(nd.getTime() - nd.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function getSlotPeriodWeight(startTime: number, endTime: number): number {
  const duration = endTime - startTime;
  return Math.max(1, Math.round(duration / 50));
}

export function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

export function getWeekDateStrings(anchorDate: Date = new Date()): Record<number, string> {
  const dates: Record<number, string> = {};
  const sunday = new Date(anchorDate);
  sunday.setDate(anchorDate.getDate() - anchorDate.getDay());
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates[i] = dateToIso(d);
  }
  return dates;
}

export function parseMealPills(rawText?: string): string[] {
  if (!rawText) return [];
  return rawText
    .split('/')
    .map(s => s.trim())
    .filter(Boolean)
    .map(item => item.includes('~') ? item.split('~').map(s => s.trim()).join(' / ') : item);
}

/**
 * Authoritative Academic Week Helpers:
 * Monday (1) = Academic Weekend / No Academic Classes
 * Tuesday (2) = Academic Weekend / No Academic Classes
 * Wednesday (3), Thursday (4), Friday (5), Saturday (6), Sunday (0) = Valid Class Days
 */
export function isAcademicClassDay(dayOrDate: number | string | Date): boolean {
  let dayNum: number;
  if (typeof dayOrDate === 'number') {
    dayNum = dayOrDate;
  } else if (typeof dayOrDate === 'string') {
    dayNum = new Date(`${dayOrDate}T00:00:00`).getDay();
  } else {
    dayNum = dayOrDate.getDay();
  }
  // Sunday(0), Wed(3), Thu(4), Fri(5), Sat(6) are valid class days
  return dayNum === 0 || dayNum === 3 || dayNum === 4 || dayNum === 5 || dayNum === 6;
}

export function isAcademicWeekend(dayOrDate: number | string | Date): boolean {
  return !isAcademicClassDay(dayOrDate);
}
