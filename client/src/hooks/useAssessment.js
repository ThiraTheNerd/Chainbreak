import { useState, useCallback, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUESTIONS, POST_QUESTIONS } from '@/lib/assessmentQuestions'
import { CONFIDENCE_ITEMS }   from '@/lib/confidenceItems'
import { SUS_ITEMS }          from '@/lib/susItems'
import api                    from '@/services/api'

// pre: knowledge -> confidence. post: knowledge -> confidence -> SUS.
const PHASES = {
  pre:  ['knowledge', 'confidence'],
  post: ['knowledge', 'confidence', 'sus'],
}

export function useAssessment(type = 'pre') {
  const phases = PHASES[type] ?? PHASES.pre
  const [phaseIndex, setPhaseIndex] = useState(0)
  const phase = phases[phaseIndex]

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers]           = useState({})

  const [confidenceRatings, setConfidenceRatings] = useState({})

  const [susResponses, setSusResponses] = useState({})

  const [submitted, setSubmitted] = useState(false)
  const [results, setResults]     = useState(null)

  const startTime = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const LIMIT_SECONDS = 15 * 60

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const remaining  = Math.max(0, LIMIT_SECONDS - elapsed)
  const minutes    = Math.floor(remaining / 60)
  const seconds    = remaining % 60
  const timeUp     = remaining === 0
  const timerFormatted = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`
  const timerUrgent    = remaining < 60

  // post uses a reworded question bank (same ids/correct answers as pre)
  // so participants can't just recall answer positions from the pre-test.
  const questionBank      = type === 'post' ? POST_QUESTIONS : QUESTIONS
  const currentQ          = questionBank[currentIndex]
  const totalQ            = questionBank.length
  const isFirstQuestion  = currentIndex === 0
  const isLastQuestion   = currentIndex === totalQ - 1
  const answeredCount    = Object.keys(answers).length
  const knowledgeComplete = answeredCount === totalQ

  const selectAnswer = useCallback((questionId, optionId) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [questionId]: optionId }))
  }, [submitted])

  const goNext = useCallback(() => {
    if (currentIndex < totalQ - 1) setCurrentIndex(i => i + 1)
  }, [currentIndex, totalQ])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }, [currentIndex])

  const goTo = useCallback((index) => {
    setCurrentIndex(Math.max(0, Math.min(index, totalQ - 1)))
  }, [totalQ])

  const setConfidenceRating = useCallback((itemId, value) => {
    if (submitted) return
    setConfidenceRatings(prev => ({ ...prev, [itemId]: value }))
  }, [submitted])

  const confidenceComplete = CONFIDENCE_ITEMS.every(
    item => confidenceRatings[item.id] != null
  )

  const setSusRating = useCallback((itemId, value) => {
    if (submitted) return
    setSusResponses(prev => ({ ...prev, [itemId]: value }))
  }, [submitted])

  const susComplete = SUS_ITEMS.every(
    item => susResponses[item.id] != null
  )

  const phaseComplete = { knowledge: knowledgeComplete, confidence: confidenceComplete, sus: susComplete }[phase]
  const isFirstPhase = phaseIndex === 0
  const isLastPhase  = phaseIndex === phases.length - 1

  const goNextPhase = useCallback(() => {
    setPhaseIndex(i => Math.min(i + 1, phases.length - 1))
  }, [phases.length])

  const goPrevPhase = useCallback(() => {
    setPhaseIndex(i => Math.max(i - 1, 0))
  }, [])

  // Submit is only reachable on the last phase, and only once its own
  // required items (confidence/SUS — fixed Likert sets with no sensible
  // "unanswered = incorrect" fallback) are all answered.
  const canSubmit = isLastPhase && phaseComplete

  const queryClient = useQueryClient()
  const submitMutation = useMutation({
    mutationFn: () => api.post('/assessment', {
      type,
      answers: Object.entries(answers).map(([qId, answer]) => ({
        questionId: Number(qId), answer,
      })),
      confidence: CONFIDENCE_ITEMS.map(item => ({
        itemId: item.id, rating: confidenceRatings[item.id],
      })),
      ...(type === 'post' ? {
        sus: SUS_ITEMS.map(item => ({
          itemId: item.id, rating: susResponses[item.id],
        })),
      } : {}),
    }).then(r => r.data),
    onSuccess: (data) => {
      setSubmitted(true)
      setResults(data)
      // So the "Your results" summary on the type-selection screen (GET
      // /assessment/mine) reflects this submission without a page reload.
      queryClient.invalidateQueries({ queryKey: ['assessment', 'mine'] })
    },
  })

  return {
    // Phase state
    phase, phaseIndex, totalPhases: phases.length,
    isFirstPhase, isLastPhase, phaseComplete, canSubmit,
    goNextPhase, goPrevPhase,

    // Knowledge
    questionBank, currentQ, currentIndex, totalQ, answers,
    isFirstQuestion, isLastQuestion, answeredCount, knowledgeComplete,
    selectAnswer, goNext, goPrev, goTo,

    // Confidence
    confidenceRatings, setConfidenceRating, confidenceComplete,

    // SUS
    susResponses, setSusRating, susComplete,

    // Submission
    submitted, results,
    submit: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
    submitError:  submitMutation.error,

    // Timer
    timerFormatted, timerUrgent, timeUp, elapsed,
  }
}
