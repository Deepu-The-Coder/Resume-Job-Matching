# Project brief: AI Resume-to-Job Matching Engine

Use this as the starting context for an AI coding agent (Claude Code, Cursor, etc.) to help build this project from scratch.

## What I'm building, in plain words
An app where:
- A candidate uploads a resume and gets a ranked list of jobs that actually fit them (not just keyword matches — real meaning-based matching)
- A recruiter posts a job and gets a ranked list of candidates who actually fit it
- For the top matches, the app explains *why* it's a good match in plain English

It's built like a real product, not a demo — meaning it has to handle cost control, traffic spikes, and partial failures gracefully, the way a real company's backend would.

## Why I'm building it (the problem it solves)
Job seekers apply blindly because keyword search misses good matches that are worded differently. Recruiters skim hundreds of resumes with no real way to rank them by fit. This app fixes that with meaning-based matching instead of keyword matching, and explains *why* a match is good so both sides can trust the ranking.

## The core idea in simple terms (this is "AI/RAG", explained plainly)
1. Turn every resume and every job posting into a list of numbers (called an "embedding") that captures its *meaning*. This uses an existing AI API — I'm not training my own model.
2. To match, compare these number lists using math (cosine similarity) — similar meaning = similar numbers = good match. This works even if the wording is totally different (e.g. "React developer" vs "Frontend engineer, React").
3. For the best matches, send the specific overlapping/missing skills to an LLM (like GPT or Gemini) and ask it to write a short "why this matches" explanation.

Important: the *ranking* doesn't need the LLM at all — it's just math on embeddings. Only the *explanation text* needs the LLM. This matters a lot for the engineering below.

## Why it's "AI-powered" and what part isn't AI
- **AI parts**: embeddings for meaning-based matching, LLM for match explanations
- **NOT AI, just good engineering**: caching, rate limiting, load balancing, async processing, circuit breakers — this is the infrastructure that makes the AI parts affordable and reliable to run for real users. Keep these two things clearly separate when explaining the project — don't call the infrastructure "AI."

## Every feature and why it exists (simple version)

| Feature | What it does | Why I need it |
|---|---|---|
| Embeddings + similarity search | Converts resumes/jobs to numbers, compares them by meaning | This is the actual matching engine |
| LLM match explanations | Writes a plain-English reason why a match is good/bad | Makes results trustworthy, not just a mystery score |
| Semantic caching (Redis) | Saves explanations for resume+job pairs that don't change | Resumes and job posts rarely change — no reason to pay for the same LLM call twice |
| Rate limiting (Redis) | Limits how many match requests one user can make | Stops one user or bot from running up a huge AI bill |
| Circuit breaker | If the LLM API is down, skip it instead of crashing | Ranking still works with pure math even if the AI explanation feature is broken — the app degrades gracefully instead of failing completely |
| Load balancer (Nginx) | Spreads traffic across multiple copies of my server | One server can't handle real traffic alone |
| Async queue (BullMQ + Redis) | Handles big background jobs (like re-scoring everything when a new resume is added) without freezing the app | Some tasks are too big to do instantly while a user waits |
| Cost/usage dashboard | Shows how many AI calls were made, what they cost, how much caching saved | AI API calls cost real money — I need to prove I controlled that cost |
| Basic multi-tenancy | Keeps different companies' job postings and candidates separate | This is meant to work like a real SaaS product used by multiple companies |

## Tech stack (plain list)
- **Frontend**: React — two simple views, one for candidates (upload resume, see matched jobs), one for recruiters (post job, see matched candidates)
- **Backend**: Node.js + Express
- **Background jobs**: BullMQ (built on Redis)
- **Database**: MongoDB — stores resumes, jobs, and match history
- **Cache/rate-limit store**: Redis
- **AI APIs**: an embeddings API (turns text into numbers) + a chat/completion API (writes the explanation text) — e.g. OpenAI or Gemini
- **Infrastructure**: Docker + Docker Compose to run everything together (app, Redis, MongoDB, Nginx), with the app running as 2+ copies behind Nginx for load balancing
- **Testing traffic**: k6 or autocannon to simulate real load and measure performance

## How a request actually flows (plain steps)

**A candidate looking for jobs:**
1. Uploads resume → gets turned into an embedding (or pulled from cache if already done)
2. Request passes through the rate limiter
3. App compares the resume's embedding against all job embeddings → gets ranked matches instantly (just math, no AI call needed here)
4. For the top few matches, app checks cache for an explanation → if missing, sends the specific skill overlaps/gaps to the LLM → gets a short explanation → saves it to cache
5. Candidate sees ranked jobs with scores and plain-English explanations

**A recruiter looking for candidates:** same thing, just reversed (job → resumes)

**When lots of resumes/jobs are added at once:** instead of processing instantly and making the user wait, the app adds the work to a queue and processes it in the background

**If the AI explanation service is down:** the app still shows ranked matches (pure math still works), just with a simple auto-built summary instead of an LLM-written one, so nothing breaks completely

## Build order (do it in this sequence, don't skip ahead)
1. **First**: get basic matching working — upload a resume, embed it, embed a few sample jobs, rank by similarity, show results. No caching, no Docker yet.
2. **Then**: add the LLM explanation step for top matches
3. **Then**: add Redis caching for those explanations, and a rate limiter
4. **Then**: add the circuit breaker + fallback explanation logic
5. **Then**: Dockerize everything, add Nginx load balancing across 2+ app instances
6. **Then**: add the async queue for bulk re-matching/re-embedding
7. **Then**: add the cost/usage dashboard, structured logging, and multi-tenancy
8. **Last**: load test it, write a proper README with real performance numbers, deploy it somewhere live

## What "done and resume-ready" looks like
- A live demo link, not just a GitHub repo
- A README that explains the *why*, the architecture, and includes real numbers from load testing (e.g. "cache hit rate of X%, p95 latency of Yms, handled Z requests/sec before rate limiting kicked in")
- Ability to explain clearly, in an interview, which parts are AI and which parts are infrastructure, and why each engineering piece (caching, rate limiting, queue, circuit breaker) exists for a real reason, not just to check a resume buzzword box
