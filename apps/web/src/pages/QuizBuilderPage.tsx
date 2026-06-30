import { Badge, Button, Checkbox, Input, Textarea } from '@quiz/ui'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ChevronLeft, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Question, QuestionnaireDetail, QuestionOption, QuestionType } from '../types/content'

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  short_answer: 'Short answer',
  long_answer: 'Long answer',
}

const STATUS_LABELS = { draft: 'Draft', published: 'Published', archived: 'Archived' }

// ── Question editor ───────────────────────────────────────────────────────────

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
            onBlur={(e) => onOptionChange(opt.id, { label: e.target.value })}
            placeholder="Option text"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => onOptionDelete(opt.id)}
            className="shrink-0 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
            aria-label="Delete option"
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

function QuestionEditor({
  question,
  onPromptBlur,
  onTypeChange,
  onRequiredChange,
  onShowCorrectAnswerChange,
  onCaseSensitiveChange,
  onAcceptableAnswersChange,
  onOptionAdd,
  onOptionChange,
  onOptionDelete,
}: {
  question: Question
  onPromptBlur: (prompt: string) => void
  onTypeChange: (type: QuestionType) => void
  onRequiredChange: (required: boolean) => void
  onShowCorrectAnswerChange: (v: boolean) => void
  onCaseSensitiveChange: (v: boolean) => void
  onAcceptableAnswersChange: (answers: string[]) => void
  onOptionAdd: () => void
  onOptionChange: (id: string, patch: Partial<QuestionOption>) => void
  onOptionDelete: (id: string) => void
}) {
  const [prompt, setPrompt] = useState(question.prompt)

  useEffect(() => {
    setPrompt(question.prompt)
  }, [question.prompt])

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Question type
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-1">
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(t)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                question.type === t
                  ? 'bg-[var(--color-bg-surface)] font-medium text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Question prompt
        </p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => onPromptBlur(prompt)}
          placeholder="Enter your question"
          rows={3}
          className="w-full resize-none"
        />
      </div>

      {/* Required */}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`required-${question.id}`}
          checked={question.required}
          onCheckedChange={(v) => onRequiredChange(!!v)}
        />
        <label
          htmlFor={`required-${question.id}`}
          className="cursor-pointer text-sm text-[var(--color-text-primary)]"
        >
          Required
        </label>
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
          <div className="mt-3 flex items-center gap-2">
            <Checkbox
              id={`show-correct-${question.id}`}
              checked={question.showCorrectAnswer}
              onCheckedChange={(v) => onShowCorrectAnswerChange(!!v)}
            />
            <label
              htmlFor={`show-correct-${question.id}`}
              className="cursor-pointer text-sm text-[var(--color-text-primary)]"
            >
              Show correct answer after submission
            </label>
          </div>
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

// ── Question card (left panel) ─────────────────────────────────────────────────

function QuestionCard({
  question,
  isActive,
  index,
  onSelect,
  onDelete,
}: {
  question: Question
  isActive: boolean
  index: number
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
        isActive
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-subtle)]'
      }`}
    >
      <GripVertical
        size={16}
        className="mt-0.5 shrink-0 text-[var(--color-text-disabled)]"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-text-disabled)]">{index + 1}</span>
          <Badge variant="secondary" className="text-xs">
            {TYPE_LABELS[question.type]}
          </Badge>
        </div>
        <p className="truncate text-sm text-[var(--color-text-primary)]">
          {question.prompt || 'Untitled question'}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="shrink-0 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
        aria-label="Delete question"
      >
        <Trash2 size={14} />
      </button>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuizBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams({ strict: false }) as { id?: string }

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount: load or create
  useEffect(() => {
    if (!id) {
      api
        .post<{ questionnaire: QuestionnaireDetail }>('/api/questionnaires', {})
        .then(({ questionnaire: q }) => {
          navigate({ to: '/quiz/$id/edit', params: { id: q.id } })
        })
      return
    }
    api
      .get<{ questionnaire: QuestionnaireDetail }>(`/api/questionnaires/${id}`)
      .then(({ questionnaire: q }) => {
        setQuestionnaire(q)
        setTitleDraft(q.title)
        if (q.questions.length > 0) setSelectedId(q.questions[0].id)
      })
  }, [id, navigate])

  const selectedQuestion = questionnaire?.questions.find((q) => q.id === selectedId) ?? null

  // ── Questionnaire actions ──────────────────────────────────────────────────

  function patchQuestionnaire(patch: Partial<QuestionnaireDetail>) {
    if (!questionnaire) return
    setQuestionnaire({ ...questionnaire, ...patch })
  }

  async function save(patch?: Partial<QuestionnaireDetail>) {
    if (!questionnaire) return
    const payload = patch ?? { title: titleDraft }
    setIsSaving(true)
    try {
      const { questionnaire: updated } = await api.put<{ questionnaire: QuestionnaireDetail }>(
        `/api/questionnaires/${questionnaire.id}`,
        payload
      )
      setQuestionnaire((prev) => (prev ? { ...prev, ...updated, questions: prev.questions } : prev))
    } finally {
      setIsSaving(false)
    }
  }

  function handleTitleBlur() {
    if (!questionnaire || titleDraft === questionnaire.title) return
    patchQuestionnaire({ title: titleDraft })
    save({ title: titleDraft })
  }

  async function handlePublish() {
    await save({ status: 'published' })
    patchQuestionnaire({ status: 'published' })
  }

  // ── Question actions ───────────────────────────────────────────────────────

  async function addQuestion() {
    if (!questionnaire) return
    const { question } = await api.post<{ question: Question }>(
      `/api/questionnaires/${questionnaire.id}/questions`,
      { type: 'single_choice' }
    )
    setQuestionnaire({ ...questionnaire, questions: [...questionnaire.questions, question] })
    setSelectedId(question.id)
  }

  async function deleteQuestion(questionId: string) {
    if (!questionnaire) return
    const remaining = questionnaire.questions.filter((q) => q.id !== questionId)
    setQuestionnaire({ ...questionnaire, questions: remaining })
    if (selectedId === questionId) setSelectedId(remaining[0]?.id ?? null)
    await api.del(`/api/questions/${questionId}`)
  }

  function updateQuestionLocal(questionId: string, patch: Partial<Question>) {
    if (!questionnaire) return
    setQuestionnaire({
      ...questionnaire,
      questions: questionnaire.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    })
  }

  function saveQuestionDebounced(questionId: string, patch: Partial<Question>) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      api.put(`/api/questions/${questionId}`, patch)
    }, 500)
  }

  function handlePromptBlur(questionId: string, prompt: string) {
    updateQuestionLocal(questionId, { prompt })
    api.put(`/api/questions/${questionId}`, { prompt })
  }

  function handleTypeChange(questionId: string, type: QuestionType) {
    updateQuestionLocal(questionId, { type, options: [] })
    api.put(`/api/questions/${questionId}`, { type })
  }

  function handleRequiredChange(questionId: string, required: boolean) {
    updateQuestionLocal(questionId, { required })
    saveQuestionDebounced(questionId, { required })
  }

  function handleShowCorrectAnswerChange(questionId: string, showCorrectAnswer: boolean) {
    updateQuestionLocal(questionId, { showCorrectAnswer })
    saveQuestionDebounced(questionId, { showCorrectAnswer })
  }

  function handleCaseSensitiveChange(questionId: string, caseSensitive: boolean) {
    updateQuestionLocal(questionId, { caseSensitive })
    saveQuestionDebounced(questionId, { caseSensitive })
  }

  function handleAcceptableAnswersChange(questionId: string, answers: string[]) {
    const acceptableAnswers = JSON.stringify(answers)
    updateQuestionLocal(questionId, { acceptableAnswers })
    api.put(`/api/questions/${questionId}`, { acceptableAnswers: answers })
  }

  // ── Option actions ─────────────────────────────────────────────────────────

  async function addOption(questionId: string) {
    const { option } = await api.post<{ option: QuestionOption }>(
      `/api/questions/${questionId}/options`,
      {}
    )
    if (!questionnaire) return
    setQuestionnaire({
      ...questionnaire,
      questions: questionnaire.questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, option] } : q
      ),
    })
  }

  function handleOptionChange(
    questionId: string,
    optionId: string,
    patch: Partial<QuestionOption>
  ) {
    if (!questionnaire) return
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

  async function deleteOption(questionId: string, optionId: string) {
    if (!questionnaire) return
    setQuestionnaire({
      ...questionnaire,
      questions: questionnaire.questions.map((q) =>
        q.id === questionId ? { ...q, options: q.options.filter((o) => o.id !== optionId) } : q
      ),
    })
    await api.del(`/api/question-options/${optionId}`)
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!questionnaire) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Back to home"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div className="flex flex-1 items-center gap-2">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-disabled)] focus:underline"
            placeholder="Untitled Questionnaire"
          />
          <Badge variant="secondary">{STATUS_LABELS[questionnaire.status]}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => save()} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          {questionnaire.status !== 'published' && (
            <Button size="sm" onClick={handlePublish} disabled={isSaving}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — question list */}
        <div className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-subtle)] lg:w-72">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {questionnaire.questions.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--color-text-disabled)]">
                No questions yet
              </p>
            )}
            {questionnaire.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                isActive={q.id === selectedId}
                onSelect={() => setSelectedId(q.id)}
                onDelete={() => deleteQuestion(q.id)}
              />
            ))}
          </div>
          <div className="shrink-0 border-t border-[var(--color-border)] p-3">
            <Button variant="outline" size="sm" className="w-full" onClick={addQuestion}>
              <Plus size={14} className="mr-1" />
              Add question
            </Button>
          </div>
        </div>

        {/* Right panel — question editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedQuestion ? (
            <QuestionEditor
              key={selectedQuestion.id}
              question={selectedQuestion}
              onPromptBlur={(prompt) => handlePromptBlur(selectedQuestion.id, prompt)}
              onTypeChange={(type) => handleTypeChange(selectedQuestion.id, type)}
              onRequiredChange={(required) => handleRequiredChange(selectedQuestion.id, required)}
              onShowCorrectAnswerChange={(v) =>
                handleShowCorrectAnswerChange(selectedQuestion.id, v)
              }
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
      </div>
    </div>
  )
}
