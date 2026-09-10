export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
  questionFormat?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  examYear: string;
  subjectId: string;
  subjectName: string;
  examId?: string;
  topicId?: string;
  syllabusUnit?: string;
  sourceBasis?: 'NCERT' | 'INTERMEDIATE' | 'OFFICIAL_SYLLABUS';
}

export const COMPETITIVE_EXAM_CATALOG: Record<
  string,
  { name: string; subjects: Record<string, string> }
> = {
  'jee-main': {
    name: 'JEE Main',
    subjects: { phy: 'Physics', chem: 'Chemistry', math: 'Mathematics' },
  },
  'jee-advanced': {
    name: 'JEE Advanced',
    subjects: { phy: 'Physics', chem: 'Chemistry', math: 'Mathematics' },
  },
  neet: {
    name: 'NEET',
    subjects: { phy: 'Physics', chem: 'Chemistry', bot: 'Botany', zoo: 'Zoology' },
  },
  eamcet: {
    name: 'EAMCET',
    subjects: {
      math: 'Mathematics',
      phy: 'Physics',
      chem: 'Chemistry',
      bot: 'Botany',
      zoo: 'Zoology',
    },
  },
  polycet: {
    name: 'POLYCET',
    subjects: { math: 'Mathematics', phy: 'Physics', chem: 'Chemistry' },
  },
  ntse: {
    name: 'NTSE',
    subjects: {
      mat: 'Mental Ability',
      'sat-sci': 'Science',
      'sat-sst': 'Social Science',
      'sat-math': 'Mathematics',
    },
  },
  'rjc-cet': {
    name: 'RJC CET',
    subjects: { math: 'Mathematics', sci: 'Science', eng: 'English' },
  },
  gate: {
    name: 'GATE',
    subjects: {
      ga: 'General Aptitude',
      'eng-core': 'Engineering Core',
      'eng-math': 'Engineering Mathematics',
    },
  },
  sainik: {
    name: 'Sainik School',
    subjects: { math: 'Mathematics', intel: 'Intelligence', lang: 'Language', gk: 'General Knowledge' },
  },
  navodaya: {
    name: 'JNVST (Navodaya)',
    subjects: { mat: 'Mental Ability', arith: 'Arithmetic', lang: 'Language' },
  },
  kv: {
    name: 'KV Admission',
    subjects: { eng: 'English', hin: 'Hindi', math: 'Mathematics', sci: 'Science', sst: 'Social Science' },
  },
  emrs: {
    name: 'EMRS Entrance',
    subjects: { mat: 'Mental Ability', arith: 'Arithmetic', lang: 'Language' },
  },
  nmms: {
    name: 'NMMS',
    subjects: {
      mat: 'Mental Ability',
      'sat-sci': 'Science',
      'sat-sst': 'Social Science',
      'sat-math': 'Mathematics',
    },
  },
  olympiad: {
    name: 'Olympiad',
    subjects: { math: 'Mathematics', sci: 'Science', eng: 'English', logic: 'Logical Reasoning' },
  },
  'rgukt-iiit': {
    name: 'RGUKT IIIT',
    subjects: { math: 'Mathematics', phy: 'Physics', chem: 'Chemistry', bio: 'Biology' },
  },
};

export function validateExamSubject(examId: string, subjectId: string): boolean {
  const exam = COMPETITIVE_EXAM_CATALOG[examId];
  if (!exam) return false;
  return Boolean(exam.subjects[subjectId]);
}
