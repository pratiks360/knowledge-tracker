import { supabase } from '@/lib/supabase'
import { buildTree, getDescendantIds, type TreeNode } from '@/lib/queries/nodes'
import type { NodeLinkRow, NodeRow, QuizRow, ResourceRow } from '@/types/db'

export const EXPORT_VERSION = 1

export type ExportBundle = {
  version: typeof EXPORT_VERSION
  exportedAt: string
  rootId: string | null
  nodes: NodeRow[]
  nodeLinks: NodeLinkRow[]
  resources: ResourceRow[]
  quizzes: QuizRow[]
}

/** Builds an export bundle for a subtree (rootId + descendants) or the whole graph (rootId = null). */
export async function buildExportBundle(
  allNodes: NodeRow[],
  rootId: string | null
): Promise<ExportBundle> {
  const nodeIds =
    rootId === null
      ? new Set(allNodes.map((n) => n.id))
      : new Set([rootId, ...getDescendantIds(allNodes, rootId)])

  const nodes = allNodes.filter((n) => nodeIds.has(n.id))
  const ids = [...nodeIds]

  const [{ data: nodeLinks, error: linksErr }, { data: resources, error: resErr }, { data: quizzes, error: qErr }] =
    await Promise.all([
      supabase.from('node_links').select('*').or(`from_node.in.(${ids.join(',')}),to_node.in.(${ids.join(',')})`),
      supabase.from('resources').select('*').in('node_id', ids),
      supabase.from('quizzes').select('*').in('node_id', ids),
    ])
  if (linksErr) throw linksErr
  if (resErr) throw resErr
  if (qErr) throw qErr

  const filteredLinks = (nodeLinks as NodeLinkRow[]).filter(
    (l) => nodeIds.has(l.from_node) && nodeIds.has(l.to_node)
  )

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    rootId,
    nodes,
    nodeLinks: filteredLinks,
    resources: resources as ResourceRow[],
    quizzes: quizzes as QuizRow[],
  }
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadBundleJSON(bundle: ExportBundle, filename: string) {
  downloadFile(JSON.stringify(bundle, null, 2), filename, 'application/json')
}

/** Renders a subtree (or the whole forest, if bundle.rootId is null) as one nested Markdown doc. */
export function bundleToMarkdown(bundle: ExportBundle): string {
  const tree = buildTree(bundle.nodes)
  const resourcesByNode = new Map<string, ResourceRow[]>()
  for (const r of bundle.resources) {
    const list = resourcesByNode.get(r.node_id) ?? []
    list.push(r)
    resourcesByNode.set(r.node_id, list)
  }

  const lines: string[] = []
  const walk = (items: TreeNode[], depth: number) => {
    for (const n of items) {
      const heading = '#'.repeat(Math.min(depth + 1, 6))
      lines.push(`${heading} ${n.title}${n.status === 'done' ? ' ✅' : ''}`)
      if (n.description) lines.push(n.description)
      if (n.details_md) lines.push(n.details_md)
      if (n.notes_md) lines.push(`**Notes**\n\n${n.notes_md}`)
      const res = resourcesByNode.get(n.id) ?? []
      if (res.length) {
        lines.push(res.map((r) => `- [${r.title ?? r.url ?? 'Untitled'}](${r.url ?? ''})`).join('\n'))
      }
      lines.push('')
      walk(n.children, depth + 1)
    }
  }
  walk(tree, 0)
  return lines.join('\n\n')
}

export function parseImportBundle(text: string): ExportBundle {
  const data = JSON.parse(text)
  if (!data || typeof data !== 'object' || !Array.isArray(data.nodes)) {
    throw new Error('Not a valid Knowledge Graph export file.')
  }
  return data as ExportBundle
}

/**
 * Recreates a bundle's nodes (+ links, resources, quizzes) under `parentId`
 * (or as new root(s) if null). Old ids are remapped to freshly-inserted ones.
 */
export async function importBundle(bundle: ExportBundle, parentId: string | null): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const tree = buildTree(bundle.nodes)
  const idMap = new Map<string, string>()

  const insertNode = async (n: TreeNode, newParentId: string | null, orderIndex: number) => {
    const { data, error } = await supabase
      .from('nodes')
      .insert({
        user_id: user.id,
        parent_id: newParentId,
        title: n.title,
        description: n.description,
        notes_md: n.notes_md,
        details_md: n.details_md,
        node_kind: n.node_kind,
        tags: n.tags,
        order_index: orderIndex,
      })
      .select('id')
      .single()
    if (error) throw error
    idMap.set(n.id, data.id as string)
    for (let i = 0; i < n.children.length; i++) {
      await insertNode(n.children[i], data.id as string, i)
    }
  }

  for (let i = 0; i < tree.length; i++) {
    await insertNode(tree[i], parentId, i)
  }

  if (bundle.resources.length) {
    const rows = bundle.resources
      .filter((r) => idMap.has(r.node_id))
      .map((r) => ({
        user_id: user.id,
        node_id: idMap.get(r.node_id)!,
        kind: r.kind,
        url: r.url,
        title: r.title,
        raw_content: r.raw_content,
        summary_md: r.summary_md,
        pinned: r.pinned,
      }))
    if (rows.length) {
      const { error } = await supabase.from('resources').insert(rows)
      if (error) throw error
    }
  }

  if (bundle.nodeLinks.length) {
    const rows = bundle.nodeLinks
      .filter((l) => idMap.has(l.from_node) && idMap.has(l.to_node))
      .map((l) => ({
        user_id: user.id,
        from_node: idMap.get(l.from_node)!,
        to_node: idMap.get(l.to_node)!,
        link_type: l.link_type,
      }))
    if (rows.length) {
      const { error } = await supabase.from('node_links').insert(rows)
      if (error) throw error
    }
  }

  return idMap.size
}
