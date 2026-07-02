export type ContentStatus = 'draft' | 'published' | 'archived'
export type ContentVisibility = 'public' | 'private'
export type QuestionType = 'single_choice' | 'multiple_choice' | 'short_answer' | 'long_answer'

export type Questionnaire = {
  id: string
  shortId: string | null
  slug: string | null
  title: string
  status: ContentStatus
  visibility: ContentVisibility
  timeLimitSeconds: number | null
  allowMultipleAttempts: boolean
  category: string | null
  createdAt: string
  updatedAt: string
}

export type Survey = {
  id: string
  title: string
  status: ContentStatus
  visibility: ContentVisibility
  createdAt: string
  updatedAt: string
}

export type ContentItem =
  | ({ kind: 'questionnaire' } & Questionnaire)
  | ({ kind: 'survey' } & Survey)

export type QuestionOption = {
  id: string
  questionId: string
  label: string
  position: number
  isCorrect: boolean
}

export type Question = {
  id: string
  parentType: 'questionnaire' | 'survey'
  parentId: string
  sectionId: string | null
  type: QuestionType
  prompt: string
  position: number
  required: boolean
  showCorrectAnswer: boolean
  caseSensitive: boolean
  acceptableAnswers: string | null
  createdAt: string
  updatedAt: string
  options: QuestionOption[]
}

export type QuestionnaireDetail = Questionnaire & {
  questions: Question[]
}
