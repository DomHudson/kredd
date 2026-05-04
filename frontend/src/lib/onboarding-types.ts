export interface Question {
  text: string;
  modelAnswer: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}
