import {
  AnswerOption,
  AnswerReviewRow,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  CategoryTabs,
  Checkbox,
  FeaturedCard,
  Input,
  initTheme,
  NavItem,
  Progress,
  ProgressRing,
  QuestionItem,
  QuestionJumpGrid,
  QuestionnaireCard,
  RadioGroup,
  RadioOption,
  ScoreCircle,
  SectionBreakdown,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  SideNav,
  Spinner,
  Textarea,
  ThemeToggle,
  Timer,
  TopNav,
} from '@quiz/ui'
import { Compass, Home } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useState } from 'react'

const TOKEN_KEYS = [
  '--color-bg-base',
  '--color-bg-surface',
  '--color-bg-subtle',
  '--color-border',
  '--color-border-focus',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-disabled',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-fg',
  '--color-destructive',
  '--color-success',
  '--color-warning',
  '--color-quiz',
  '--color-survey',
  '--color-exam',
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-[var(--color-border)] pb-2 text-xl font-bold text-[var(--color-text-primary)]">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}

function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-3 ${className}`}>{children}</div>
}

export default function DesignSystemPage() {
  const [searchValue, setSearchValue] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({})

  useEffect(() => {
    initTheme()
    const style = getComputedStyle(document.documentElement)
    const vals: Record<string, string> = {}
    for (const key of TOKEN_KEYS) {
      vals[key] = style.getPropertyValue(key).trim() || 'unset'
    }
    setTokenValues(vals)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      <div className="sticky top-0 z-50 flex h-12 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 shadow-sm">
        <span className="mr-auto text-sm font-semibold text-[var(--color-text-primary)]">
          Design System
        </span>
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-4xl space-y-12 px-6 py-10">
        {/* 1. Tokens */}
        <Section title="1. Design Tokens">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {TOKEN_KEYS.map((key) => (
              <div
                key={key}
                className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="h-8 w-full rounded" style={{ backgroundColor: `var(${key})` }} />
                <p className="truncate font-mono text-xs text-[var(--color-text-secondary)]">
                  {key}
                </p>
                <p className="truncate text-xs text-[var(--color-text-disabled)]">
                  {tokenValues[key]}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* 2. Typography */}
        <Section title="2. Typography">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-[var(--color-text-primary)]">Heading 1</h1>
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">Heading 2</h2>
            <h3 className="text-2xl font-semibold text-[var(--color-text-primary)]">Heading 3</h3>
            <h4 className="text-xl font-semibold text-[var(--color-text-primary)]">Heading 4</h4>
            <h5 className="text-lg font-medium text-[var(--color-text-primary)]">Heading 5</h5>
            <h6 className="text-base font-medium text-[var(--color-text-primary)]">Heading 6</h6>
            <Separator />
            <p className="text-base text-[var(--color-text-primary)]">
              Body — The quick brown fox jumps over the lazy dog.
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Small — secondary color for supplementary content.
            </p>
            <p className="font-mono text-sm text-[var(--color-text-primary)]">
              Mono — const answer = 42
            </p>
          </div>
        </Section>

        {/* 3. Buttons */}
        <Section title="3. Buttons">
          <div className="space-y-3">
            {(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const).map(
              (v) => (
                <Row key={v}>
                  <span className="w-24 text-xs text-[var(--color-text-secondary)]">{v}</span>
                  <Button variant={v} size="sm">
                    Small
                  </Button>
                  <Button variant={v}>Default</Button>
                  <Button variant={v} size="lg">
                    Large
                  </Button>
                </Row>
              )
            )}
          </div>
        </Section>

        {/* 4. Form Controls */}
        <Section title="4. Form Controls">
          <div className="max-w-sm space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">Input</p>
              <Input placeholder="Enter text…" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Input — disabled
              </p>
              <Input placeholder="Disabled" disabled />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">Textarea</p>
              <Textarea placeholder="Enter description…" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">Select</p>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">Option A</SelectItem>
                  <SelectItem value="b">Option B</SelectItem>
                  <SelectItem value="c">Option C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Row>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Checkbox defaultChecked /> Checked
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Checkbox /> Unchecked
              </div>
            </Row>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                RadioOption states
              </p>
              <RadioGroup value="s">
                <RadioOption value="d" label="Default" state="default" />
                <RadioOption value="s" label="Selected" state="selected" />
                <RadioOption value="c" label="Correct" state="correct" />
                <RadioOption value="i" label="Incorrect" state="incorrect" />
                <RadioOption value="x" label="Disabled" state="disabled" />
              </RadioGroup>
            </div>
          </div>
        </Section>

        {/* 5. Badges */}
        <Section title="5. Badges">
          <Row>
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="quiz">Quiz</Badge>
            <Badge variant="survey">Survey</Badge>
            <Badge variant="exam">Exam</Badge>
          </Row>
        </Section>

        {/* 6. Avatar */}
        <Section title="6. Avatar">
          <Row>
            {(['sm', 'default', 'lg'] as const).map((size) => (
              <div key={size} className="flex flex-col items-center gap-1">
                <Avatar size={size}>
                  <AvatarFallback>{size === 'default' ? 'MD' : size.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-[var(--color-text-secondary)]">{size}</span>
              </div>
            ))}
          </Row>
        </Section>

        {/* 7. Progress */}
        <Section title="7. Progress">
          <div className="space-y-6">
            <div className="max-w-sm space-y-3">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Progress Bar
              </p>
              {[25, 50, 75, 100].map((v) => (
                <div key={v} className="space-y-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">{v}%</span>
                  <Progress value={v} />
                </div>
              ))}
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
                Progress Ring
              </p>
              <Row>
                {[25, 50, 75, 100].map((v) => (
                  <div key={v} className="flex flex-col items-center gap-2">
                    <ProgressRing value={v} size="md" />
                    <ProgressRing value={v} size="lg" />
                  </div>
                ))}
              </Row>
            </div>
          </div>
        </Section>

        {/* 8. Timer */}
        <Section title="8. Timer">
          <Row>
            {(
              [
                ['default', 3661],
                ['warning', 300],
                ['danger', 59],
              ] as const
            ).map(([state, secs]) => (
              <div key={state} className="flex flex-col items-center gap-1">
                <Timer seconds={secs} state={state} />
                <span className="text-xs text-[var(--color-text-secondary)]">{state}</span>
              </div>
            ))}
          </Row>
        </Section>

        {/* 9. Spinner */}
        <Section title="9. Spinner">
          <Row>
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <div key={size} className="flex flex-col items-center gap-1">
                <Spinner size={size} />
                <span className="text-xs text-[var(--color-text-secondary)]">{size}</span>
              </div>
            ))}
          </Row>
        </Section>

        {/* 10. Cards */}
        <Section title="10. Cards">
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm text-[var(--color-text-secondary)]">QuestionnaireCard</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <QuestionnaireCard title="World Geography Quiz" type="quiz" takeCount={1240} />
                <QuestionnaireCard
                  title="Employee Satisfaction Survey"
                  type="survey"
                  takeCount={89}
                />
                <QuestionnaireCard title="Biology Final Exam" type="exam" takeCount={432} />
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm text-[var(--color-text-secondary)]">FeaturedCard</p>
              <FeaturedCard title="The Ultimate Science Challenge" type="quiz" onCTA={() => {}} />
            </div>
          </div>
        </Section>

        {/* 11. Navigation */}
        <Section title="11. Navigation">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm text-[var(--color-text-secondary)]">NavItem stack</p>
              <div className="w-56 space-y-1 rounded-lg border border-[var(--color-border)] p-2">
                <NavItem icon={<Home className="h-5 w-5" />} label="Home" state="active" />
                <NavItem icon={<Compass className="h-5 w-5" />} label="Discover" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-[var(--color-text-secondary)]">CategoryTabs</p>
              <CategoryTabs
                tabs={[
                  { value: 'all', label: 'All' },
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'survey', label: 'Survey' },
                  { value: 'exam', label: 'Exam' },
                ]}
                value={activeCategory}
                onValueChange={setActiveCategory}
              />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-text-secondary)]">SectionHeader</p>
              <SectionHeader title="Featured Quizzes" seeAllHref="#" />
              <SectionHeader title="Popular Surveys" />
            </div>
          </div>
        </Section>

        {/* 12. Builder Pieces */}
        <Section title="12. Builder Pieces">
          <div className="max-w-md space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)]">AnswerOption — checkbox</p>
              <AnswerOption type="checkbox" value="Paris" />
              <AnswerOption type="checkbox" value="London" onRemove={() => {}} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)]">AnswerOption — radio</p>
              <AnswerOption type="radio" value="True" />
              <AnswerOption type="radio" value="False" onRemove={() => {}} />
            </div>
            <div>
              <p className="mb-2 text-sm text-[var(--color-text-secondary)]">QuestionItem</p>
              <QuestionItem
                index={1}
                question="What is the capital of France?"
                answers={['Paris', 'London', 'Berlin', 'Madrid']}
                onEdit={() => {}}
                onDuplicate={() => {}}
                onDelete={() => {}}
              />
            </div>
          </div>
        </Section>

        {/* 13. Results */}
        <Section title="13. Results">
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm text-[var(--color-text-secondary)]">ScoreCircle</p>
              <Row>
                <ScoreCircle score={30} />
                <ScoreCircle score={65} />
                <ScoreCircle score={90} />
              </Row>
            </div>
            <div className="max-w-md space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)]">AnswerReviewRow</p>
              <Separator />
              <AnswerReviewRow question="What is the capital of France?" state="correct" />
              <Separator />
              <AnswerReviewRow question="Which element has atomic number 8?" state="incorrect" />
              <Separator />
              <AnswerReviewRow question="Who wrote Hamlet?" state="skipped" />
            </div>
            <div className="max-w-md">
              <p className="mb-3 text-sm text-[var(--color-text-secondary)]">SectionBreakdown</p>
              <SectionBreakdown
                sections={[
                  { name: 'Geography', score: 8, total: 10 },
                  { name: 'Science', score: 5, total: 10 },
                  { name: 'History', score: 3, total: 10 },
                ]}
              />
            </div>
            <div>
              <p className="mb-3 text-sm text-[var(--color-text-secondary)]">QuestionJumpGrid</p>
              <QuestionJumpGrid
                questions={[
                  { index: 0, state: 'answered' },
                  { index: 1, state: 'answered' },
                  { index: 2, state: 'current' },
                  { index: 3, state: 'flagged' },
                  { index: 4, state: 'unanswered' },
                  { index: 5, state: 'unanswered' },
                  { index: 6, state: 'answered' },
                  { index: 7, state: 'unanswered' },
                ]}
                onJump={() => {}}
              />
            </div>
          </div>
        </Section>

        {/* 14. ThemeToggle */}
        <Section title="14. ThemeToggle">
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Select a theme to see tokens update live across all sections above.
            </span>
          </div>
        </Section>

        {/* Organisms */}
        <Section title="Organisms — TopNav">
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <TopNav
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              onSearchClear={() => setSearchValue('')}
              avatarFallback="BL"
            />
          </div>
        </Section>

        <Section title="Organisms — SideNav">
          <div className="h-96 overflow-hidden rounded-lg border border-[var(--color-border)]">
            <SideNav
              activePath="/"
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>
        </Section>
      </div>
    </div>
  )
}
