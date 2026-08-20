import { useState }        from 'react'
import { Clock }           from 'lucide-react'
import { useAssessment }   from '@/hooks/useAssessment'
import { useMyAssessments } from '@/hooks/useMyAssessments'
import { SECTIONS } from '@/lib/assessmentQuestions'
import { CONFIDENCE_ITEMS, CONFIDENCE_SCALE } from '@/lib/confidenceItems'
import { SUS_ITEMS, SUS_SCALE }               from '@/lib/susItems'
import { MyResultsSummary } from '@/components/assessment/MyResultsSummary'

// Determine which section a question belongs to
function getSection(questionId) {
  if (questionId <= 10)  return 'web'
  if (questionId <= 23)  return 'container'
  return 'cloud'
}

const SECTION_LABELS = {
  web:       'Web security (1–10)',
  container: 'Container security (11–23)',
  cloud:     'Cloud security (24–33)',
}

const PHASE_LABELS = {
  knowledge:  'Knowledge assessment',
  confidence: 'Confidence self-assessment',
  sus:        'Usability survey (SUS)',
}

// Which section are we currently in
function currentSection(questionId) {
  return getSection(questionId)
}

// Shared 1–5 Likert row used by both the confidence and SUS steps.
function LikertRow({ text, scale, value, onChange, disabled }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-text-1 text-sm font-medium leading-snug mb-4">{text}</p>
      <div className="flex items-center justify-between gap-2">
        {scale.map(opt => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border
                          text-center transition-all
                          ${isSelected
                            ? 'border-accent bg-accent/10 text-text-1'
                            : 'border-border bg-surface-2 text-text-3 hover:border-border-2 hover:text-text-2'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center
                                 text-xs font-mono transition-all
                                 ${isSelected ? 'border-accent bg-accent text-white' : 'border-border-2'}`}>
                {opt.value}
              </span>
              <span className="text-[10px] leading-tight max-w-[64px]">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepHeader({ phaseIndex, totalPhases, phase, timerFormatted, timerUrgent, timeUp }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-text-2 text-sm">
        <span className="text-accent">Step {phaseIndex + 1} of {totalPhases}</span>
        {' · '}{PHASE_LABELS[phase]}
      </p>
      <div className={`flex items-center gap-1.5 font-mono text-sm
                        ${timerUrgent ? 'text-danger' : 'text-text-2'}`}>
        <Clock size={14} />
        {timerFormatted}
        {timeUp && <span className="text-danger text-xs ml-1">Time up!</span>}
      </div>
    </div>
  )
}

export function Assessment() {
  const [type, setType] = useState(null)   // 'pre' | 'post' | null

  // Own canonical pre/post results — powers the "Your results" summary on
  // the type-selection screen below. Fetched unconditionally (not just when
  // !type) so it's ready the moment the user lands back here after
  // submitting, and refetched (via invalidation, see useAssessment's
  // submit) so a fresh submission shows up immediately.
  const { data: myAssessments, isLoading: loadingMine } = useMyAssessments()
  const myPre  = myAssessments?.assessments?.find(a => a.type === 'pre')
  const myPost = myAssessments?.assessments?.find(a => a.type === 'post')

  const assessment = useAssessment(type || 'pre')
  const {
    phase, phaseIndex, totalPhases, isFirstPhase, isLastPhase, canSubmit,
    goNextPhase, goPrevPhase,
    questionBank, currentQ, currentIndex, totalQ, answers,
    isFirstQuestion, isLastQuestion, answeredCount,
    selectAnswer, goNext, goPrev, goTo,
    confidenceRatings, setConfidenceRating, confidenceComplete,
    susResponses, setSusRating, susComplete,
    submitted, results,
    timerFormatted, timerUrgent, timeUp,
    submit, isSubmitting, submitError,
  } = assessment

  // Type selection screen
  if (!type) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="text-center">
          <h1 className="text-text-1 text-2xl font-semibold mb-2">
            Skill Assessment
          </h1>
          <p className="text-text-2 text-sm max-w-md">
            A 33-question knowledge test, a short confidence self-assessment, and
            — after your session — a usability survey. Time limit: 15 minutes.
            Select the assessment type to begin.
          </p>
        </div>
        <div className="flex gap-4">
          {[
            { id:'pre',  label:'Pre-session assessment',  sub:'Knowledge + confidence — before using ChainBreak' },
            { id:'post', label:'Post-session assessment', sub:'Knowledge + confidence + usability — after completing challenges' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className="w-60 p-5 bg-surface border border-border rounded-xl
                         text-left hover:border-accent hover:bg-accent/5
                         transition-all group"
            >
              <p className="text-text-1 font-medium mb-1 group-hover:text-accent">
                {t.label}
              </p>
              <p className="text-text-3 text-xs">{t.sub}</p>
            </button>
          ))}
        </div>

        <MyResultsSummary pre={myPre} post={myPost} isLoading={loadingMine} />
      </div>
    )
  }

  // Results screen
  if (submitted && results) {
    const { scores, confidence, sus } = results
    const confidenceAvg = confidence?.length
      ? (confidence.reduce((sum, r) => sum + r.rating, 0) / confidence.length)
      : null

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎯</div>
          <h1 className="text-text-1 text-2xl font-semibold mb-1">
            Assessment complete
          </h1>
          <p className="text-text-2 text-sm">
            {type === 'pre' ? 'Pre-session' : 'Post-session'} results
          </p>
        </div>

        <p className="text-text-3 text-xs font-medium uppercase tracking-wide mb-2">Knowledge</p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label:'Web security',       score: scores.web,       color:'text-layer-web',       max:10 },
            { label:'Container security', score: scores.container, color:'text-layer-container', max:13 },
            { label:'Cloud security',     score: scores.cloud,     color:'text-layer-cloud',     max:10 },
          ].map(s => (
            <div key={s.label} className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-text-2 text-xs mb-2">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>
                {s.score}
                <span className="text-text-3 text-base font-normal">/{s.max}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 text-center mb-6">
          <p className="text-text-2 text-sm">Total score</p>
          <p className="text-text-1 text-4xl font-bold mt-1">
            {scores.total}
            <span className="text-text-3 text-xl font-normal">/33</span>
          </p>
          <p className="text-text-3 text-xs mt-1">
            {Math.round((scores.total / 33) * 100)}% correct
          </p>
        </div>

        <div className={`grid ${sus ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mb-6`}>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-text-2 text-xs mb-2">Confidence (avg. of 5)</p>
            <p className="text-text-1 text-3xl font-bold">
              {confidenceAvg?.toFixed(1)}
              <span className="text-text-3 text-base font-normal">/5</span>
            </p>
          </div>
          {sus && (
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-text-2 text-xs mb-2">SUS score</p>
              <p className="text-text-1 text-3xl font-bold">
                {sus.score}
                <span className="text-text-3 text-base font-normal">/100</span>
              </p>
            </div>
          )}
        </div>

        <p className="text-text-3 text-xs text-center mt-4">
          Results saved. Your scores are used for research analysis only.
        </p>
      </div>
    )
  }

  // ── Confidence step ────────────────────────────────────────────────────
  if (phase === 'confidence') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <StepHeader phaseIndex={phaseIndex} totalPhases={totalPhases} phase={phase}
                    timerFormatted={timerFormatted} timerUrgent={timerUrgent} timeUp={timeUp} />
        <p className="text-text-2 text-sm mb-5">
          Rate how much you agree with each statement.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {CONFIDENCE_ITEMS.map(item => (
            <LikertRow
              key={item.id}
              text={item.text}
              scale={CONFIDENCE_SCALE}
              value={confidenceRatings[item.id]}
              onChange={(v) => setConfidenceRating(item.id, v)}
              disabled={timeUp}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={goPrevPhase}
            disabled={isFirstPhase}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-2
                       border border-border rounded-lg hover:text-text-1
                       hover:border-border-2 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          {isLastPhase ? (
            <button
              onClick={() => submit()}
              disabled={!canSubmit || isSubmitting || timeUp}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                         bg-accent text-white rounded-lg hover:bg-accent/90
                         transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit assessment →'}
            </button>
          ) : (
            <button
              onClick={goNextPhase}
              disabled={!confidenceComplete || timeUp}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                         bg-accent text-white rounded-lg hover:bg-accent/90
                         transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Continue to usability survey →
            </button>
          )}
        </div>

        {!confidenceComplete && (
          <p className="text-text-3 text-xs text-center mt-3">
            Rate all 5 statements to continue.
          </p>
        )}
        {submitError && (
          <p className="text-danger text-sm text-center mt-2">{submitError.message}</p>
        )}
      </div>
    )
  }

  // ── SUS step (post only) ───────────────────────────────────────────────
  if (phase === 'sus') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <StepHeader phaseIndex={phaseIndex} totalPhases={totalPhases} phase={phase}
                    timerFormatted={timerFormatted} timerUrgent={timerUrgent} timeUp={timeUp} />
        <p className="text-text-2 text-sm mb-5">
          Finally, rate your experience using the ChainBreak platform itself.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {SUS_ITEMS.map(item => (
            <LikertRow
              key={item.id}
              text={item.text}
              scale={SUS_SCALE}
              value={susResponses[item.id]}
              onChange={(v) => setSusRating(item.id, v)}
              disabled={timeUp}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={goPrevPhase}
            disabled={isFirstPhase}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-2
                       border border-border rounded-lg hover:text-text-1
                       hover:border-border-2 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          <button
            onClick={() => submit()}
            disabled={!canSubmit || isSubmitting || timeUp}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                       bg-accent text-white rounded-lg hover:bg-accent/90
                       transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit assessment →'}
          </button>
        </div>

        {!susComplete && (
          <p className="text-text-3 text-xs text-center mt-3">
            Rate all 10 statements to submit.
          </p>
        )}
        {submitError && (
          <p className="text-danger text-sm text-center mt-2">{submitError.message}</p>
        )}
      </div>
    )
  }

  // ── Knowledge step (existing 33-question flow) ──────────────────────────
  const section     = currentSection(currentQ.id)
  const progress    = ((currentIndex + 1) / totalQ) * 100
  const selectedAns = answers[currentQ.id]

  return (
    <div className="max-w-2xl mx-auto p-6">

      <StepHeader phaseIndex={phaseIndex} totalPhases={totalPhases} phase={phase}
                  timerFormatted={timerFormatted} timerUrgent={timerUrgent} timeUp={timeUp} />

      {/* Question count within the knowledge step */}
      <p className="text-text-2 text-sm mb-2">
        <span className="text-accent">{SECTION_LABELS[section]}</span>
        {' · '}Question {currentIndex + 1} of {totalQ}
      </p>

      {/* Progress bar */}
      <div className="w-full h-1 bg-surface-2 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Section pills */}
      <div className="flex items-center gap-2 mb-6">
        {SECTIONS.map(s => (
          <span
            key={s.id}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full
                        text-xs border transition-colors
                        ${section === s.id
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-transparent text-text-3'
                        }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full
                              ${section === s.id ? 'bg-accent' : 'bg-text-3'}`} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Question card */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-4">
        <p className="text-text-3 text-xs font-mono mb-2">
          Q{String(currentQ.id).padStart(2,'0')}
        </p>
        <p className="text-text-1 text-lg font-medium leading-snug mb-5">
          {currentQ.text}
        </p>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {currentQ.options.map(opt => {
            const isSelected = selectedAns === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => selectAnswer(currentQ.id, opt.id)}
                disabled={timeUp}
                className={`flex items-center gap-3 p-3 rounded-lg border
                            text-left text-sm transition-all
                            ${isSelected
                              ? 'border-accent bg-accent/10 text-text-1'
                              : 'border-border bg-surface-2 text-text-2 hover:border-border-2 hover:text-text-1'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {/* Radio circle */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center
                                  justify-center flex-shrink-0 transition-all
                                  ${isSelected
                                    ? 'border-accent bg-accent'
                                    : 'border-border-2'
                                  }`}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>

                {/* Letter badge */}
                <span className={`w-5 h-5 rounded text-[10px] font-mono
                                   flex items-center justify-center flex-shrink-0
                                   ${isSelected ? 'bg-accent text-white' : 'bg-surface text-text-3'}`}>
                  {opt.id}
                </span>

                <span className="flex-1">{opt.text}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation row */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={isFirstQuestion}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-2
                     border border-border rounded-lg hover:text-text-1
                     hover:border-border-2 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        {/* Dot navigator — blue=current, green=answered, grey=unanswered */}
        <div className="flex items-center gap-1 flex-wrap
                        max-w-[240px] justify-center">
          {questionBank.map((q, i) => (
            <button
              key={q.id}
              onClick={() => goTo(i)}
              title={`Question ${q.id}`}
              className="w-2 h-2 rounded-full transition-all
                         hover:scale-125 focus:outline-none"
              style={{
                background: i === currentIndex ? '#388BFD'
                          : answers[q.id]     ? '#2EA043'
                          : '#30363D',
              }}
            />
          ))}
        </div>

        {isLastQuestion ? (
          <button
            onClick={goNextPhase}
            disabled={timeUp}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                       bg-accent text-white rounded-lg hover:bg-accent/90
                       transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Continue to confidence survey →
          </button>
        ) : (
          <button
            onClick={goNext}
            disabled={timeUp}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-2
                       border border-border rounded-lg hover:text-text-1
                       hover:border-border-2 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next question →
          </button>
        )}
      </div>

      {/* Progress summary */}
      <p className="text-text-3 text-xs text-center mt-3">
        {answeredCount} of {totalQ} answered
        {answeredCount < totalQ &&
          ' · unanswered questions counted as incorrect'}
      </p>

      {submitError && (
        <p className="text-danger text-sm text-center mt-2">
          {submitError.message}
        </p>
      )}
    </div>
  )
}
