import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  CONTENT_CATEGORIES,
  Input,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@quiz/ui'
import { useBlocker, useNavigate, useParams } from '@tanstack/react-router'
import { ChevronLeft, GripVertical, HelpCircle, Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Question, QuestionnaireDetail, QuestionOption, QuestionType } from '../types/content'

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Single',
  multiple_choice: 'Multiple',
  short_answer: 'Short',
  long_answer: 'Long',
}

const TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  single_choice: 'One correct answer selected from a list of options.',
  multiple_choice: 'One or more correct answers selected from a list of options.',
  short_answer: 'A brief typed response, graded against acceptable answers.',
  long_answer: 'An open-ended typed response. Not auto-graded.',
}

const STATUS_LABELS = { draft: 'Draft', published: 'Published', archived: 'Archived' }

const MIN_SAVE_MS = 700

function makeLocalQuestion(position: number): Question {
  const now = new Date().toISOString()
  return {
    id: nanoid(),
    parentType: 'questionnaire',
    parentId: '',
    sectionId: null,
    type: 'single_choice',
    prompt: '',
    position,
    required: true,
    showCorrectAnswer: false,
    caseSensitive: false,
    acceptableAnswers: null,
    createdAt: now,
    updatedAt: now,
    options: [],
  }
}

// ── Options editor ────────────────────────────────────────────────────────────

function OptionsEditor({
  question,
  onOptionAdd,
  onOptionChange,
  onOptionDelete,
}: {
  question: Question
  onOptionAdd: () => void
  onOptionChange: (id: string, patch: Partial<QuestionOption>) => void
  onOptionDelete: (id: string) => void
}) {
  const isSingle = question.type === 'single_choice'

  return (
    <div className="space-y-2">
      {question.options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-2">
          {isSingle ? (
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={opt.isCorrect}
              onChange={() => {
                for (const o of question.options) {
                  if (o.id !== opt.id && o.isCorrect) onOptionChange(o.id, { isCorrect: false })
                }
                onOptionChange(opt.id, { isCorrect: true })
              }}
              className="mt-0.5 shrink-0 accent-[var(--color-accent)]"
            />
          ) : (
            <Checkbox
              checked={opt.isCorrect}
              onCheckedChange={(v) => onOptionChange(opt.id, { isCorrect: !!v })}
              className="shrink-0"
            />
          )}
          <Input
            value={opt.label}
            onChange={(e) => onOptionChange(opt.id, { label: e.target.value })}
            placeholder="Option text"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => onOptionDelete(opt.id)}
            className="shrink-0 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
            aria-label="Delete option"
            title="Delete option"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onOptionAdd}
        className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
      >
        <Plus size={14} />
        Add option
      </button>
    </div>
  )
}

function AcceptableAnswersEditor({
  question,
  onChange,
}: {
  question: Question
  onChange: (answers: string[]) => void
}) {
  const current: string[] = question.acceptableAnswers ? JSON.parse(question.acceptableAnswers) : []
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (!trimmed || current.includes(trimmed)) return
    onChange([...current, trimmed])
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {current.map((answer) => (
          <span
            key={answer}
            className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-xs text-[var(--color-text-primary)]"
          >
            {answer}
            <button
              type="button"
              onClick={() => onChange(current.filter((a) => a !== answer))}
              className="leading-none text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
              aria-label={`Remove ${answer}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Type an answer and press Enter"
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  )
}

// ── Question editor (center panel) ───────────────────────────────────────────

function QuestionEditor({
  question,
  onPromptChange,
  onTypeChange,
  onCaseSensitiveChange,
  onAcceptableAnswersChange,
  onOptionAdd,
  onOptionChange,
  onOptionDelete,
}: {
  question: Question
  onPromptChange: (prompt: string) => void
  onTypeChange: (type: QuestionType) => void
  onCaseSensitiveChange: (v: boolean) => void
  onAcceptableAnswersChange: (answers: string[]) => void
  onOptionAdd: () => void
  onOptionChange: (id: string, patch: Partial<QuestionOption>) => void
  onOptionDelete: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      {/* Question type — single row with tooltips */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Question type
        </p>
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-1">
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(t)}
              className={`group/type relative shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                question.type === t
                  ? 'bg-[var(--color-bg-surface)] font-medium text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <span className="flex items-center gap-1">
                {TYPE_LABELS[t]}
                <span className="group/tip relative inline-flex">
                  <HelpCircle
                    size={11}
                    className="text-[var(--color-text-disabled)] opacity-60"
                    aria-hidden="true"
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 rounded-md bg-[var(--color-text-primary)] px-2.5 py-2 text-xs leading-snug text-[var(--color-bg-surface)] opacity-0 shadow-md transition-opacity group-hover/tip:opacity-100">
                    {TYPE_DESCRIPTIONS[t]}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[var(--color-text-primary)]" />
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt — rich text */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Question prompt
        </p>
        <RichTextEditor
          content={question.prompt}
          onChange={onPromptChange}
          placeholder="Enter your question…"
        />
      </div>

      {/* Type-specific */}
      {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
            Answer options
          </p>
          <OptionsEditor
            question={question}
            onOptionAdd={onOptionAdd}
            onOptionChange={onOptionChange}
            onOptionDelete={onOptionDelete}
          />
        </div>
      )}

      {question.type === 'short_answer' && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
            Acceptable answers
          </p>
          <AcceptableAnswersEditor question={question} onChange={onAcceptableAnswersChange} />
          <div className="mt-3 flex items-center gap-2">
            <Checkbox
              id={`case-sensitive-${question.id}`}
              checked={question.caseSensitive}
              onCheckedChange={(v) => onCaseSensitiveChange(!!v)}
            />
            <label
              htmlFor={`case-sensitive-${question.id}`}
              className="cursor-pointer text-sm text-[var(--color-text-primary)]"
            >
              Case sensitive
            </label>
          </div>
        </div>
      )}

      {question.type === 'long_answer' && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Respondents will type a free-form response. Long answers are not auto-graded.
        </p>
      )}
    </div>
  )
}

// ── Question card (left panel) ────────────────────────────────────────────────

function QuestionCard({
  question,
  isActive,
  index,
  isDragOver,
  onSelect,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  question: Question
  isActive: boolean
  index: number
  isDragOver: boolean
  onSelect: () => void
  onDelete: () => void
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: draggable list item using HTML5 drag API
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(index)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(index)
      }}
      onDragEnd={onDragEnd}
      className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${
        isActive
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-subtle)]'
      } ${isDragOver ? 'border-t-2 border-t-[var(--color-accent)] opacity-80' : ''}`}
    >
      <span
        className="mt-0.5 shrink-0 cursor-grab text-[var(--color-text-disabled)]"
        aria-hidden="true"
      >
        <GripVertical size={16} />
      </span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-text-disabled)]">{index + 1}</span>
          <Badge variant="secondary" className="text-xs">
            {TYPE_LABELS[question.type]}
          </Badge>
        </div>
        <p className="truncate text-sm text-[var(--color-text-primary)]">
          {question.prompt
            ? question.prompt.replace(/<[^>]+>/g, '') || 'Untitled question'
            : 'Untitled question'}
        </p>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="shrink-0 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
        aria-label="Delete question"
        title="Delete question"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Settings rail (right panel) ───────────────────────────────────────────────

function SettingsRail({
  questionnaire,
  selectedQuestion,
  titleDraft,
  visibility,
  category,
  onTitleChange,
  onTitleBlur,
  onVisibilityChange,
  onCategoryChange,
  onShowCorrectAnswerChange,
}: {
  questionnaire: QuestionnaireDetail | null
  selectedQuestion: Question | null
  titleDraft: string
  visibility: 'public' | 'private'
  category: string | null
  onTitleChange: (v: string) => void
  onTitleBlur: () => void
  onVisibilityChange: (v: 'public' | 'private') => void
  onCategoryChange: (v: string | null) => void
  onShowCorrectAnswerChange: (v: boolean) => void
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-l border-[var(--color-border)] p-4">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Title
        </p>
        <Input
          value={titleDraft}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          placeholder="Untitled Questionnaire"
          className="w-full"
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Visibility
        </p>
        <Select
          value={visibility}
          onValueChange={(v) => onVisibilityChange(v as 'public' | 'private')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Category
        </p>
        <Select
          value={category ?? 'none'}
          onValueChange={(v) => onCategoryChange(v === 'none' ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {CONTENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedQuestion &&
        (selectedQuestion.type === 'single_choice' ||
          selectedQuestion.type === 'multiple_choice') && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
              Answer feedback
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="show-correct-answer"
                checked={selectedQuestion.showCorrectAnswer}
                onCheckedChange={(v) => onShowCorrectAnswerChange(!!v)}
              />
              <label
                htmlFor="show-correct-answer"
                className="cursor-pointer text-sm leading-snug text-[var(--color-text-primary)]"
              >
                Show correct answer after submission
              </label>
            </div>
          </div>
        )}

      {/* Status badge — only in edit mode */}
      {questionnaire && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
            Status
          </p>
          <Badge variant="secondary">{STATUS_LABELS[questionnaire.status]}</Badge>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuizBuilderPage() {
  const navigate = useNavigate()
  // URL param is shortId (8-char) on edit routes, undefined on /quiz/new
  const { shortId } = useParams({ strict: false }) as { shortId?: string }

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDetail | null>(null)
  const [localQuestions, setLocalQuestions] = useState<Question[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [localVisibility, setLocalVisibility] = useState<'public' | 'private'>('public')
  const [localCategory, setLocalCategory] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  // Pending type change — used for confirmation dialog when switching away from choice type
  const [pendingTypeChange, setPendingTypeChange] = useState<{
    questionId: string
    type: QuestionType
  } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Block navigation only on /quiz/new when dirty
  const blocker = useBlocker({
    shouldBlockFn: () => !shortId && isDirty,
    withResolver: true,
  })

  // Load questionnaire when editing an existing one
  useEffect(() => {
    if (!shortId) return
    const sid = shortId
    api
      .get<{ questionnaire: QuestionnaireDetail }>(`/api/questionnaires/${sid}`)
      .then(({ questionnaire: q }) => {
        setQuestionnaire(q)
        setTitleDraft(q.title)
        setLocalVisibility(q.visibility)
        setLocalCategory(q.category)
        if (q.questions.length > 0) setSelectedId(q.questions[0].id)
      })
      .catch(() => {
        // Non-owner or not found — redirect to taker/view page
        navigate({ to: '/quiz/$shortId', params: { shortId: sid }, replace: true })
      })
  }, [shortId, navigate])

  // Unified questions list
  const questions = questionnaire?.questions ?? localQuestions
  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null

  // Unified visibility and category
  const visibility = questionnaire?.visibility ?? localVisibility
  const category = questionnaire?.category ?? localCategory

  // ── Min-duration saving state helper ──────────────────────────────────────

  async function withSaving<T>(fn: () => Promise<T>): Promise<T> {
    setIsSaving(true)
    const start = Date.now()
    try {
      return await fn()
    } finally {
      const elapsed = Date.now() - start
      const remaining = MIN_SAVE_MS - elapsed
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
      setIsSaving(false)
    }
  }

  // ── Questionnaire actions ──────────────────────────────────────────────────

  function patchQuestionnaire(patch: Partial<QuestionnaireDetail>) {
    if (!questionnaire) return
    setQuestionnaire({ ...questionnaire, ...patch })
  }

  async function save(patch?: Partial<QuestionnaireDetail>) {
    if (!questionnaire) return
    const payload = patch ?? { title: titleDraft }
    await withSaving(async () => {
      const { questionnaire: updated } = await api.put<{ questionnaire: QuestionnaireDetail }>(
        `/api/questionnaires/${questionnaire.shortId ?? questionnaire.id}`,
        payload
      )
      setQuestionnaire((prev) => (prev ? { ...prev, ...updated, questions: prev.questions } : prev))
    })
  }

  async function saveNew(targetStatus: 'draft' | 'published') {
    await withSaving(async () => {
      const { questionnaire: q } = await api.post<{ questionnaire: QuestionnaireDetail }>(
        '/api/questionnaires',
        {
          title: titleDraft || 'Untitled Questionnaire',
          visibility: localVisibility,
          category: localCategory,
          status: targetStatus,
        }
      )

      for (const lq of localQuestions) {
        const { question: createdQ } = await api.post<{ question: Question }>(
          `/api/questionnaires/${q.id}/questions`,
          {
            type: lq.type,
            prompt: lq.prompt,
            required: lq.required,
            showCorrectAnswer: lq.showCorrectAnswer,
            caseSensitive: lq.caseSensitive,
            acceptableAnswers:
              lq.acceptableAnswers !== null ? JSON.parse(lq.acceptableAnswers) : null,
            position: lq.position,
          }
        )
        for (const opt of lq.options) {
          await api.post(`/api/questions/${createdQ.id}/options`, {
            label: opt.label,
            isCorrect: opt.isCorrect,
          })
        }
      }

      setIsDirty(false)
      navigate({ to: '/quiz/$shortId/edit', params: { shortId: q.shortId ?? q.id } })
    })
  }

  async function handleTitleBlur() {
    if (!questionnaire) return
    if (titleDraft === questionnaire.title) return
    patchQuestionnaire({ title: titleDraft })
    save({ title: titleDraft })
  }

  async function handleVisibilityChange(v: 'public' | 'private') {
    setLocalVisibility(v)
    if (questionnaire) {
      patchQuestionnaire({ visibility: v })
      save({ visibility: v })
    }
  }

  async function handleCategoryChange(v: string | null) {
    setLocalCategory(v)
    if (questionnaire) {
      patchQuestionnaire({ category: v })
      save({ category: v })
    }
  }

  async function handleSave() {
    if (!questionnaire) {
      await saveNew('draft')
      return
    }
    save()
  }

  async function handlePublish() {
    if (!questionnaire) {
      await saveNew('published')
      return
    }
    await save({ status: 'published' })
    patchQuestionnaire({ status: 'published' })
  }

  // ── Question actions ───────────────────────────────────────────────────────

  function addQuestion() {
    if (!questionnaire) {
      const q = makeLocalQuestion(localQuestions.length)
      setLocalQuestions((prev) => [...prev, q])
      setSelectedId(q.id)
      setIsDirty(true)
      return
    }
    api
      .post<{ question: Question }>(`/api/questionnaires/${questionnaire.id}/questions`, {
        type: 'single_choice',
      })
      .then(({ question }) => {
        setQuestionnaire({ ...questionnaire, questions: [...questionnaire.questions, question] })
        setSelectedId(question.id)
      })
  }

  function deleteQuestion(questionId: string) {
    if (!questionnaire) {
      const remaining = localQuestions.filter((q) => q.id !== questionId)
      setLocalQuestions(remaining)
      if (selectedId === questionId) setSelectedId(remaining[0]?.id ?? null)
      return
    }
    const remaining = questionnaire.questions.filter((q) => q.id !== questionId)
    setQuestionnaire({ ...questionnaire, questions: remaining })
    if (selectedId === questionId) setSelectedId(remaining[0]?.id ?? null)
    api.del(`/api/questions/${questionId}`)
  }

  function updateQuestion(questionId: string, patch: Partial<Question>) {
    if (!questionnaire) {
      setLocalQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...patch } : q)))
      return
    }
    setQuestionnaire({
      ...questionnaire,
      questions: questionnaire.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    })
  }

  function saveQuestionDebounced(questionId: string, patch: Partial<Question>) {
    if (!questionnaire) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      api.put(`/api/questions/${questionId}`, patch)
    }, 600)
  }

  function handlePromptChange(questionId: string, prompt: string) {
    updateQuestion(questionId, { prompt })
    saveQuestionDebounced(questionId, { prompt })
  }

  function handleTypeChange(questionId: string, type: QuestionType) {
    const question = questions.find((q) => q.id === questionId)
    if (!question) return

    const isChoiceType = (t: QuestionType) => t === 'single_choice' || t === 'multiple_choice'
    const leavingChoiceType = isChoiceType(question.type) && !isChoiceType(type)
    const hasOptions = question.options.some((o) => o.label.trim() !== '')

    if (leavingChoiceType && hasOptions) {
      // Ask for confirmation before discarding options
      setPendingTypeChange({ questionId, type })
      return
    }

    applyTypeChange(questionId, type, leavingChoiceType)
  }

  function applyTypeChange(questionId: string, type: QuestionType, clearOptions: boolean) {
    updateQuestion(questionId, { type, ...(clearOptions ? { options: [] } : {}) })
    if (questionnaire) api.put(`/api/questions/${questionId}`, { type })
    setPendingTypeChange(null)
  }

  function handleShowCorrectAnswerChange(questionId: string, showCorrectAnswer: boolean) {
    updateQuestion(questionId, { showCorrectAnswer })
    saveQuestionDebounced(questionId, { showCorrectAnswer })
  }

  function handleCaseSensitiveChange(questionId: string, caseSensitive: boolean) {
    updateQuestion(questionId, { caseSensitive })
    saveQuestionDebounced(questionId, { caseSensitive })
  }

  function handleAcceptableAnswersChange(questionId: string, answers: string[]) {
    const acceptableAnswers = JSON.stringify(answers)
    updateQuestion(questionId, { acceptableAnswers })
    if (questionnaire) api.put(`/api/questions/${questionId}`, { acceptableAnswers: answers })
  }

  // ── Drag to reorder ────────────────────────────────────────────────────────

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(index: number) {
    setDragOverIndex(index)
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const qs = [...questions]
    const [moved] = qs.splice(dragIndex, 1)
    qs.splice(dropIndex, 0, moved)

    if (questionnaire) {
      setQuestionnaire({ ...questionnaire, questions: qs })
      api.put(`/api/questionnaires/${questionnaire.id}/questions/reorder`, {
        order: qs.map((q) => q.id),
      })
    } else {
      setLocalQuestions(qs)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // ── Option actions ─────────────────────────────────────────────────────────

  function addOption(questionId: string) {
    if (!questionnaire) {
      const position = questions.find((q) => q.id === questionId)?.options.length ?? 0
      const newOpt: QuestionOption = {
        id: nanoid(),
        questionId,
        label: '',
        position,
        isCorrect: false,
      }
      setLocalQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, options: [...q.options, newOpt] } : q))
      )
      return
    }
    api
      .post<{ option: QuestionOption }>(`/api/questions/${questionId}/options`, {})
      .then(({ option }) => {
        setQuestionnaire({
          ...questionnaire,
          questions: questionnaire.questions.map((q) =>
            q.id === questionId ? { ...q, options: [...q.options, option] } : q
          ),
        })
      })
  }

  function handleOptionChange(
    questionId: string,
    optionId: string,
    patch: Partial<QuestionOption>
  ) {
    if (!questionnaire) {
      setLocalQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
            : q
        )
      )
      return
    }
    setQuestionnaire({
      ...questionnaire,
      questions: questionnaire.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
          : q
      ),
    })
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      api.put(`/api/question-options/${optionId}`, patch)
    }, 500)
  }

  function deleteOption(questionId: string, optionId: string) {
    if (!questionnaire) {
      setLocalQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, options: q.options.filter((o) => o.id !== optionId) } : q
        )
      )
      return
    }
    setQuestionnaire({
      ...questionnaire,
      questions: questionnaire.questions.map((q) =>
        q.id === questionId ? { ...q, options: q.options.filter((o) => o.id !== optionId) } : q
      ),
    })
    api.del(`/api/question-options/${optionId}`)
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (shortId && !questionnaire) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Back to home"
          title="Back to home"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          {questionnaire?.status !== 'published' && (
            <Button size="sm" onClick={handlePublish} disabled={isSaving}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — question list */}
        <div className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {questions.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--color-text-disabled)]">
                No questions yet
              </p>
            )}
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                isActive={q.id === selectedId}
                isDragOver={dragOverIndex === i}
                onSelect={() => setSelectedId(q.id)}
                onDelete={() => deleteQuestion(q.id)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
          <div className="shrink-0 border-t border-[var(--color-border)] p-3">
            <Button size="sm" className="w-full" onClick={addQuestion}>
              <Plus size={14} className="mr-1" />
              Add question
            </Button>
          </div>
        </div>

        {/* Center — question editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedQuestion ? (
            <QuestionEditor
              key={selectedQuestion.id}
              question={selectedQuestion}
              onPromptChange={(prompt) => handlePromptChange(selectedQuestion.id, prompt)}
              onTypeChange={(type) => handleTypeChange(selectedQuestion.id, type)}
              onCaseSensitiveChange={(v) => handleCaseSensitiveChange(selectedQuestion.id, v)}
              onAcceptableAnswersChange={(answers) =>
                handleAcceptableAnswersChange(selectedQuestion.id, answers)
              }
              onOptionAdd={() => addOption(selectedQuestion.id)}
              onOptionChange={(optId, patch) =>
                handleOptionChange(selectedQuestion.id, optId, patch)
              }
              onOptionDelete={(optId) => deleteOption(selectedQuestion.id, optId)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-[var(--color-text-secondary)]">Add a question to get started.</p>
            </div>
          )}
        </div>

        {/* Right panel — settings */}
        <SettingsRail
          questionnaire={questionnaire}
          selectedQuestion={selectedQuestion}
          titleDraft={titleDraft}
          visibility={visibility}
          category={category}
          onTitleChange={(v) => {
            setTitleDraft(v)
            if (!shortId) setIsDirty(true)
          }}
          onTitleBlur={handleTitleBlur}
          onVisibilityChange={handleVisibilityChange}
          onCategoryChange={handleCategoryChange}
          onShowCorrectAnswerChange={(v) =>
            selectedQuestion ? handleShowCorrectAnswerChange(selectedQuestion.id, v) : undefined
          }
        />
      </div>

      {/* Navigate-away guard dialog */}
      {blocker.status === 'blocked' && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved questionnaire</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Save as a draft or discard?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>Cancel</AlertDialogCancel>
              <AlertDialogCancel
                onClick={async () => {
                  await saveNew('draft')
                  blocker.proceed()
                }}
              >
                Save as draft
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => blocker.proceed()}>Discard</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Question type switch confirmation */}
      {pendingTypeChange &&
        (() => {
          const isChoiceType = (t: QuestionType) => t === 'single_choice' || t === 'multiple_choice'
          const leavingChoiceType = !isChoiceType(pendingTypeChange.type)
          return (
            <AlertDialog open>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Switch question type?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Switching to {TYPE_LABELS[pendingTypeChange.type].toLowerCase()} answer will
                    remove your existing answer options.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPendingTypeChange(null)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      applyTypeChange(
                        pendingTypeChange.questionId,
                        pendingTypeChange.type,
                        leavingChoiceType
                      )
                    }
                  >
                    Switch
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        })()}
    </div>
  )
}
