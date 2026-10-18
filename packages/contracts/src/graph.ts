export interface GraphNode {
  key: string;
  dependsOn: readonly string[];
}

export type GraphIssue =
  | { kind: 'duplicate_key'; key: string }
  | { kind: 'self_dependency'; key: string }
  | { kind: 'unknown_dependency'; key: string; dependsOn: string }
  | { kind: 'cycle'; keys: string[] };

/** Revisa claves únicas, referencias y ciclos. Devuelve una lista vacía si el grafo es válido. */
export function checkGraph(nodes: readonly GraphNode[]): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const keys = new Set<string>();
  for (const n of nodes) {
    if (keys.has(n.key)) issues.push({ kind: 'duplicate_key', key: n.key });
    keys.add(n.key);
  }
  for (const n of nodes) {
    for (const d of n.dependsOn) {
      if (d === n.key) issues.push({ kind: 'self_dependency', key: n.key });
      else if (!keys.has(d)) issues.push({ kind: 'unknown_dependency', key: n.key, dependsOn: d });
    }
  }
  const cycle = findCycle(nodes);
  if (cycle) issues.push({ kind: 'cycle', keys: cycle });
  return issues;
}

/** Devuelve las claves de un ciclo si existe (ignora referencias desconocidas y autorreferencias). */
export function findCycle(nodes: readonly GraphNode[]): string[] | null {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (key: string): string[] | null => {
    state.set(key, 1);
    stack.push(key);
    for (const d of byKey.get(key)?.dependsOn ?? []) {
      if (d === key || !byKey.has(d)) continue;
      const s = state.get(d);
      if (s === 1) return stack.slice(stack.indexOf(d));
      if (s === undefined) {
        const found = visit(d);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(key, 2);
    return null;
  };
  for (const n of nodes) {
    if (!state.has(n.key)) {
      const found = visit(n.key);
      if (found) return found;
    }
  }
  return null;
}

/** Orden topológico estable: respeta el orden de entrada cuando no hay dependencias. */
export function topoOrder<T extends GraphNode>(nodes: readonly T[]): T[] {
  const done = new Set<string>();
  const out: T[] = [];
  const keys = new Set(nodes.map((n) => n.key));
  let pending = [...nodes];
  while (pending.length) {
    const next = pending.find((n) => n.dependsOn.every((d) => done.has(d) || !keys.has(d) || d === n.key));
    if (!next) throw new Error('El grafo de objetivos tiene un ciclo');
    out.push(next);
    done.add(next.key);
    pending = pending.filter((n) => n !== next);
  }
  return out;
}
