/**
 * Pure JS tree builder — extracted from Registry.tree() for use as WASM fallback.
 */
import type { ComponentRecord } from '../types'
import type { TreeNode } from './registry'

export function build_tree_js(records: ComponentRecord[]): TreeNode[] {
    const nodes = new Map<number, TreeNode>()
    for (const record of records) {
        nodes.set(record.uid, { ...record, children: [], subtreeRenders: record.renderCount, depth: 0 })
    }

    const roots: TreeNode[] = []
    for (const node of nodes.values()) {
        const parent = node.parentUid !== null ? nodes.get(node.parentUid) : undefined
        if (parent) parent.children.push(node)
        else roots.push(node)
    }

    const applyDepth = (node: TreeNode, depth: number): number => {
        node.depth = depth
        let total = node.renderCount
        for (const child of node.children) total += applyDepth(child, depth + 1)
        node.subtreeRenders = total
        return total
    }
    for (const root of roots) applyDepth(root, 0)
    return roots
}
