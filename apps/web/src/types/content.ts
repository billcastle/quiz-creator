export type ContentStatus = 'draft' | 'published' | 'archived'
export type ContentVisibility = 'public' | 'private'

export type Questionnaire = {
  id: string
  title: string
  status: ContentStatus
  visibility: ContentVisibility
  createdAt: number
}

export type Survey = {
  id: string
  title: string
  status: ContentStatus
  visibility: ContentVisibility
  createdAt: number
}

export type ContentItem =
  | ({ kind: 'questionnaire' } & Questionnaire)
  | ({ kind: 'survey' } & Survey)
