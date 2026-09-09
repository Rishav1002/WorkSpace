import { SubjectCourse, TimetableSlot, CalendarEvent, HostelInfo, MessSchedule } from '../types';

export const OFFICIAL_SUBJECTS: Record<string, SubjectCourse> = {
  MCA110126: {
    code: 'MCA110126',
    title: 'Computational Probability & Statistics',
    teacher: 'Mr. Sanjeev Kumar',
    tokenColor: 'orange',
    icon: 'fa-calculator',
    type: 'Theory',
    credits: 4,
    room: 'R605 / R512'
  },
  MCA110226: {
    code: 'MCA110226',
    title: 'Advanced Python Programming',
    teacher: 'Dr. Jaspreet Singh',
    tokenColor: 'blue',
    icon: 'fa-python',
    type: 'Theory',
    credits: 4,
    room: 'R512 / R603'
  },
  MCA110326: {
    code: 'MCA110326',
    title: 'Advanced Python Programming Lab',
    teacher: 'Mr. Rohit',
    tokenColor: 'blue',
    icon: 'fa-laptop-code',
    type: 'Lab',
    credits: 2,
    room: 'L204'
  },
  MCA110426: {
    code: 'MCA110426',
    title: 'Foundations of Artificial Intelligence',
    teacher: 'Dr. Saloni Manhas',
    tokenColor: 'purple',
    icon: 'fa-brain',
    type: 'Theory',
    credits: 4,
    room: 'R605 / R512'
  },
  MCA110526: {
    code: 'MCA110526',
    title: 'Foundations of AI Lab',
    teacher: 'Mr. Davinder',
    tokenColor: 'purple',
    icon: 'fa-network-wired',
    type: 'Lab',
    credits: 2,
    room: 'L604'
  },
  MCA110626: {
    code: 'MCA110626',
    title: 'Professional Communication',
    teacher: 'Dr. Ankita',
    tokenColor: 'pink',
    icon: 'fa-comments',
    type: 'Theory',
    credits: 2,
    room: 'L604 / L212'
  },
  MCA110726: {
    code: 'MCA110726',
    title: 'Database Systems',
    teacher: 'Mr. Vijay Kumar',
    tokenColor: 'emerald',
    icon: 'fa-database',
    type: 'Theory',
    credits: 4,
    room: 'R512 / R603'
  },
  MCA110826: {
    code: 'MCA110826',
    title: 'Database Systems Lab',
    teacher: 'Ms. Mandeep Kaur',
    tokenColor: 'emerald',
    icon: 'fa-server',
    type: 'Lab',
    credits: 2,
    room: 'L205'
  },
  MCA110926: {
    code: 'MCA110926',
    title: 'Advanced Data Structures & Algorithms',
    teacher: 'Dr. Harmeet Kaur',
    tokenColor: 'rose',
    icon: 'fa-sitemap',
    type: 'Theory',
    credits: 4,
    room: 'R311 / R512 / R603'
  },
  MCA111026: {
    code: 'MCA111026',
    title: 'Advanced DSA Lab',
    teacher: 'Ms. Anjula',
    tokenColor: 'rose',
    icon: 'fa-diagram-project',
    type: 'Lab',
    credits: 2,
    room: 'L604'
  },
  MMP: {
    code: 'MMP2025',
    title: 'Mentor Mentee Program',
    teacher: 'Dr. Saloni Manhas',
    tokenColor: 'slate',
    icon: 'fa-users',
    type: 'Mentorship',
    credits: 1,
    room: 'L204'
  },
  SS: {
    code: 'MSSS-S1-1',
    title: 'Soft Skills',
    teacher: 'Hina',
    tokenColor: 'amber',
    icon: 'fa-comments',
    type: 'Skill',
    credits: 1,
    room: 'R605'
  },
  VA: {
    code: 'MSVA-S1-1',
    title: 'Verbal Ability',
    teacher: 'Hina',
    tokenColor: 'amber',
    icon: 'fa-language',
    type: 'Skill',
    credits: 1,
    room: 'R605'
  },
  LR: {
    code: 'PGLR-S1-1',
    title: 'Logical Reasoning',
    teacher: 'Shivani Sahaye',
    tokenColor: 'amber',
    icon: 'fa-brain',
    type: 'Skill',
    credits: 1,
    room: 'R605'
  },
  QA: {
    code: 'PGQA-S1-1',
    title: 'Quantitative Aptitude',
    teacher: 'Shivani Sahaye',
    tokenColor: 'amber',
    icon: 'fa-calculator',
    type: 'Skill',
    credits: 1,
    room: 'R605'
  },
  BDIJ: {
    code: 'PTDSA001',
    title: 'Basic DSA in Java',
    teacher: 'Saurav Chauhan',
    tokenColor: 'rose',
    icon: 'fa-code',
    type: 'Practice',
    credits: 2,
    room: 'L105 / L604'
  }
};

export const COURSE_CODE_SHORTCUTS: Record<string, string> = {
  MCA110126: 'CPS',
  MCA110226: 'APP',
  MCA110326: 'APP Lab',
  MCA110426: 'FAI',
  MCA110526: 'FAI Lab',
  MCA110626: 'PC',
  MCA110726: 'DS',
  MCA110826: 'DS Lab',
  MCA110926: 'ADSA',
  MCA111026: 'ADSA Lab',
  MMP: 'MMP',
  SS: 'SS',
  VA: 'VA',
  LR: 'LR',
  QA: 'QA',
  BDIJ: 'BDIJ'
};

/**
 * Returns canonical short code for any subject/course code
 */
export function getSubjectShortCode(code: string): string {
  if (COURSE_CODE_SHORTCUTS[code]) return COURSE_CODE_SHORTCUTS[code];
  // If code itself has a known alias or is short
  return code;
}

/**
 * Dynamically resolves all academic subjects belonging to a given academic group
 * Derived from the authoritative timetable slots and subject master data.
 */
export function getSubjectsForAcademicGroup(groupName: string): SubjectCourse[] {
  // Collect all unique course codes scheduled for this group
  const groupSlots = OFFICIAL_TIMETABLE_SLOTS.filter(s => s.group === groupName && s.courseCode !== 'LUNCH' && s.courseCode !== 'LIBRARY');
  const groupCourseCodes = new Set(groupSlots.map(s => s.courseCode));

  // Maintain consistent official subject ordering
  const matchedSubjects: SubjectCourse[] = [];
  for (const [code, subject] of Object.entries(OFFICIAL_SUBJECTS)) {
    if (groupCourseCodes.has(code) || groupSlots.length === 0) {
      matchedSubjects.push(subject);
    }
  }

  // Fallback: if group was not found or has no slots, return all official subjects
  return matchedSubjects.length > 0 ? matchedSubjects : Object.values(OFFICIAL_SUBJECTS);
}

// Official MCA Timetable for Semester 1 (2026-2027)
// Authoritative Academic Class Days: Wednesday (3), Thursday (4), Friday (5), Saturday (6), Sunday (0)
// Academic Weekend / Non-Class Days: Monday (1), Tuesday (2) - strictly ZERO regular slots
export const OFFICIAL_TIMETABLE_SLOTS: TimetableSlot[] = [
  // ==========================================
  // MCA DS 1A (Wednesday - Sunday)
  // ==========================================

  // Wednesday (Day 3) - MCA DS 1A
  { id: 'tt-ds-wed-1', day: 3, startTime: 570, endTime: 620, courseCode: 'MCA110426', room: 'R605', teacher: 'Dr. Saloni Manhas', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-wed-2', day: 3, startTime: 620, endTime: 670, courseCode: 'LR', room: 'R605', teacher: 'Shivani Sahaye', name: 'Logical Reasoning', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-wed-3', day: 3, startTime: 670, endTime: 770, courseCode: 'MCA110526', room: 'L604', teacher: 'Mr. Davinder', isOfficial: true, group: 'MCA DS 1A' }, // 2-period FAI Lab stretch
  { id: 'tt-ds-wed-lunch', day: 3, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-wed-4', day: 3, startTime: 815, endTime: 860, courseCode: 'MCA110126', room: 'R605', teacher: 'Mr. Sanjeev Kumar', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-wed-5', day: 3, startTime: 860, endTime: 950, courseCode: 'BDIJ', room: 'L105', teacher: 'Saurav Chauhan', isOfficial: true, group: 'MCA DS 1A' }, // 2-period BDIJ stretch
  { id: 'tt-ds-wed-6', day: 3, startTime: 950, endTime: 995, courseCode: 'VA', room: 'R605', teacher: 'Hina', name: 'Verbal Ability', isOfficial: true, group: 'MCA DS 1A' },

  // Thursday (Day 4) - MCA DS 1A
  { id: 'tt-ds-thu-1', day: 4, startTime: 570, endTime: 620, courseCode: 'MCA110126', room: 'R512', teacher: 'Mr. Sanjeev Kumar', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-thu-2', day: 4, startTime: 620, endTime: 670, courseCode: 'MCA110426', room: 'R512', teacher: 'Dr. Saloni Manhas', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-thu-3', day: 4, startTime: 670, endTime: 720, courseCode: 'MCA110226', room: 'R512', teacher: 'Dr. Jaspreet Singh', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-thu-4', day: 4, startTime: 720, endTime: 770, courseCode: 'MCA110726', room: 'R512', teacher: 'Mr. Vijay Kumar', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-thu-lunch', day: 4, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-thu-5', day: 4, startTime: 815, endTime: 860, courseCode: 'MCA110926', room: 'R311', teacher: 'Dr. Harmeet Kaur', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-thu-6', day: 4, startTime: 860, endTime: 905, courseCode: 'MCA110626', room: 'L604', teacher: 'Dr. Ankita', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-thu-7', day: 4, startTime: 905, endTime: 995, courseCode: 'MCA110826', room: 'L205', teacher: 'Ms. Mandeep Kaur', isOfficial: true, group: 'MCA DS 1A' }, // 2-period DS Lab stretch

  // Friday (Day 5) - MCA DS 1A
  { id: 'tt-ds-fri-1', day: 5, startTime: 570, endTime: 620, courseCode: 'MCA110926', room: 'R512', teacher: 'Dr. Harmeet Kaur', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-fri-lib', day: 5, startTime: 620, endTime: 670, courseCode: 'LIBRARY', room: 'Central Library', name: 'Library / Self Study', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-fri-2', day: 5, startTime: 670, endTime: 720, courseCode: 'MCA110126', room: 'R512', teacher: 'Mr. Sanjeev Kumar', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-fri-3', day: 5, startTime: 720, endTime: 770, courseCode: 'MCA110226', room: 'R512', teacher: 'Dr. Jaspreet Singh', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-fri-lunch', day: 5, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-fri-4', day: 5, startTime: 815, endTime: 860, courseCode: 'SS', room: 'R605', teacher: 'Hina', name: 'Soft Skills', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-fri-5', day: 5, startTime: 860, endTime: 905, courseCode: 'QA', room: 'R605', teacher: 'Shivani Sahaye', name: 'Quantitative Aptitude', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-fri-6', day: 5, startTime: 905, endTime: 995, courseCode: 'BDIJ', room: 'L604', teacher: 'Saurav Chauhan', isOfficial: true, group: 'MCA DS 1A' }, // 2-period BDIJ stretch

  // Saturday (Day 6) - MCA DS 1A
  { id: 'tt-ds-sat-1', day: 6, startTime: 570, endTime: 670, courseCode: 'MCA111026', room: 'L604', teacher: 'Ms. Anjula', isOfficial: true, group: 'MCA DS 1A' }, // 2-period ADSA Lab
  { id: 'tt-ds-sat-2', day: 6, startTime: 670, endTime: 720, courseCode: 'MCA110726', room: 'R603', teacher: 'Mr. Vijay Kumar', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-sat-3', day: 6, startTime: 720, endTime: 770, courseCode: 'MCA110626', room: 'L212', teacher: 'Dr. Ankita', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-sat-lunch', day: 6, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-sat-4', day: 6, startTime: 815, endTime: 905, courseCode: 'BDIJ', room: 'L604', teacher: 'Saurav Chauhan', isOfficial: true, group: 'MCA DS 1A' }, // 2-period BDIJ stretch
  { id: 'tt-ds-sat-5', day: 6, startTime: 905, endTime: 950, courseCode: 'MCA110226', room: 'R603', teacher: 'Dr. Jaspreet Singh', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-sat-6', day: 6, startTime: 950, endTime: 995, courseCode: 'MCA110926', room: 'R603', teacher: 'Dr. Harmeet Kaur', isOfficial: true, group: 'MCA DS 1A' },

  // Sunday (Day 0) - MCA DS 1A
  { id: 'tt-ds-sun-1', day: 0, startTime: 670, endTime: 720, courseCode: 'MCA110426', room: 'R512', teacher: 'Dr. Saloni Manhas', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-sun-2', day: 0, startTime: 720, endTime: 770, courseCode: 'MCA110726', room: 'R512', teacher: 'Mr. Vijay Kumar', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-sun-lunch', day: 0, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA DS 1A' },
  { id: 'tt-ds-sun-3', day: 0, startTime: 815, endTime: 905, courseCode: 'MCA110326', room: 'L204', teacher: 'Mr. Rohit', isOfficial: true, group: 'MCA DS 1A' }, // 2-period APP Lab stretch
  { id: 'tt-ds-sun-4', day: 0, startTime: 905, endTime: 950, courseCode: 'MMP', room: 'L204', teacher: 'Dr. Saloni Manhas', name: 'Mentor Mentee Program', isOfficial: true, group: 'MCA DS 1A' },

  // ==========================================
  // MCA General 1A (Wednesday - Sunday)
  // ==========================================

  // Wednesday (Day 3) - MCA General 1A
  { id: 'tt-gen-wed-1', day: 3, startTime: 570, endTime: 620, courseCode: 'MCA110126', room: 'R603', teacher: 'Mr. Sanjeev Kumar', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-wed-2', day: 3, startTime: 620, endTime: 670, courseCode: 'MCA110226', room: 'R603', teacher: 'Dr. Jaspreet Singh', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-wed-3', day: 3, startTime: 670, endTime: 770, courseCode: 'MCA110326', room: 'L204', teacher: 'Mr. Rohit', isOfficial: true, group: 'MCA General 1A' }, // 2-period APP Lab
  { id: 'tt-gen-wed-lunch', day: 3, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-wed-4', day: 3, startTime: 815, endTime: 860, courseCode: 'MCA110726', room: 'R603', teacher: 'Mr. Vijay Kumar', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-wed-5', day: 3, startTime: 860, endTime: 905, courseCode: 'LR', room: 'R603', teacher: 'Shivani Sahaye', name: 'Logical Reasoning', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-wed-6', day: 3, startTime: 905, endTime: 950, courseCode: 'VA', room: 'R603', teacher: 'Hina', name: 'Verbal Ability', isOfficial: true, group: 'MCA General 1A' },

  // Thursday (Day 4) - MCA General 1A
  { id: 'tt-gen-thu-1', day: 4, startTime: 570, endTime: 620, courseCode: 'MCA110426', room: 'R603', teacher: 'Dr. Saloni Manhas', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-thu-2', day: 4, startTime: 620, endTime: 670, courseCode: 'MCA110926', room: 'R603', teacher: 'Dr. Harmeet Kaur', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-thu-3', day: 4, startTime: 670, endTime: 770, courseCode: 'MCA110826', room: 'L205', teacher: 'Ms. Mandeep Kaur', isOfficial: true, group: 'MCA General 1A' }, // 2-period DS Lab
  { id: 'tt-gen-thu-lunch', day: 4, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-thu-4', day: 4, startTime: 815, endTime: 860, courseCode: 'MCA110626', room: 'L212', teacher: 'Dr. Ankita', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-thu-5', day: 4, startTime: 860, endTime: 905, courseCode: 'MCA110126', room: 'R603', teacher: 'Mr. Sanjeev Kumar', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-thu-6', day: 4, startTime: 905, endTime: 995, courseCode: 'BDIJ', room: 'L105', teacher: 'Saurav Chauhan', isOfficial: true, group: 'MCA General 1A' }, // 2-period BDIJ stretch

  // Friday (Day 5) - MCA General 1A
  { id: 'tt-gen-fri-1', day: 5, startTime: 570, endTime: 620, courseCode: 'MCA110226', room: 'R603', teacher: 'Dr. Jaspreet Singh', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-fri-2', day: 5, startTime: 620, endTime: 670, courseCode: 'MCA110726', room: 'R603', teacher: 'Mr. Vijay Kumar', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-fri-3', day: 5, startTime: 670, endTime: 720, courseCode: 'MCA110426', room: 'R603', teacher: 'Dr. Saloni Manhas', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-fri-4', day: 5, startTime: 720, endTime: 770, courseCode: 'SS', room: 'R603', teacher: 'Hina', name: 'Soft Skills', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-fri-lunch', day: 5, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-fri-5', day: 5, startTime: 815, endTime: 860, courseCode: 'QA', room: 'R603', teacher: 'Shivani Sahaye', name: 'Quantitative Aptitude', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-fri-6', day: 5, startTime: 860, endTime: 950, courseCode: 'MCA110526', room: 'L604', teacher: 'Mr. Davinder', isOfficial: true, group: 'MCA General 1A' }, // 2-period FAI Lab

  // Saturday (Day 6) - MCA General 1A
  { id: 'tt-gen-sat-1', day: 6, startTime: 570, endTime: 620, courseCode: 'MCA110926', room: 'R603', teacher: 'Dr. Harmeet Kaur', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sat-2', day: 6, startTime: 620, endTime: 670, courseCode: 'MCA110126', room: 'R603', teacher: 'Mr. Sanjeev Kumar', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sat-3', day: 6, startTime: 670, endTime: 770, courseCode: 'MCA111026', room: 'L604', teacher: 'Ms. Anjula', isOfficial: true, group: 'MCA General 1A' }, // 2-period ADSA Lab
  { id: 'tt-gen-sat-lunch', day: 6, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sat-4', day: 6, startTime: 815, endTime: 860, courseCode: 'MCA110626', room: 'L604', teacher: 'Dr. Ankita', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sat-5', day: 6, startTime: 860, endTime: 905, courseCode: 'LIBRARY', room: 'Central Library', name: 'Library / Self Study', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sat-6', day: 6, startTime: 905, endTime: 995, courseCode: 'BDIJ', room: 'L604', teacher: 'Saurav Chauhan', isOfficial: true, group: 'MCA General 1A' }, // 2-period BDIJ stretch

  // Sunday (Day 0) - MCA General 1A
  { id: 'tt-gen-sun-1', day: 0, startTime: 670, endTime: 720, courseCode: 'MCA110726', room: 'R603', teacher: 'Mr. Vijay Kumar', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sun-2', day: 0, startTime: 720, endTime: 770, courseCode: 'MCA110426', room: 'R603', teacher: 'Dr. Saloni Manhas', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sun-lunch', day: 0, startTime: 770, endTime: 815, courseCode: 'LUNCH', room: 'Campus', name: 'LUNCH BREAK', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sun-3', day: 0, startTime: 815, endTime: 860, courseCode: 'MCA110226', room: 'R603', teacher: 'Dr. Jaspreet Singh', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sun-4', day: 0, startTime: 860, endTime: 905, courseCode: 'MCA110926', room: 'R603', teacher: 'Dr. Harmeet Kaur', isOfficial: true, group: 'MCA General 1A' },
  { id: 'tt-gen-sun-5', day: 0, startTime: 905, endTime: 950, courseCode: 'MMP', room: 'L204', teacher: 'Dr. Saloni Manhas', name: 'Mentor Mentee Program', isOfficial: true, group: 'MCA General 1A' }
];

// Official CGC University Academic Calendar (2026-2027 Session)
export const OFFICIAL_ACADEMIC_CALENDAR: CalendarEvent[] = [
  {
    id: 'cal-commence',
    title: 'Commencement of Classes (Odd Semester)',
    dateStr: '2026-07-29',
    category: 'academic',
    isOfficial: true,
    classImpact: 'none'
  },
  {
    id: 'cal-indep',
    title: 'Independence Day',
    dateStr: '2026-08-15',
    category: 'holiday',
    isOfficial: true,
    classImpact: 'cancel_all'
  },
  {
    id: 'cal-bandh',
    title: 'Punjab Bandh',
    dateStr: '2026-08-21',
    category: 'holiday',
    isOfficial: true,
    classImpact: 'cancel_all'
  },
  {
    id: 'cal-fat-adsa',
    title: 'FAT Exam: Advanced Data Structures & Algorithms',
    dateStr: '2026-08-31',
    category: 'exam',
    examCategory: 'FAT',
    courseCode: 'MCA110926',
    startTime: '10:00',
    endTime: '11:30',
    isOfficial: true,
    classImpact: 'none'
  },
  {
    id: 'cal-fat-app',
    title: 'FAT Exam: Advanced Python Programming',
    dateStr: '2026-09-01',
    category: 'exam',
    examCategory: 'FAT',
    courseCode: 'MCA110226',
    startTime: '10:00',
    endTime: '11:30',
    isOfficial: true,
    classImpact: 'none'
  },
  {
    id: 'cal-fat-cps',
    title: 'FAT Exam: Computational Probability & Statistics',
    dateStr: '2026-09-02',
    category: 'exam',
    examCategory: 'FAT',
    courseCode: 'MCA110126',
    startTime: '10:00',
    endTime: '11:30',
    isOfficial: true,
    classImpact: 'none'
  },
  {
    id: 'cal-fat-ds',
    title: 'FAT Exam: Database Systems',
    dateStr: '2026-09-03',
    category: 'exam',
    examCategory: 'FAT',
    courseCode: 'MCA110726',
    startTime: '10:00',
    endTime: '11:30',
    isOfficial: true,
    classImpact: 'none'
  },
  {
    id: 'cal-fat-fai',
    title: 'FAT Exam: Foundations of Artificial Intelligence',
    dateStr: '2026-09-04',
    category: 'exam',
    examCategory: 'FAT',
    courseCode: 'MCA110426',
    startTime: '10:00',
    endTime: '11:30',
    isOfficial: true,
    classImpact: 'none'
  },
  {
    id: 'cal-teachers-day',
    title: 'Teachers Day',
    dateStr: '2026-09-05',
    category: 'holiday',
    isOfficial: true,
    classImpact: 'cancel_all'
  },
  {
    id: 'cal-gandhi-jayanti',
    title: 'Mahatma Gandhi Jayanti',
    dateStr: '2026-10-02',
    category: 'holiday',
    isOfficial: true,
    classImpact: 'cancel_all'
  },
  {
    id: 'cal-dussehra',
    title: 'Dussehra / Autumn Break',
    dateStr: '2026-10-19',
    endDateStr: '2026-10-24',
    category: 'holiday',
    isOfficial: true,
    classImpact: 'cancel_all'
  },
  {
    id: 'cal-diwali',
    title: 'Diwali Festival Break',
    dateStr: '2026-11-08',
    endDateStr: '2026-11-13',
    category: 'holiday',
    isOfficial: true,
    classImpact: 'cancel_all'
  },
  {
    id: 'cal-gurunanak',
    title: 'Guru Nanak Jayanti',
    dateStr: '2026-11-24',
    category: 'holiday',
    isOfficial: true,
    classImpact: 'cancel_all'
  },
  {
    id: 'cal-last-teaching',
    title: 'Last Teaching Day of Semester',
    dateStr: '2026-11-28',
    category: 'academic',
    isOfficial: true,
    classImpact: 'none'
  },
  {
    id: 'cal-end-sem',
    title: 'End-Semester Final Examinations',
    dateStr: '2026-12-01',
    endDateStr: '2026-12-22',
    category: 'exam',
    examCategory: 'Final',
    isOfficial: true,
    classImpact: 'cancel_all'
  }
];

// Campus Academic Blocks 1 to 7 (Classroom blocks with user-customizable names)
export const DEFAULT_CAMPUS_BLOCKS = [
  { id: 'block-1', number: 1, name: 'Block 1 — Computer Science & IT' },
  { id: 'block-2', number: 2, name: 'Block 2 — Engineering & Technology' },
  { id: 'block-3', number: 3, name: 'Block 3 — Management Studies' },
  { id: 'block-4', number: 4, name: 'Block 4 — Sciences & Research' },
  { id: 'block-5', number: 5, name: 'Block 5 — Mathematical Sciences' },
  { id: 'block-6', number: 6, name: 'Block 6 — Central Academic Complex' },
  { id: 'block-7', number: 7, name: 'Block 7 — Computing Laboratories & Innovation Hub' }
];

// Official Hostel Information (1. Einstein Hall, 2. Tagore Hall, 3. Rosewood Hall, 4. Ivory Hall, 5. Chanakya Hall, and Outside Campus Hostels)
export const OFFICIAL_HOSTELS: HostelInfo[] = [
  {
    id: 'einstein',
    name: 'Einstein Hall',
    blocks: ['1st to 3rd Floor', '4th to 6th Floor', '7th to 11th Floor'],
    wardens: [
      { id: 'w-main', name: 'Warden Office', roleOrFloor: 'Main Desk', phone: '9056764078', hostelId: 'einstein' },
      { id: 'w-1', name: 'Mr. Manoj Kumar', roleOrFloor: '1st Floor to 3rd Floor', phone: '9096086486', hostelId: 'einstein' },
      { id: 'w-2', name: 'Mr. Ranjit Singh', roleOrFloor: '4th Floor to 6th Floor', phone: '7743014468', hostelId: 'einstein' },
      { id: 'w-3', name: 'Mr. Suneel Kumar', roleOrFloor: '7th Floor to 11th Floor', phone: '7527889652', hostelId: 'einstein' },
      { id: 'w-4', name: 'Mr. Gopal Tomar', roleOrFloor: 'Senior Warden / Assistance', phone: '9045368400', hostelId: 'einstein' }
    ],
    laundryDays: [
      { day: 1, dayName: 'Monday', timeSlot: '4:00 PM to 6:00 PM', description: 'Einstein & Outcampus Hostel Drop & Pick' },
      { day: 4, dayName: 'Thursday', timeSlot: '4:00 PM to 6:00 PM', description: 'Einstein & Outcampus Hostel Drop & Pick' }
    ]
  },
  {
    id: 'tagore',
    name: 'Tagore Hall',
    blocks: ['Wing A', 'Wing B', 'Wing C'],
    wardens: [
      { id: 'w-tg-main', name: 'Warden Office', roleOrFloor: 'Main Desk', phone: '9056764078', hostelId: 'tagore' }
    ],
    laundryDays: [
      { day: 3, dayName: 'Wednesday', timeSlot: '4:00 PM to 6:00 PM', description: 'Chanakya & Tagore Drop & Pick' },
      { day: 6, dayName: 'Saturday', timeSlot: '4:00 PM to 6:00 PM', description: 'Chanakya & Tagore Drop & Pick' }
    ]
  },
  {
    id: 'rosewood',
    name: 'Rosewood Hall',
    blocks: ['Block 1', 'Block 2', 'Block 3'],
    wardens: [
      { id: 'w-rw-main', name: 'Warden Office', roleOrFloor: 'Main Desk', phone: '9056764078', hostelId: 'rosewood' }
    ],
    laundryDays: [
      { day: 2, dayName: 'Tuesday', timeSlot: '4:00 PM to 6:00 PM', description: 'Ivory & Rosewood Drop & Pick' },
      { day: 5, dayName: 'Friday', timeSlot: '4:00 PM to 6:00 PM', description: 'Ivory & Rosewood Drop & Pick' }
    ]
  },
  {
    id: 'ivory',
    name: 'Ivory Hall',
    blocks: ['North Wing', 'South Wing'],
    wardens: [
      { id: 'w-iv-main', name: 'Warden Office', roleOrFloor: 'Main Desk', phone: '9056764078', hostelId: 'ivory' }
    ],
    laundryDays: [
      { day: 2, dayName: 'Tuesday', timeSlot: '4:00 PM to 6:00 PM', description: 'Ivory & Rosewood Drop & Pick' },
      { day: 5, dayName: 'Friday', timeSlot: '4:00 PM to 6:00 PM', description: 'Ivory & Rosewood Drop & Pick' }
    ]
  },
  {
    id: 'chanakya',
    name: 'Chanakya Hall',
    blocks: ['Block A', 'Block B'],
    wardens: [
      { id: 'w-ch-main', name: 'Warden Office', roleOrFloor: 'Main Desk', phone: '9056764078', hostelId: 'chanakya' }
    ],
    laundryDays: [
      { day: 3, dayName: 'Wednesday', timeSlot: '4:00 PM to 6:00 PM', description: 'Chanakya & Tagore Drop & Pick' },
      { day: 6, dayName: 'Saturday', timeSlot: '4:00 PM to 6:00 PM', description: 'Chanakya & Tagore Drop & Pick' }
    ]
  },
  {
    id: 'outcampus',
    name: 'Outside Campus Hostels',
    blocks: ['Sector 1 Annex', 'Sector 2 Residency', 'City Apartments'],
    wardens: [
      { id: 'w-out-main', name: 'Warden Office', roleOrFloor: 'Main Desk', phone: '9056764078', hostelId: 'outcampus' }
    ],
    laundryDays: [
      { day: 1, dayName: 'Monday', timeSlot: '4:00 PM to 6:00 PM', description: 'Einstein & Outcampus Hostel Drop & Pick' },
      { day: 4, dayName: 'Thursday', timeSlot: '4:00 PM to 6:00 PM', description: 'Einstein & Outcampus Hostel Drop & Pick' }
    ]
  }
];

export const WARDEN_DIRECTORY = [
  { name: 'Warden Office', role: 'Main Central Desk', phone: '9056764078' },
  { name: 'Mr. Manoj Kumar', role: '1st to 3rd Floor (Einstein)', phone: '9096086486' },
  { name: 'Mr. Ranjit Singh', role: '4th to 6th Floor (Einstein)', phone: '7743014468' },
  { name: 'Mr. Suneel Kumar', role: '7th to 11th Floor (Einstein)', phone: '7527889652' },
  { name: 'Mr. Gopal Tomar', role: 'Senior Warden / Campus Discipline', phone: '9045368400' }
];

export const LAUNDRY_MANAGER = {
  name: 'Ajit Kumar',
  phone: '9622600130',
  timing: '4:00 PM to 6:00 PM'
};

// Official Mess Schedule & Menus
export const OFFICIAL_MESS_SCHEDULE: MessSchedule = {
  regular: [
    { name: 'Breakfast', startMin: 450, endMin: 540, timeDisplay: '07:30 AM to 09:00 AM' },
    { name: 'Lunch', startMin: 720, endMin: 840, timeDisplay: '12:00 PM to 02:00 PM' },
    { name: 'Evening Snacks', startMin: 990, endMin: 1020, timeDisplay: '04:30 PM to 05:00 PM' },
    { name: 'Dinner', startMin: 1170, endMin: 1260, timeDisplay: '07:30 PM to 09:00 PM' }
  ],
  weekendAndHoliday: [
    { name: 'Breakfast', startMin: 480, endMin: 555, timeDisplay: '08:00 AM to 09:15 AM' },
    { name: 'Lunch', startMin: 750, endMin: 840, timeDisplay: '12:30 PM to 02:00 PM' },
    { name: 'Evening Snacks', startMin: 990, endMin: 1020, timeDisplay: '04:30 PM to 05:00 PM' },
    { name: 'Dinner', startMin: 1170, endMin: 1260, timeDisplay: '07:30 PM to 09:00 PM' }
  ],
  weeklyMenu: {
    1: {
      breakfast: 'Aloo Pyaz Parantha / Butter or Curd / Tea',
      lunch: 'Rajmah Masala / Aloo Nutri Sabji / Rice / Roti / Curd / Salad / Pickle',
      snacks: 'Tea / Samosa with Tomato Sauce',
      dinner: 'Channa Dal Tadka / Gatta Kari Sabji / Rice / Roti / Pickle / Salad / Chutney',
      dessert: 'Sonpapdi'
    },
    2: {
      breakfast: 'Cornflex / Aloo Sandwich / Banana / Tea / Milk',
      lunch: 'Black Channa / Aloo Capsicum / Peas Pulao / Roti / Salad / Cucumber Raita',
      snacks: 'Tea / Macroni / Tomato Sauce',
      dinner: 'Mix Dal / Zimikand Mutter Sabji / Rice / Roti / Salad / Chutney',
      dessert: 'Kheer'
    },
    3: {
      breakfast: 'Gobhi Parantha / Curd or Butter / Tea',
      lunch: 'Dal Makhani / Gheeya Sabji / Raita / Nutri Veg Biryani / Roti / Salad / Chutney',
      snacks: 'Tea / Daanish Bunn',
      dinner: 'Masar Dal Sabut / Paneer Makhani~Chicken Curry / Rice / Roti / Salad / Chutney',
      dessert: 'Gulab Jamun'
    },
    4: {
      breakfast: 'Idly Sambhar / Green Chutney / Banana / Juice / Tea',
      lunch: 'Kari Pakora / Aloo Mutter Sabji / Rice / Roti / Salad / Chutney',
      snacks: 'Tea / Rusk',
      dinner: 'Rajmah Raseela / Paneer Biryani / Curd / Roti / Salad / Chutney',
      dessert: 'Besan Burfi'
    },
    5: {
      breakfast: 'Ajwain Parantha / Aloo Sabji / Banana / Tea / Milk',
      lunch: 'White Channa / Kadu Khata Meetha / Raita / Veg Pulao / Pickle / Roti / Salad / Papad',
      snacks: 'Tea / Maggi / Tomato Sauce',
      dinner: 'Hari Moong Dal / Veg Manchurian / Fried Rice / Roti / Chutney',
      dessert: 'Sewiyan'
    },
    6: {
      breakfast: 'Onion Paneer Paratha / Butter / Curd / Pickle / Tea',
      lunch: 'Moongi Masri Dal / Aloo Mushroom Mutter / Curd / Rice / Roti / Salad / Pickle / Chutney',
      snacks: 'Tea / Patties',
      dinner: 'Black Chana / Jeera Aloo / Rice / Roti / Salad / Chutney',
      dessert: 'Kulfi'
    },
    0: {
      breakfast: 'Channa Bhatura / Pickle / Tea',
      lunch: 'Dal Makhani / Veg Noodles / Curd / Rice / Roti / Salad',
      snacks: 'Coffee / Biscuit / Chips',
      dinner: 'Moth Dal / Mutter Paneer~Egg Curry / Roti / Salad / Chutney',
      dessert: 'Brownie'
    }
  }
};
