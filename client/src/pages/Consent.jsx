import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Link2Off, ShieldOff, LogOut, Info, FileText, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useConsentStatus, useSubmitConsent } from '@/hooks/useConsent'
import {
  CONSENT_VERSION, SUMMARY_TEXT, PIS_LINK_URL, CONSENT_ITEMS, AUDIO_CHOICES,
} from '@/lib/consentContent'

const TODAY = new Date().toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
})

export function Consent() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { data: status, isLoading } = useConsentStatus()

  if (isLoading) return <PageLoadingScreen />

 
  if (status?.exempt || status?.completed) {
    return <Navigate to="/dashboard" replace />
  }

  if (status?.withdrawn) {
    return <WithdrawnScreen onLogout={logout} navigate={navigate} />
  }

  return <ConsentForm onLogout={logout} navigate={navigate} />
}

function PageShell({ children }) {
  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center py-10 px-4"
      style={{
        backgroundImage: 'radial-gradient(circle, #30363D 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 bg-surface rounded-lg flex items-center
                        justify-center border border-border">
          <Link2Off size={20} className="text-accent" />
        </div>
        <span className="text-2xl font-semibold tracking-tight">
          <span className="text-text-1">Chain</span>
          <span className="text-accent">Break</span>
        </span>
      </div>
      {children}
    </div>
  )
}

function PageLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function WithdrawnScreen({ onLogout, navigate }) {
  return (
    <PageShell>
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center
                        justify-center mx-auto mb-4">
          <ShieldOff size={22} className="text-danger" />
        </div>
        <h1 className="text-text-1 text-xl font-medium mb-2">Consent withdrawn</h1>
        <p className="text-text-2 text-sm leading-relaxed">
          Your consent to take part in this study has been withdrawn. Study content is
          no longer accessible on this account. Your data has been flagged for the
          research team to action exclusion, consistent with the consent form's stated
          right to withdraw. This is not reversible from here — contact the research
          team if you believe this is a mistake.
        </p>
        <button
          onClick={() => { onLogout(); navigate('/login', { replace: true }) }}
          className="mt-6 inline-flex items-center gap-2 text-text-2 hover:text-text-1
                     text-sm underline"
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </PageShell>
  )
}

function ConsentForm({ onLogout, navigate }) {
  const submitMutation = useSubmitConsent()


  const [items, setItems] = useState(
    () => Object.fromEntries(CONSENT_ITEMS.map(({ key }) => [key, false]))
  )
  const [typedName, setTypedName] = useState('')
  const [audioChoice, setAudioChoice] = useState(null)
  const [lastResult, setLastResult] = useState(null) // { consented, mode: 'submit' | 'decline' }
  const [confirmingDecline, setConfirmingDecline] = useState(false)

  const toggleItem = (key) => {
    setItems((prev) => ({ ...prev, [key]: !prev[key] }))
    setLastResult(null)
  }


  const canSubmit = typedName.trim().length > 0 && audioChoice !== null && !submitMutation.isPending

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    submitMutation.mutate(
      {
        consentVersion: CONSENT_VERSION,
        consentItems: items,
        audioRecordingConsent: audioChoice,
        typedName,
      },
      {
        onSuccess: (data) => {
          setLastResult({ ...data, mode: 'submit' })
          if (data.consented) {
            navigate('/assessment', { replace: true })
          }
        },
      }
    )
  }


  function handleDecline() {
    if (submitMutation.isPending) return
    const declineItems = Object.fromEntries(CONSENT_ITEMS.map(({ key }) => [key, false]))
    submitMutation.mutate(
      {
        consentVersion: CONSENT_VERSION,
        consentItems: declineItems,
        audioRecordingConsent: audioChoice || 'declined',
        typedName,
      },
      {
        onSuccess: (data) => {
          setItems(declineItems)
          setLastResult({ ...data, mode: 'decline' })
          setConfirmingDecline(false)
        },
      }
    )
  }

  const uncheckedItems = CONSENT_ITEMS.filter(({ key }) => !items[key])

  return (
    <PageShell>
      <div className="w-full max-w-2xl space-y-6">
        {/* 1. Plain-language orientation box */}
        <div className="bg-accent/5 border border-accent/30 rounded-xl p-5 flex gap-3">
          <Info size={18} className="text-accent flex-shrink-0 mt-0.5" />
          <p className="text-text-1 text-sm leading-relaxed">{SUMMARY_TEXT}</p>
        </div>

        {/* 2. Participant Information Sheet */}
        <div className="bg-surface border border-border rounded-xl p-8">
          <h1 className="text-text-1 text-xl font-medium mb-1">Participant Information Sheet</h1>
          <p className="text-text-3 text-xs font-mono mb-6">Consent version: {CONSENT_VERSION}</p>

          <p className="text-text-2 text-sm leading-relaxed mb-4">
            Please read the full Participant Information Sheet before continuing, it
            explains the study, what taking part involves, and your rights as a
            participant. It opens in a new tab so you don't lose your place here.
          </p>

          <a
            href={PIS_LINK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-accent/30
                       bg-accent/5 hover:bg-accent/10 transition-colors"
          >
            <FileText size={18} className="text-accent flex-shrink-0" />
            <span className="text-text-1 text-sm font-medium flex-1">
              Open the Participant Information Sheet
            </span>
            <ExternalLink size={15} className="text-accent flex-shrink-0" />
          </a>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-8">
          {/* 3. Itemised consent — individual checkboxes, none pre-ticked, no select-all */}
          <h2 className="text-text-1 text-lg font-medium mb-1">Consent</h2>
          <p className="text-text-2 text-sm mb-5">
            Please read each statement and tick only the ones you agree with.
          </p>

          <div className="space-y-3 mb-6">
            {CONSENT_ITEMS.map(({ key, text }, i) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3 rounded-lg border border-border
                           bg-surface-2 cursor-pointer hover:border-border-2"
              >
                <input
                  type="checkbox"
                  checked={items[key]}
                  onChange={() => toggleItem(key)}
                  className="mt-0.5 w-4 h-4 accent-accent flex-shrink-0"
                />
                <span className="text-text-1 text-sm leading-snug">
                  <span className="text-text-3 font-mono text-xs mr-1.5">{i + 1}.</span>
                  {text}
                </span>
              </label>
            ))}
          </div>

          {/* 4. Audio-recording choice — required single-select, not a checkbox */}
          <div className="mb-6">
            <p className="text-text-1 text-sm font-medium mb-2">Audio recording</p>
            <div className="flex flex-col gap-2">
              {AUDIO_CHOICES.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border
                             bg-surface-2 cursor-pointer hover:border-border-2"
                >
                  <input
                    type="radio"
                    name="audioChoice"
                    value={value}
                    checked={audioChoice === value}
                    onChange={() => { setAudioChoice(value); setLastResult(null) }}
                    className="w-4 h-4 accent-accent flex-shrink-0"
                  />
                  <span className="text-text-1 text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 5. Typed signature + today's date (display-only) */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <label className="text-text-1 text-sm font-medium mb-1.5 block">
                Type your full name to confirm
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => { setTypedName(e.target.value); setLastResult(null) }}
                placeholder="Full name"
                className="cb-input"
              />
            </div>
            <div>
              <span className="text-text-1 text-sm font-medium mb-1.5 block">Date</span>
              <div className="cb-input flex items-center text-text-2 bg-surface-2 cursor-default">
                {TODAY}
              </div>
            </div>
          </div>

          {lastResult?.mode === 'submit' && !lastResult.consented && (
            <div className="mb-4 bg-warning/10 border border-warning/30 rounded-lg px-3 py-3 text-sm">
              <p className="text-warning font-medium mb-1">Consent not recorded</p>
              <p className="text-text-2">
                {uncheckedItems.length > 0
                  ? 'The following item(s) still need to be ticked before consent can be recorded:'
                  : 'Something above is still incomplete.'}
              </p>
              {uncheckedItems.length > 0 && (
                <ul className="list-disc list-inside text-text-2 mt-1">
                  {uncheckedItems.map(({ key, text }) => <li key={key}>{text}</li>)}
                </ul>
              )}
              <p className="text-text-3 text-xs mt-2">
                You have not been marked as consented, and study content remains
                unavailable. You can update your selections above and submit again.
              </p>
            </div>
          )}

          {lastResult?.mode === 'decline' && (
            <div className="mb-4 bg-surface-2 border border-border rounded-lg px-3 py-3 text-sm">
              <p className="text-text-1 font-medium mb-1">Your response has been recorded</p>
              <p className="text-text-2">
                You have chosen not to take part. Study content remains unavailable on
                this account. If you change your mind, tick every item above and submit
                to take part.
              </p>
            </div>
          )}

          {submitMutation.isError && (
            <div className="mb-4 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 text-danger text-sm">
              {submitMutation.error?.message || 'Something went wrong submitting consent.'}
            </div>
          )}

          {/* 6. Submit + decline */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-accent hover:bg-accent/90 text-white font-medium
                       py-2.5 rounded-lg transition-colors disabled:opacity-60
                       disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
          </button>

          <div className="mt-4 pt-4 border-t border-border">
            {!confirmingDecline ? (
              <button
                type="button"
                onClick={() => setConfirmingDecline(true)}
                className="w-full text-center text-text-2 hover:text-danger text-sm underline"
              >
                I do not wish to take part
              </button>
            ) : (
              <div className="bg-danger/5 border border-danger/30 rounded-lg p-4 text-center">
                <p className="text-text-1 text-sm mb-3">
                  This records that you do not wish to take part in this study. You will
                  not have access to study content. Are you sure?
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setConfirmingDecline(false)}
                    className="px-4 py-1.5 rounded-lg border border-border text-text-2
                               hover:text-text-1 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={submitMutation.isPending}
                    className="px-4 py-1.5 rounded-lg bg-danger hover:bg-danger/90
                               text-white text-sm disabled:opacity-60"
                  >
                    {submitMutation.isPending ? 'Recording...' : 'Confirm — I do not wish to take part'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        <button
          onClick={() => { onLogout(); navigate('/login', { replace: true }) }}
          className="mx-auto flex items-center gap-2 text-text-3 hover:text-text-2 text-sm underline"
        >
          <LogOut size={13} /> Log out
        </button>
      </div>
    </PageShell>
  )
}
