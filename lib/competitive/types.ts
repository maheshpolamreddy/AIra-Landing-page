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
