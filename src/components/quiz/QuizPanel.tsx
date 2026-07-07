import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { NodeRow, QuizQuestion } from '@/types/db'
import { useResources } from '@/lib/queries/resources'
import { useAIConfig } from '@/lib/queries/settings'
import { useCreateQuiz, useLatestQuiz, useSubmitQuizScore } from '@/lib/queries/quizzes'
import { generateQuiz, AIError } from '@/lib/ai'

type Answer = { chosen: string; selfMarkedCorrect?: boolean }

export function QuizPanel({ node }: { node: NodeRow }) {
  const aiConfig = useAIConfig()
  const { data: resources } = useResources(node.id)
  const { data: latestQuiz } = useLatestQuiz(node.id)
  const createQuiz = useCreateQuiz(node.id)
  const submitScore = useSubmitQuizScore(node.id)

  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [quizId, setQuizId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [revealed, setRevealed] = useState(false)
  const [shortAnswerDraft, setShortAnswerDraft] = useState('')

  const configured = !!aiConfig

  const startQuiz = async () => {
    setActive(true)
    setLoading(true)
    setError(null)
    setIndex(0)
    setAnswers([])
    setRevealed(false)
    setShortAnswerDraft('')
    try {
      const parts = [`Topic: ${node.title}`]
      if (node.description) parts.push(`Description: ${node.description}`)
      if (node.notes_md) parts.push(`Notes:\n${node.notes_md}`)
      for (const r of resources ?? []) {
        const body = r.summary_md || r.raw_content?.slice(0, 800)
        if (body) parts.push(`Resource "${r.title ?? 'Untitled'}":\n${body}`)
      }
      const qs = await generateQuiz(aiConfig!, parts.join('\n\n'))
      setQuestions(qs)
      createQuiz.mutate(qs, { onSuccess: (row) => setQuizId(row.id) })
    } catch (e) {
      setError(e instanceof AIError ? e.message : 'Failed to generate a quiz.')
    } finally {
      setLoading(false)
    }
  }

  const current = questions?.[index]
  const isLast = questions ? index === questions.length - 1 : false
  const finished = questions !== null && index >= questions.length

  const recordAnswer = (answer: Answer) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = answer
      return next
    })
  }

  const goNext = () => {
    setRevealed(false)
    setShortAnswerDraft('')
    setIndex((i) => i + 1)
  }

  const handleMcqChoice = (option: string) => {
    if (revealed) return
    recordAnswer({ chosen: option })
    setRevealed(true)
  }

  const handleShortAnswerSelfMark = (correct: boolean) => {
    recordAnswer({ chosen: shortAnswerDraft, selfMarkedCorrect: correct })
  }

  const score = (() => {
    if (!questions) return 0
    const correctCount = questions.reduce((acc, q, i) => {
      const a = answers[i]
      if (!a) return acc
      if (q.options?.length) return acc + (a.chosen === q.answer ? 1 : 0)
      return acc + (a.selfMarkedCorrect ? 1 : 0)
    }, 0)
    return Math.round((correctCount / questions.length) * 100)
  })()

  const handleFinish = () => {
    if (quizId) submitScore.mutate({ id: quizId, score })
  }

  const handleClose = () => {
    setActive(false)
    setQuestions(null)
    setQuizId(null)
  }

  if (!active) {
    return (
      <div>
        <button
          onClick={startQuiz}
          disabled={!configured}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover disabled:opacity-50"
        >
          Test me{latestQuiz?.last_score != null ? ` (last: ${latestQuiz.last_score}%)` : ''}
        </button>
        {!configured && (
          <p className="mt-2 text-xs text-muted">
            Add an OpenRouter key in{' '}
            <Link to="/settings" className="text-accent hover:underline">
              Settings
            </Link>{' '}
            to generate a quiz.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-5">
        {loading && <p className="text-sm text-muted">Generating quiz…</p>}
        {error && <p className="text-sm text-error">{error}</p>}

        {!loading && !error && questions && !finished && current && (
          <div>
            <p className="mb-3 text-xs text-muted">
              Question {index + 1} of {questions.length}
            </p>
            <p className="mb-4 text-sm font-medium text-text">{current.q}</p>

            {current.options?.length ? (
              <div className="flex flex-col gap-2">
                {current.options.map((opt) => {
                  const chosen = answers[index]?.chosen === opt
                  const showCorrectness = revealed
                  const isCorrectOpt = opt === current.answer
                  return (
                    <button
                      key={opt}
                      onClick={() => handleMcqChoice(opt)}
                      className={`rounded-md border px-3 py-2 text-left text-sm ${
                        showCorrectness && isCorrectOpt
                          ? 'border-success bg-success/10 text-text'
                          : showCorrectness && chosen
                            ? 'border-error bg-error/10 text-text'
                            : 'border-border text-text hover:bg-surface-hover'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div>
                <input
                  value={shortAnswerDraft}
                  onChange={(e) => setShortAnswerDraft(e.target.value)}
                  disabled={revealed}
                  placeholder="Your answer…"
                  className="mb-2 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
                />
                {!revealed ? (
                  <button
                    onClick={() => setRevealed(true)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover"
                  >
                    Reveal answer
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShortAnswerSelfMark(true)}
                      className="rounded-md border border-success/40 px-3 py-1.5 text-xs text-success hover:bg-success/10"
                    >
                      I got it right
                    </button>
                    <button
                      onClick={() => handleShortAnswerSelfMark(false)}
                      className="rounded-md border border-error/40 px-3 py-1.5 text-xs text-error hover:bg-error/10"
                    >
                      I got it wrong
                    </button>
                  </div>
                )}
              </div>
            )}

            {revealed && (
              <div className="mt-3 rounded-md border border-border bg-surface-2 p-2 text-xs text-muted">
                <p className="mb-1 text-text">Correct answer: {current.answer}</p>
                {current.explanation && <p>{current.explanation}</p>}
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <button onClick={handleClose} className="text-xs text-muted hover:text-text">
                Quit
              </button>
              <button
                onClick={goNext}
                disabled={!revealed && !answers[index]}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-50"
              >
                {isLast ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {finished && (
          <div>
            <p className="mb-2 text-lg font-semibold text-text">Score: {score}%</p>
            <p className="mb-4 text-sm text-muted">
              {questions!.length} questions — nice work reviewing &quot;{node.title}&quot;.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  handleFinish()
                  handleClose()
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg"
              >
                Save & close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
