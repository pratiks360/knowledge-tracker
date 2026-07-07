# Graph Report - C:\PROJECTS\Personal Knowledge Graph  (2026-07-07)

## Corpus Check
- 67 files · ~22,041 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 213 nodes · 240 edges · 49 communities detected
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 23 edges
2. `chatText()` - 7 edges
3. `summarizeResourceContent()` - 7 edges
4. `json()` - 7 edges
5. `providerFetch()` - 6 edges
6. `useAIConfig()` - 6 edges
7. `AIStatusLED()` - 5 edges
8. `chatCompletion()` - 5 edges
9. `chatJSON()` - 5 edges
10. `PresentPage()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `useAddNodeLink()` --calls--> `useAuth()`  [INFERRED]
  C:\PROJECTS\Personal Knowledge Graph\src\lib\queries\nodeLinks.ts → C:\PROJECTS\Personal Knowledge Graph\src\lib\auth-context.tsx
- `useCreateNode()` --calls--> `useAuth()`  [INFERRED]
  C:\PROJECTS\Personal Knowledge Graph\src\lib\queries\nodes.ts → C:\PROJECTS\Personal Knowledge Graph\src\lib\auth-context.tsx
- `useAddStoryStep()` --calls--> `useAuth()`  [INFERRED]
  C:\PROJECTS\Personal Knowledge Graph\src\lib\queries\presentation.ts → C:\PROJECTS\Personal Knowledge Graph\src\lib\auth-context.tsx
- `useCreateQuiz()` --calls--> `useAuth()`  [INFERRED]
  C:\PROJECTS\Personal Knowledge Graph\src\lib\queries\quizzes.ts → C:\PROJECTS\Personal Knowledge Graph\src\lib\auth-context.tsx
- `runAction()` --calls--> `chatText()`  [INFERRED]
  C:\PROJECTS\Personal Knowledge Graph\src\components\NodeAIActions.tsx → C:\PROJECTS\Personal Knowledge Graph\src\lib\ai.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (29): AIError, chatCompletion(), chatConversation(), chatJSON(), chatText(), chunkText(), generateNodeDetails(), generateQuiz() (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (14): AddResourceForm(), useAuth(), chatKey(), useChatMessages(), useSendChatMessage(), LoginPage(), OwnerGate(), ProtectedRoute() (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (12): run(), buildTree(), computeProgress(), getDescendantIds(), serializeTreeForAI(), useCreateNode(), useNode(), useNodes() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (6): buildPresentGraph(), stepsKey(), useAddStoryStep(), usePresentation(), useStoryPathSteps(), PresentPage()

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (7): useAIHealth(), useAliveModels(), AIStatusLED(), resolveAIConfig(), useAIConfig(), useSaveUserSettings(), useUserSettings()

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (2): json(), invokeEdgeFunction()

### Community 6 - "Community 6"
Cohesion: 0.38
Nodes (3): handleMcqChoice(), handleShortAnswerSelfMark(), recordAnswer()

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (2): useMergeRoadmap(), RoadmapPreview()

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 0.5
Nodes (3): linksKey(), useAddNodeLink(), useNodeLinks()

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (3): quizKey(), useCreateQuiz(), useLatestQuiz()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (2): buildNodeContext(), runAction()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (2): buildContext(), generate()

### Community 13 - "Community 13"
Cohesion: 0.83
Nodes (3): focusNode(), goToStep(), handler()

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (1): handleValidate()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (2): buildContext(), generate()

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 18`** (2 nodes): `App()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `Breadcrumbs()`, `Breadcrumbs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `FullscreenSpinner.tsx`, `FullscreenSpinner()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `MarkdownEditor.tsx`, `handleBlur()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `ProgressRing.tsx`, `ProgressRing()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `StatusToggle.tsx`, `StatusToggle()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `PresentCanvasWithProvider.tsx`, `PresentCanvasWithProvider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `PresentNode.tsx`, `PresentFlowNode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `StoryPathEditor.tsx`, `move()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `RoadmapNode.tsx`, `RoadmapFlowNode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `TreeSidebar.tsx`, `handleAddRoot()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `roadmapLayout.ts`, `layoutRoadmap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `staleness.ts`, `isNodeStale()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `handleSignOut()`, `AppLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `DashboardPage.tsx`, `handleQuickAdd()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `NotFoundPage.tsx`, `NotFoundPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `AuthCallback()`, `AuthCallback.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `NodePicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `RelatedLinksPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `PresentSideCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `ResourcesList.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `supabase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `NodePage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `db.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 7`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **Why does `json()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Why does `invokeEdgeFunction()` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `useAuth()` (e.g. with `OwnerGate()` and `ProtectedRoute()`) actually correct?**
  _`useAuth()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `chatText()` (e.g. with `runAction()` and `runTransient()`) actually correct?**
  _`chatText()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `summarizeResourceContent()` (e.g. with `runSummarize()` and `summarizeResourcePrompt()`) actually correct?**
  _`summarizeResourceContent()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `json()` (e.g. with `listModels()` and `chatCompletion()`) actually correct?**
  _`json()` has 4 INFERRED edges - model-reasoned connections that need verification._