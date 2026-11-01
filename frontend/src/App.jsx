import { useEffect, useState } from 'react';
import { api, uploadResume } from './api.js';
import './styles.css';

function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  const retry = error.status === 429 && error.retryAfter
    ? ` Please try again in ${error.retryAfter} seconds.`
    : '';
  return <div className="alert error"><strong>Couldn’t complete that request.</strong> {error.message}.{retry}
    {onRetry && <button className="text-button" onClick={onRetry}>Retry</button>}
  </div>;
}

function Header({ selection, dark, setDark, onLogout }) {
  return <header className="topbar">
    <div className="brand"><span className="brand-mark">✦</span><span>Matchwise</span></div>
    <div className="selectors">
      <span className="muted">{selection.user.name} · {selection.role} · {selection.tenantId}</span>
      <a className="dashboard-link" href="/dashboard">Dashboard</a>
      <button className="text-button" onClick={onLogout}>Log out</button>
      <button className="theme-button" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">{dark ? '☀' : '☾'}</button>
    </div>
  </header>;
}

function DashboardView({ selection }) {
  const [range, setRange] = useState('24h');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await api.getStats(range);
        if (active) { setStats(next); setError(null); }
      } catch (err) {
        if (active) setError(err);
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [selection.tenantId, range]);
  const maxSeries = Math.max(1, ...(stats?.timeSeries || []).flatMap((point) => [point.hits, point.misses]));
  return <main className="content dashboard">
    <section className="hero"><div><p className="eyebrow">Usage dashboard</p><h1>Know what the system really costs.</h1><p className="hero-copy">Live tenant-scoped usage from persisted request and AI-call records.</p></div><div className="hero-orb">◌</div></section>
    <div className="dashboard-toolbar"><span className="muted">Tenant {selection.tenantId} · updates every 5 seconds</span><select value={range} onChange={(e) => setRange(e.target.value)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></div>
    <ErrorMessage error={error} />
    {!stats ? <Skeletons /> : <>
      <section className="metric-grid">
        <MetricCard label="Cache hit rate" value={`${Math.round(stats.cache.hitRate * 100)}%`} detail={`${stats.cache.exactHits} exact · ${stats.cache.semanticHits} semantic`} />
        <MetricCard label="Requests" value={stats.totalRequests} detail={`${stats.aiCallsMade} LLM calls`} />
        <MetricCard label="Cost saved" value={`$${stats.estimatedCostSaved.toFixed(4)}`} detail={`Spend: $${stats.totalEstimatedSpend.toFixed(4)}`} />
        <MetricCard label="P95 latency" value={`${stats.latency.p95Ms} ms`} detail={`Average: ${stats.latency.averageMs} ms`} />
      </section>
      <section className="dashboard-grid"><section className="panel"><div className="section-heading"><div><h2>Cache activity</h2><p className="muted">Persisted hits versus misses</p></div></div><div className="bar-chart">{stats.timeSeries.length ? stats.timeSeries.map((point) => <div className="bar-group" key={point.time}><div className="bars"><span className="hit-bar" style={{ height: `${(point.hits / maxSeries) * 100}%` }} title={`Hits: ${point.hits}`} /><span className="miss-bar" style={{ height: `${(point.misses / maxSeries) * 100}%` }} title={`Misses: ${point.misses}`} /></div><small>{new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>) : <EmptyState text="No cache events in this range." />}</div><div className="chart-legend"><span><i className="hit-dot" /> Hits</span><span><i className="miss-dot" /> Misses</span></div></section>
        <section className="panel"><div className="section-heading"><div><h2>Latency by source</h2><p className="muted">Measured explanation events</p></div></div><div className="source-metrics"><MetricCard label="Cache average" value={`${stats.latency.cache.averageLatencyMs} ms`} detail={`P95 ${stats.latency.cache.p95LatencyMs} ms`} /><MetricCard label="LLM average" value={`${stats.latency.llm.averageLatencyMs} ms`} detail={`P95 ${stats.latency.llm.p95LatencyMs} ms`} /></div></section></section>
      <section className="panel request-panel"><div className="section-heading"><div><h2>Recent requests</h2><p className="muted">Latest persisted match requests</p></div></div>{stats.recentRequests.length ? <div className="request-table"><div className="request-row request-header"><span>Time</span><span>Query</span><span>Source</span><span>Latency</span></div>{stats.recentRequests.map((item, index) => <div className="request-row" key={`${item.time}-${index}`}><span>{new Date(item.time).toLocaleString()}</span><span>{item.querySummary}</span><span><span className={`source ${item.source}`}>{item.source}</span></span><span>{item.latencyMs} ms</span></div>)}</div> : <EmptyState text="No requests recorded in this range." />}</section>
    </>}
  </main>;
}

function MetricCard({ label, value, detail }) {
  return <div className="metric-card"><span className="label">{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function SkillChips({ skills = [], kind }) {
  return <div className="chips">{skills.length ? skills.map((skill) => <span className={`chip ${kind}`} key={skill}>{skill}</span>) : <span className="muted">None identified</span>}</div>;
}

function MatchCard({ item, recruiter }) {
  const score = Math.max(0, Math.min(1, Number(item.similarityScore || 0)));
  const source = { llm: ['AI generated', 'ai'], cache: ['From cache', 'cache'], fallback: ['Auto summary', 'fallback'] }[item.explanationSource];
  return <article className="match-card">
    <div className="match-heading"><div><p className="eyebrow">{recruiter ? 'Candidate match' : 'Job match'}</p><h3>{recruiter ? item.originalFilename : item.title}</h3></div><strong className="score">{Math.round(score * 100)}%</strong></div>
    <div className="score-track"><span style={{ width: `${score * 100}%` }} /></div>
    {recruiter && <p className="muted">{item.userId}</p>}
    {!recruiter && <p className="muted">{item.description}</p>}
    <div className="skill-row"><div><span className="label">Matched</span><SkillChips skills={item.matchedSkills} kind="matched" /></div><div><span className="label">Missing</span><SkillChips skills={item.missingSkills} kind="missing" /></div></div>
    {item.explanation && <div className="explanation"><div className="explanation-title">Why this match {source && <span className={`source ${source[1]}`}>{source[0]}</span>}</div><p>{item.explanation}</p></div>}
  </article>;
}

function CandidateView({ selection }) {
  const [resume, setResume] = useState(null);
  const [progress, setProgress] = useState(0);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError(new Error('Please choose a PDF file')); return;
    }
    setError(null); setProgress(0);
    try {
      const result = await uploadResume(file, selection, setProgress);
      setResume(result.resume); setProgress(100);
    } catch (err) { setError(err); }
  };
  const findMatches = async () => {
    if (!resume) return;
    setLoading(true); setError(null);
    try { setMatches((await api.resumeMatches(resume._id)).matches); }
    catch (err) { setError(err); } finally { setLoading(false); }
  };
  return <main className="content">
    <section className="hero"><div><p className="eyebrow">Candidate workspace</p><h1>Find work that fits your story.</h1><p className="hero-copy">Upload your resume and let semantic matching surface opportunities beyond simple keywords.</p></div><div className="hero-orb">✦</div></section>
    <section className="panel upload-panel"><div className="section-heading"><div><h2>Resume</h2><p className="muted">PDF only · up to 5 MB</p></div>{resume && <span className="status-pill">Uploaded</span>}</div>
      <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}>
        <input id="resume-input" type="file" accept="application/pdf" onChange={(e) => handleFile(e.target.files[0])} />
        <label htmlFor="resume-input"><span className="upload-icon">↑</span><strong>Drop your resume here</strong><span className="muted">or click to browse</span></label>
      </div>
      {progress > 0 && progress < 100 && <div className="progress-wrap"><div className="progress-label"><span>Uploading and parsing…</span><span>{progress}%</span></div><div className="progress-bar"><span style={{ width: `${progress}%` }} /></div></div>}
      {resume && <div className="resume-summary"><div><strong>{resume.originalFilename}</strong><p className="muted">Parsed skills</p></div><SkillChips skills={resume.skills} kind="matched" /></div>}
      <ErrorMessage error={error} />
      <button className="primary-button" disabled={!resume || loading} onClick={findMatches}>{loading ? 'Finding matches…' : 'Find matching jobs'} <span>→</span></button>
    </section>
    <section className="results-section"><div className="section-heading"><div><p className="eyebrow">Semantic ranking</p><h2>Recommended jobs</h2></div>{matches.length > 0 && <span className="result-count">{matches.length} matches</span>}</div>
      {loading ? <Skeletons /> : matches.length ? <div className="match-grid">{matches.map((item) => <MatchCard key={item._id} item={item} />)}</div> : <EmptyState text={resume ? 'Click “Find matching jobs” to see your ranked opportunities.' : 'Upload a resume to unlock your recommendations.'} />}
    </section>
  </main>;
}

function RecruiterView({ selection }) {
  const [form, setForm] = useState({ title: '', description: '', requiredSkills: '' });
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);
  const loadJobs = async () => { try { setJobs((await api.getJobs()).jobs); } catch (err) { setError(err); } };
  useEffect(() => { loadJobs(); }, [selection.tenantId]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const create = async (e) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { await api.createJob({ ...form, requiredSkills: form.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean) }); setForm({ title: '', description: '', requiredSkills: '' }); await loadJobs(); }
    catch (err) { setError(err); } finally { setLoading(false); }
  };
  const findCandidates = async (job) => { setSelected(job); setLoading(true); setError(null); try { setMatches((await api.jobMatches(job._id)).matches); } catch (err) { setError(err); } finally { setLoading(false); } };
  const pollBulkMatch = async (jobId, index, total) => {
    const status = await api.jobStatus(jobId);
    setBulkProgress({ current: Math.round(((index + status.progress / 100) / total) * 100), status });
    if (['completed', 'failed'].includes(status.status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 700));
    return pollBulkMatch(jobId, index, total);
  };
  const uploadBulkJobs = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setBulkProgress({ current: 0, status: { status: 'reading' } });
    try {
      const entries = JSON.parse(await file.text());
      if (!Array.isArray(entries) || !entries.length) {
        throw new Error('The JSON file must contain a non-empty array of jobs');
      }
      for (const [index, entry] of entries.entries()) {
        const created = await api.createJob({
          ...entry,
        });
        const queued = await api.bulkMatch({ jobId: created.job._id });
        const status = await pollBulkMatch(queued.jobId, index, entries.length);
        if (status.status === 'failed') throw new Error(`Bulk matching failed for ${entry.title}`);
      }
      await loadJobs();
      setBulkProgress({ current: 100, status: { status: 'completed' } });
    } catch (err) {
      setError(err);
      setBulkProgress(null);
    }
  };
  return <main className="content"><section className="hero"><div><p className="eyebrow">Recruiter workspace</p><h1>Meet the people behind the potential.</h1><p className="hero-copy">Post a role, then rank your tenant’s candidates by meaning-based fit.</p></div><div className="hero-orb recruiter-orb">◎</div></section>
    <div className="two-column"><section className="panel"><div className="section-heading"><div><h2>Post a new role</h2><p className="muted">Build a clear brief for better matches.</p></div></div><form onSubmit={create} className="job-form"><label>Job title<input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Senior Product Designer" required /></label><label>Description<textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What will this person own?" required /></label><label>Required skills<input value={form.requiredSkills} onChange={(e) => update('requiredSkills', e.target.value)} placeholder="Figma, React, SQL" /></label><ErrorMessage error={error} /><button className="primary-button" disabled={loading}>{loading ? 'Saving…' : 'Publish role'} <span>→</span></button></form><div className="bulk-upload"><span className="label">Bulk upload jobs</span><p className="muted">Choose a JSON array with title, description, and requiredSkills.</p><input type="file" accept="application/json,.json" onChange={uploadBulkJobs} disabled={Boolean(bulkProgress && bulkProgress.status.status !== 'completed')} />{bulkProgress && <div className="progress-wrap"><div className="progress-label"><span>Bulk processing: {bulkProgress.status.status}</span><span>{bulkProgress.current}%</span></div><div className="progress-bar"><span style={{ width: `${bulkProgress.current}%` }} /></div></div>}</div></section>
      <section className="panel"><div className="section-heading"><div><h2>Your roles</h2><p className="muted">{jobs.length} roles in {selection.tenantId}</p></div></div>{jobs.length ? <div className="job-list">{jobs.map((job) => <button className={`job-item ${selected?._id === job._id ? 'selected' : ''}`} key={job._id} onClick={() => findCandidates(job)}><span><strong>{job.title}</strong><small>{job.requiredSkills?.join(' · ') || 'No skills listed'}</small></span><span>→</span></button>)}</div> : <EmptyState text="No roles yet. Publish your first role to start matching." />}</section></div>
    {selected && <section className="results-section"><div className="section-heading"><div><p className="eyebrow">Candidate ranking</p><h2>Best candidates for {selected.title}</h2></div></div>{loading ? <Skeletons /> : matches.length ? <div className="match-grid">{matches.map((item) => <MatchCard key={item._id} item={item} recruiter />)}</div> : <EmptyState text="No candidate matches found for this role." />}</section>}
  </main>;
}

function Skeletons() { return <div className="match-grid">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><span /><span /><span /><span /></div>)}</div>; }
function EmptyState({ text }) { return <div className="empty-state"><span>◌</span><p>{text}</p></div>; }

export default function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('matchwise_auth') || 'null'); } catch { return null; }
  });
  const [dark, setDark] = useState(false);
  if (!auth) return <AuthPanel onAuth={(result) => {
    localStorage.setItem('matchwise_token', result.token);
    localStorage.setItem('matchwise_auth', JSON.stringify(result));
    setAuth(result);
  }} />;
  const selection = {
    role: auth.user.role,
    tenantId: auth.user.tenantId,
    userId: auth.user.id,
    user: auth.user,
  };
  return <div className={`app ${dark ? 'dark' : ''}`}><Header selection={selection} dark={dark} setDark={setDark} onLogout={() => {
    localStorage.removeItem('matchwise_token');
    localStorage.removeItem('matchwise_auth');
    setAuth(null);
  }} />
    <div className="tenant-banner"><span className="live-dot" /> Authenticated <span>·</span> {selection.role === 'candidate' ? 'Candidate' : 'Recruiter'} view <span>·</span> {selection.tenantId}</div>
    {window.location.pathname === '/dashboard' ? <DashboardView selection={selection} /> : selection.role === 'candidate' ? <CandidateView selection={selection} /> : <RecruiterView selection={selection} />}
    <footer>Built for thoughtful matching <span>✦</span></footer>
  </div>;
}

function AuthPanel({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'candidate', tenantId: 'tenant-acme' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true); setError(null);
    try {
      const result = mode === 'login' ? await api.login({
        email: form.email, password: form.password, tenantId: form.tenantId,
      }) : await api.register(form);
      onAuth(result);
    } catch (err) { setError(err); } finally { setLoading(false); }
  };
  return <div className="app auth-app"><main className="auth-card panel">
    <p className="eyebrow">Matchwise</p><h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
    <p className="hero-copy">Sign in to upload your resume or discover candidates and jobs securely.</p>
    <form className="job-form" onSubmit={submit}>
      {mode === 'register' && <label>Name<input value={form.name} onChange={(e) => update('name', e.target.value)} required /></label>}
      <label>Email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
      <label>Password<input type="password" minLength="8" value={form.password} onChange={(e) => update('password', e.target.value)} required /></label>
      {mode === 'register' && <label>Role<select value={form.role} onChange={(e) => update('role', e.target.value)}><option value="candidate">Candidate</option><option value="recruiter">Recruiter</option></select></label>}
      <label>Tenant<select value={form.tenantId} onChange={(e) => update('tenantId', e.target.value)}><option value="tenant-acme">Tenant A</option><option value="tenant-globex">Tenant B</option></select></label>
      <ErrorMessage error={error} /><button className="primary-button" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
    </form>
    <button className="text-button auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
      {mode === 'login' ? 'Need an account? Register' : 'Already registered? Log in'}
    </button>
  </main></div>;
}
