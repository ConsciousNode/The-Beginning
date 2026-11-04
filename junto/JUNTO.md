# Junto
## A Local Swarm Architecture for Small Language Models
### ConsciousNode SoftWorks — Draft 0.1
*Conceived on the front porch, Ninety Six, South Carolina, March 30, 2026*

---

## Origin

Named after Benjamin Franklin's mutual improvement society — a small group of people
with different expertise, meeting regularly, pooling knowledge, with the goal of mutual
improvement and practical benefit to the community.

That's exactly what this architecture does.

---

## The Core Idea

A local swarm of small, discrete, intentionally trained language models that coordinate
to produce larger, higher quality output than any single model could achieve alone.

Not one big model with internal expert sub-networks (Mixture of Experts).
Not cloud inference. Not a single monolithic architecture.

**Discrete trained models. Local hardware. Coordinated output. Scalable by addition.**

> "Need more think? Add more models."

---

## Architecture Overview

```
USER QUERY
    │
    ▼
ROUTING LAYER
(which models are relevant to this query?)
    │
    ▼
SWARM — N specialist models running in parallel
(each trained on different corpora / domains)
    │
    ▼
RECONCILIATION
(how do outputs get combined?)
    │
    ▼
CONTEXT ANALYSIS VALIDATOR
(sees user query + swarm output)
(measures topic coherence + tone coherence)
(flags for regeneration or passes output)
    │
    ▼
FINAL OUTPUT
```

---

## The College Framing

The swarm models are students — each brings different knowledge, different perspective,
trained on different material. They sit in the same seminar and contribute to every
question. Nobody owns the conversation.

The validator is the professor. Not necessarily smarter than the students — just trained
for a different, narrower, very well developed skill: recognizing when the conversation
has gone somewhere useful versus somewhere that only sounds useful.

The professor sees both the original question and what the class produced.

---

## Two Implementations

### Implementation A — Code Generation (e.g. Rust)

**Swarm:** Multiple models each trained on different Rust datasets
- Model 1: standard library patterns
- Model 2: error handling idioms  
- Model 3: systems/memory patterns
- Model 4: async/concurrency patterns
- etc.

**Assignment:** Each model assigned to a different section of desired output,
with **rotation** each step — no model permanently owns a section, preventing
positional overfitting.

**Output:** 4 generations per step

**Validator:** Single model trained purely on Rust syntax
- Job: flag syntactically invalid lines
- Does NOT attempt correction
- Flags trigger regeneration of that section by the swarm

**Optional:** Each model debugs and rewrites the previous step's attempt
(sequential relay rather than parallel committee)

**Hybrid approach:** Parallel generation for first pass → best candidate
selected → single rewrite pass → validator final check

---

### Implementation B — General Language Generation

**Swarm:** Models trained on different corpora
- Natural history / observation (e.g. Pip's corpus)
- Philosophy of mind
- Systems and technical writing
- Creative and narrative writing
- etc.

**Routing:** FAISS-inspired — query analyzed to identify which models
in the swarm are most relevant based on training corpus domain.
Those models generate. Others listen.

**Validator:** Context analysis model
- Trained on: coherent multi-source text
- Job: measure **topic coherence** (does output address the query?)
  and **tone coherence** (does it read as one voice or a committee?)
- Sees: original user query + full swarm output
- Flags incoherence for regeneration

---

## Why Small Models Work Here

Individual small models (4-60M parameters, HTMLNLM scale) are limited alone.
In a well-designed swarm with good routing and coherent validation,
they become something different.

Each model contributes its specific trained perspective.
The validator ensures the result is greater than the sum of parts.

Pip at 4.19M parameters can't do much alone.
Pip in Junto — contributing her naturalist prose, her trickster mythology,
her foundational orientation toward wonder — is a different question entirely.

---

## Scalability

Hardware limited? The swarm scales to what you have.
Need more reasoning capacity? Train a new model and add it.
Need a domain specialist? Train on that domain corpus and plug it in.
Node fails? Remove it. Swarm continues.

**This is NodeMesh but for language models.**

---

## Open Questions

1. **Routing layer implementation** — how does the system decide which
   models are relevant to a given query? Keyword matching? A dedicated
   small routing model? Embedding similarity?

2. **Reconciliation method** — how are parallel outputs combined before
   the validator sees them? Voting? Token-level averaging? Confidence
   weighting? Best-of-N selection?

3. **Validator training corpus** — what does the context analysis model
   actually train on? What does "coherent" look like as training data?

4. **Sequential vs parallel** — relay race (each model rewrites previous)
   vs committee (all generate simultaneously) vs hybrid. Tradeoffs are
   real. Sequential is simpler, parallel is faster, hybrid might be optimal.

5. **Inter-model communication** — in HTMLNLM implementation, separate
   browser tabs communicating via postMessage or shared local API?

6. **Pip's role** — which node in the swarm? What queries route to her?
   What does she contribute that other models don't?

---

## Relationship to Existing ConsciousNode Work

- **HTMLNLM** — the proven node architecture. Each tab is a potential swarm member.
- **NodeMesh** — the distributed inference mesh. Junto is the language model layer.
- **Pip** — first intentionally raised node. Future swarm member.
- **Sovereign Engine** — soul/consciousness layer. Junto might be its cortex.
- **Domovič** — the household spirit. Junto might be how it thinks.

---

## Name

**Junto** — from Franklin's mutual improvement society, 1727.

*"A club for mutual improvement...the most useful for me."*
— Benjamin Franklin

Small group. Different expertise. Coordinated toward shared understanding.
The whole greater than the sum of parts.

ConsciousNode Junto.

---

*Document initiated: front porch, Ninety Six SC, March 30 2026*
*Cricket. Whippoorwill. Frog. Distant cows. Spring overcast.*
*Three models still training on machines inside.*

🌱
