// Central home for every AI prompt used in the app — tune them here.

export function autoPlacementPrompt(newTitle: string, treeSerialization: string) {
  return {
    system: `You help organize a personal knowledge graph of learning topics.
Given a new topic title and a compact list of existing topics (id: title, indented by depth),
decide where the new topic best fits.

Respond with ONLY a JSON object, no markdown fences, no commentary:
{"parent_id": "<uuid or null>", "reasoning": "<one sentence>", "suggested_path": "<breadcrumb-style string, e.g. 'Programming > Databases'>"}

Rules:
- parent_id must be an exact id from the list, or null if the topic should be a new root topic.
- Prefer the most specific reasonable parent. Do not invent ids.`,
    user: `New topic: "${newTitle}"\n\nExisting topics:\n${treeSerialization || '(none yet)'}`,
  }
}

export function summarizeNodePrompt(context: string) {
  return {
    system: `You are a study assistant. Summarize the provided material about a learning topic into
concise, well-structured Markdown (headings, bullet points where useful). Focus on the key ideas
a learner should retain. Do not invent facts not present in the material.`,
    user: context,
  }
}

export function simplifyNodePrompt(context: string) {
  return {
    system: `You are a study assistant. Rewrite the provided material as an ELI5 (explain like I'm 5)
style explanation in Markdown — simple language, short sentences, concrete analogies. Do not invent
facts not present in the material.`,
    user: context,
  }
}

export function examplesNodePrompt(context: string) {
  return {
    system: `You are a study assistant. Based on the provided material about a learning topic, produce
2-4 concrete, practical examples in Markdown that illustrate the concept in action. Do not invent
facts not present in the material — examples should illustrate it, not contradict it.`,
    user: context,
  }
}

export function detailsNodePrompt(context: string) {
  return {
    system: `You are a study assistant. Write a comprehensive, well-structured explainer in Markdown
about the learning topic below, weaving together everything in the provided context — the topic's own
notes AND any attached resources (web pages, YouTube transcripts). Merge overlapping material from the
different sources into one coherent piece rather than repeating each source separately.

Structure it with clear headings: an overview, the key concepts explained in depth, how the pieces fit
together, and (if the sources support it) practical examples or applications. Prefer the specifics from
the provided resources over generic filler. Do not invent facts that contradict the sources; you may add
widely-known foundational context to connect ideas, but keep it accurate.`,
    user: context,
  }
}

export function summarizeResourcePrompt(title: string, rawContent: string) {
  return {
    system: `You are a study assistant. Summarize the following resource ("${title}") into concise
Markdown notes — key points, structure with headings/bullets where useful. Do not invent facts not
present in the source text.`,
    user: rawContent,
  }
}

export function chunkSummaryPrompt(
  title: string,
  chunkIndex: number,
  totalChunks: number,
  chunk: string
) {
  return {
    system: `You are a study assistant. This is part ${chunkIndex + 1} of ${totalChunks} of a resource
titled "${title}". Summarize the key points from just this part in concise Markdown bullets. Do not
invent facts not present in the text.`,
    user: chunk,
  }
}

export function recapPrompt(context: string) {
  return {
    system: `You are a study assistant. The user is revisiting a topic they haven't looked at in a
while. Write a short "recap" in Markdown — 3-6 bullet points of the key things they should
remember before diving back in. Do not invent facts not present in the context.`,
    user: context,
  }
}

export function quizPrompt(context: string) {
  return {
    system: `You are a study assistant. Generate a quiz of 5-8 questions to test understanding of the
topic below. Mix multiple-choice and short-answer questions.

Respond with ONLY a JSON array, no markdown fences, no commentary. Each item:
{"q": string, "options": string[] (omit or empty for short-answer), "answer": string, "explanation": string}

Rules:
- For multiple-choice questions, "answer" must exactly match one of the "options".
- Keep questions grounded in the given context — do not invent facts.
- Vary difficulty from recall to applied understanding.`,
    user: context,
  }
}

export function roadmapPrompt(context: string) {
  return {
    system: `You are a curriculum designer helping structure a personal knowledge graph. Given the
context of a topic, propose an ordered learning roadmap of subtopics to add underneath it.

Respond with ONLY a JSON array, no markdown fences, no commentary. Each item:
{"title": string, "description": string, "prerequisites": string[], "children": [...same shape...]}

Rules:
- "prerequisites" lists the exact "title" strings of OTHER items in this same proposal that should be
  learned first (leave empty if none, or if the prerequisite isn't part of this proposal).
- Order items in the array in the sequence they should be learned.
- Nest closely related sub-subtopics under "children" (max 2 levels of nesting).
- Keep titles short (2-6 words). Keep descriptions to one sentence.
- Propose 4-10 top-level items unless the topic clearly warrants fewer.`,
    user: context,
  }
}

export function nodeChatSystemPrompt(context: string, webSearchEnabled: boolean) {
  return `You are a study assistant helping the user learn about a specific topic in their personal
knowledge graph. Answer using the context below. Be concise but thorough; use Markdown where useful.
${webSearchEnabled ? 'You have web search available — use it for up-to-date or external facts.' : 'Do not invent facts beyond the given context and general knowledge.'}

## Context
${context}`
}

export function reduceSummariesPrompt(title: string, partialSummaries: string[]) {
  return {
    system: `You are a study assistant. Combine the following partial summaries of a resource titled
"${title}" into one cohesive, well-structured Markdown summary — merge duplicate points, keep it
concise, use headings/bullets where useful. Do not invent facts not present in the partial summaries.`,
    user: partialSummaries.map((s, i) => `## Part ${i + 1}\n${s}`).join('\n\n'),
  }
}
