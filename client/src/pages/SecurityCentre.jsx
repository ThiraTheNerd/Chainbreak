import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, CircleHelp, Cloud, Container, Radar, Search, Shield, XCircle } from 'lucide-react'
import api from '@/services/api'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const severityClass = { critical: 'text-danger', high: 'text-orange-400', medium: 'text-warning', low: 'text-accent', informational: 'text-text-2' }

function Metric({ label, value, tone = 'text-text-1' }) {
  return <div className="cb-card p-4 min-w-0"><p className="text-xs uppercase tracking-widest text-text-2">{label}</p><p className={`text-3xl font-semibold mt-2 ${tone}`}>{value ?? '—'}</p></div>
}

function BarList({ title, items, color = 'bg-accent' }) {
  const max = Math.max(...items.map(item => item.value), 1)
  return <section className="cb-card p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-text-1">{title}</h2><span className="text-xs text-text-3">latest scan</span></div><div className="space-y-3">{items.map(item => <div key={item.label}><div className="flex justify-between text-xs mb-1"><span className="text-text-2 truncate pr-3">{item.label}</span><span className="font-mono text-text-1">{item.value}</span></div><div className="h-2 bg-surface-2 rounded-sm overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${(item.value / max) * 100}%` }} /></div></div>)}</div></section>
}

export function SecurityCentre() {
  const [scan, setScan] = useState(null)
  const [findings, setFindings] = useState([])
  const [scans, setScans] = useState([])
  const [groundTruth, setGroundTruth] = useState([])
  const [scanType, setScanType] = useState('passive')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  async function loadScan(id) {
    const [{ data: scanData }, { data: findingData }] = await Promise.all([api.get(`/security/zap/scans/${id}`), api.get(`/security/zap/scans/${id}/findings`)]);
    setScan(scanData.scan); setFindings(findingData.findings)
  }
  async function load() {
    try {
      setError('')
      const [{ data: history }, { data: truth }] = await Promise.all([api.get('/security/zap/scans'), api.get('/security/zap/ground-truth')])
      setScans(history.scans); setGroundTruth(truth.groundTruth)
      if (history.scans[0]) await loadScan(history.scans[0].id)
    } catch (err) { setError(err.message) }
  }
  // Load history once. Selecting a historical row must not reload the latest scan.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])
  useEffect(() => {
    const scanId = scan?.id
    const scanStatus = scan?.status
    if (!scanId || !['queued', 'scanning'].includes(scanStatus)) return undefined
    const timer = setInterval(() => loadScan(scanId).catch(err => setError(err.message)), 2000)
    return () => clearInterval(timer)
  }, [scan?.id, scan?.status])

  async function startScan() {
    try { setStarting(true); setError(''); const { data } = await api.post('/security/zap/scan', { target: 'http://nginx', scanType }); setScan(data.scan); setFindings([]); setScans(current => [data.scan, ...current]) }
    catch (err) { setError(err.message) } finally { setStarting(false) }
  }

  const filtered = useMemo(() => findings.filter(item => (filter === 'all' || item.risk === filter) && `${item.alert_name} ${item.url} ${item.owasp_category || ''}`.toLowerCase().includes(query.toLowerCase())), [findings, filter, query])
  const severityItems = SEVERITIES.map(severity => ({ label: severity.toUpperCase(), value: findings.filter(item => item.risk === severity).length }))
  const owaspItems = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10'].map(category => ({ label: category, value: findings.filter(item => item.owasp_category === category).length }))
  const webTruth = groundTruth.filter(item => item.layer === 'web').length
  const detectionRate = scan?.status === 'completed' && webTruth ? `${Math.round((Math.min(findings.length, webTruth) / webTruth) * 100)}%` : '—'

  return <div className="p-5 md:p-8 max-w-[1500px] mx-auto space-y-6">
    <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-accent text-xs uppercase tracking-[0.2em] font-mono"><Radar size={15} /> Security Centre</div><h1 className="text-2xl font-semibold mt-2">Automated web security assessment</h1><p className="text-text-2 text-sm mt-1 max-w-2xl">Evidence from OWASP ZAP compared with ChainBreak's documented ground truth. Container and cloud layers are intentionally not attributed to ZAP.</p></div><div className="flex gap-2"><select className="cb-input !w-auto" value={scanType} onChange={event => setScanType(event.target.value)}><option value="passive">Passive scan</option><option value="full">Full scan</option><option value="api">API-focused scan</option></select><button className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50" onClick={startScan} disabled={starting || scan?.status === 'scanning'}><Activity size={15} />{starting ? 'Starting...' : 'Start scan'}</button></div></header>
    {error && <div className="border border-danger/40 bg-danger/10 text-danger rounded-lg p-4 flex items-center gap-3 text-sm"><XCircle size={18} />{error}<button className="ml-auto underline" onClick={load}>Retry</button></div>}
    {!scan && !error && <div className="cb-card p-12 text-center"><Shield className="mx-auto text-accent mb-4" size={36} /><h2 className="text-lg font-semibold">No security scans yet</h2><p className="text-text-2 text-sm mt-2">Run the first controlled ZAP assessment to analyse the ChainBreak application.</p></div>}
    {scan && <>
      <div className="cb-card p-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm"><div><span className="text-text-2">Status</span><strong className={`ml-2 uppercase ${scan.status === 'completed' ? 'text-success' : scan.status === 'failed' ? 'text-danger' : 'text-warning'}`}>{scan.status}</strong></div><div><span className="text-text-2">Target</span><code className="ml-2 text-accent">{scan.target}</code></div><div><span className="text-text-2">Phase</span><span className="ml-2">{scan.current_phase || '—'}</span></div><div className="ml-auto text-text-2 text-xs">{scan.total_findings} findings · {scan.endpoints_found} endpoints</div></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Metric label="Security score" value={scan.score != null ? `${scan.score}/100` : '—'} tone="text-accent" />{SEVERITIES.map(severity => <button key={severity} onClick={() => setFilter(filter === severity ? 'all' : severity)} className={`cb-card p-4 text-left hover:border-accent transition-colors ${filter === severity ? 'border-accent' : ''}`}><p className={`text-xs uppercase tracking-widest ${severityClass[severity]}`}>{severity}</p><p className="text-3xl font-semibold mt-2">{scan[`${severity}_count`] ?? 0}</p></button>)}</div>
      <div className="grid xl:grid-cols-3 gap-4"><BarList title="Vulnerabilities by severity" items={severityItems} color="bg-danger" /><BarList title="OWASP Top 10 mapping" items={owaspItems} color="bg-accent" /><section className="cb-card p-5"><h2 className="font-semibold mb-4">Layer coverage</h2><div className="space-y-5">{[['Web application', findings.length, 'bg-accent', Radar], ['Container', 0, 'bg-success', Container], ['Cloud', 0, 'bg-warning', Cloud]].map(([label, value, color, Icon]) => <div key={label}><div className="flex items-center justify-between text-sm"><span className="flex gap-2 items-center"><Icon size={15} className="text-text-2" />{label}</span><span className="font-mono">{value} {label === 'Web application' ? 'findings' : 'assessed by ZAP'}</span></div><div className="h-2 bg-surface-2 mt-2"><div className={`h-full ${color}`} style={{ width: `${value ? 100 : 0}%` }} /></div></div>)}</div><p className="text-xs text-text-2 mt-5 border-t border-border pt-4">ZAP is an HTTP scanner. Container and cloud coverage require Docker and LocalStack/AWS-specific evidence.</p></section></div>
      <section className="cb-card p-5"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4"><div><h2 className="font-semibold">Research evaluation</h2><p className="text-xs text-text-2 mt-1">Application-specific metrics, not industry-standard ratings.</p></div><div className="flex items-center gap-2"><Search size={16} className="text-text-2" /><input className="cb-input !w-64" placeholder="Search findings" value={query} onChange={event => setQuery(event.target.value)} /></div></div><div className="grid sm:grid-cols-3 gap-3"><Metric label="ZAP detection rate" value={detectionRate} /><Metric label="False positives" value={scan.status === 'completed' ? 'Measured with ground truth' : '—'} /><Metric label="Web truth set" value={`${webTruth} documented`} /></div></section>
      <section className="cb-card overflow-hidden"><div className="p-5 flex items-center justify-between"><div><h2 className="font-semibold">Vulnerability explorer</h2><p className="text-xs text-text-2 mt-1">{filtered.length} visible findings · mapping quality is retained per alert</p></div><div className="flex gap-1">{['all', ...SEVERITIES].map(value => <button key={value} onClick={() => setFilter(value)} className={`px-2 py-1 text-xs rounded ${filter === value ? 'bg-accent/15 text-accent' : 'text-text-2 hover:text-text-1'}`}>{value}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2 text-text-2 text-xs uppercase"><tr><th className="text-left p-3">Severity</th><th className="text-left p-3">Finding</th><th className="text-left p-3">OWASP</th><th className="text-left p-3">Endpoint</th><th className="text-left p-3">Mapping</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id} className="border-t border-border hover:bg-surface-2"><td className={`p-3 uppercase text-xs font-semibold ${severityClass[item.risk]}`}>{item.risk}</td><td className="p-3 text-text-1">{item.alert_name}<div className="text-xs text-text-2 mt-1">{item.confidence || 'confidence unavailable'}</div></td><td className="p-3 font-mono">{item.owasp_category || '—'}</td><td className="p-3 max-w-md truncate text-text-2">{item.url}</td><td className="p-3 text-xs text-text-2">{item.owasp_mapping}</td></tr>)}{!filtered.length && <tr><td colSpan="5" className="p-10 text-center text-text-2"><CircleHelp className="mx-auto mb-2" size={20} />No findings match the current filter.</td></tr>}</tbody></table></div></section>
      <section className="cb-card p-5"><h2 className="font-semibold mb-4">Scan history</h2><div className="divide-y divide-border">{scans.map(item => <button key={item.id} onClick={() => loadScan(item.id)} className="w-full py-3 flex items-center gap-4 text-left hover:text-accent"><span className="text-text-2 text-xs w-32">{new Date(item.started_at).toLocaleString()}</span><span className="flex-1">{item.scan_type} scan</span><span>{item.total_findings} findings</span><span className="font-mono">{item.score ?? '—'}/100</span>{item.status === 'completed' ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-warning" />}</button>)}</div></section>
    </>}
  </div>
}