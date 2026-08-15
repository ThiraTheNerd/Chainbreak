import { useState } from 'react'
import { Ticket, Plus, Copy, Check, Ban, XCircle } from 'lucide-react'
import { useInviteCodes, useGenerateInviteCodes, useRevokeInviteCode } from '@/hooks/useAdminInvites'
import { SectionCard } from '@/components/progress/SectionCard'

const STATUS_STYLE = {
  unused:  'text-success bg-success/10',
  used:    'text-text-2 bg-surface-2',
  revoked: 'text-danger bg-danger/10',
}


export function AdminInvites() {
  const { data: codes, isLoading, isError, error, refetch } = useInviteCodes()
  const generateMutation = useGenerateInviteCodes()
  const revokeMutation = useRevokeInviteCode()

  const [count, setCount] = useState(1)
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [justGenerated, setJustGenerated] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  function handleGenerate(e) {
    e.preventDefault()
    generateMutation.mutate(
      { count: Number(count) || 1, label: label || undefined, expiresAt: expiresAt || undefined },
      { onSuccess: (newCodes) => { setJustGenerated(newCodes); setLabel(''); setExpiresAt(''); } }
    )
  }

  async function handleCopy(code) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 1500)
    } catch {
      // Clipboard API can be denied by the browser — no crash, just no copy.
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-[1200px] mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 text-accent text-xs uppercase tracking-[0.2em] font-mono">
          <Ticket size={15} /> Invite codes
        </div>
        <h1 className="text-2xl font-semibold mt-2">Registration access control</h1>
        <p className="text-text-2 text-sm mt-1 max-w-2xl">
          ChainBreak registration requires a single-use invite code. Generate one per
          participant, hand it to them out of band, and it is burned the moment they
          register. This governs account creation only — it is separate from study
          consent, which participants complete after logging in.
        </p>
      </header>

      {isError && (
        <div className="border border-danger/40 bg-danger/10 text-danger rounded-lg p-4 flex items-center gap-3 text-sm">
          <XCircle size={18} />
          {error?.message || 'Failed to load invite codes.'}
          <button className="ml-auto underline" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      <SectionCard title="Generate codes" icon={Plus}>
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-text-2 text-xs mb-1 block">Count</label>
            <input
              type="number" min={1} max={500} value={count}
              onChange={(e) => setCount(e.target.value)}
              className="cb-input w-24"
            />
          </div>
          <div>
            <label className="text-text-2 text-xs mb-1 block">Label / reference (optional)</label>
            <input
              type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. cohort-2 batch"
              className="cb-input w-56"
            />
          </div>
          <div>
            <label className="text-text-2 text-xs mb-1 block">Expires (optional)</label>
            <input
              type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="cb-input"
            />
          </div>
          <button
            type="submit"
            disabled={generateMutation.isPending}
            className="bg-accent hover:bg-accent/90 text-white font-medium px-4 py-2
                       rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            <Plus size={15} />
            {generateMutation.isPending ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {generateMutation.isError && (
          <p className="text-danger text-sm mt-3">{generateMutation.error?.message}</p>
        )}

        {justGenerated && (
          <div className="mt-4 border border-accent/30 bg-accent/5 rounded-lg p-3">
            <p className="text-text-2 text-xs mb-2">
              New code{justGenerated.length > 1 ? 's' : ''} — copy and send to the participant now
              (this table shows codes to admins only; the app never displays a code again
              once you leave this page except in the list below):
            </p>
            <ul className="space-y-1">
              {justGenerated.map(({ code }) => (
                <li key={code} className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-text-1">{code}</span>
                  <button
                    onClick={() => handleCopy(code)}
                    className="text-text-3 hover:text-accent"
                    title="Copy code"
                  >
                    {copiedCode === code ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title="All codes" icon={Ticket}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-2 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Label</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Created</th>
                <th className="text-left p-3">Expires</th>
                <th className="text-left p-3">Used by</th>
                <th className="text-left p-3">Revoke</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan="7" className="p-6 text-center text-text-2">Loading...</td></tr>
              )}
              {!isLoading && codes?.length === 0 && (
                <tr><td colSpan="7" className="p-10 text-center text-text-2">No invite codes yet.</td></tr>
              )}
              {codes?.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                  <td className="p-3 font-mono text-text-1">{c.code}</td>
                  <td className="p-3 text-text-2">{c.label || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs uppercase font-medium ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-text-3 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                  <td className="p-3 text-text-3 text-xs">
                    {c.expires_at ? new Date(c.expires_at).toLocaleString() : '—'}
                  </td>
                  <td className="p-3 text-text-2">{c.used_by_username || '—'}</td>
                  <td className="p-3">
                    {c.status === 'unused' ? (
                      <button
                        onClick={() => revokeMutation.mutate(c.id)}
                        disabled={revokeMutation.isPending}
                        className="text-danger hover:underline text-xs flex items-center gap-1 disabled:opacity-50"
                      >
                        <Ban size={13} /> Revoke
                      </button>
                    ) : (
                      <span className="text-text-3 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
