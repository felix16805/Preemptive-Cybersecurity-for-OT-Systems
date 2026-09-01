import type { OTGraph, OTEdge, CutEdge, Certificate, SafetyLoop, SIFResult } from "@/types";
import { SAFETY_LOOPS } from "@/lib/ot-topology";

// ─── Edmonds-Karp (BFS-based max-flow / min-cut) ──────────────────────────────
//
//  Safety-loop edges are given Infinity capacity → the algorithm is
//  mathematically forced to route the cut around them.
//
//  Returns the set of edges in the min-cut (these are the links to sever).
// ─────────────────────────────────────────────────────────────────────────────

type AdjMap = Map<string, Map<string, number>>; // node → (neighbour → residual capacity)

function buildResidualGraph(graph: OTGraph): AdjMap {
  const adj: AdjMap = new Map();

  const ensureNode = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Map());
  };

  for (const edge of graph.edges) {
    ensureNode(edge.source);
    ensureNode(edge.target);

    const cap = edge.capacity === Infinity ? 1e15 : edge.capacity;

    // Undirected → add both directions
    const fwd = adj.get(edge.source)!;
    fwd.set(edge.target, (fwd.get(edge.target) ?? 0) + cap);

    const rev = adj.get(edge.target)!;
    rev.set(edge.source, (rev.get(edge.source) ?? 0) + cap);
  }

  return adj;
}

/** BFS to find augmenting path; returns parent map or null if no path exists. */
function bfs(
  adj: AdjMap,
  source: string,
  sink: string,
  parent: Map<string, string>
): boolean {
  const visited = new Set<string>([source]);
  const queue: string[] = [source];

  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const [v, cap] of adj.get(u) ?? []) {
      if (!visited.has(v) && cap > 0) {
        visited.add(v);
        parent.set(v, u);
        if (v === sink) return true;
        queue.push(v);
      }
    }
  }
  return false;
}

/** Edmonds-Karp max-flow. Returns residual graph after flow saturation. */
function edmondsKarp(adj: AdjMap, source: string, sink: string): AdjMap {
  const parent = new Map<string, string>();

  while (bfs(adj, source, sink, parent)) {
    // Find bottleneck capacity along the augmenting path
    let pathFlow = Infinity;
    let v = sink;
    while (v !== source) {
      const u = parent.get(v)!;
      pathFlow = Math.min(pathFlow, adj.get(u)!.get(v)!);
      v = u;
    }

    // Update residual capacities
    v = sink;
    while (v !== source) {
      const u = parent.get(v)!;
      adj.get(u)!.set(v, adj.get(u)!.get(v)! - pathFlow);
      adj.get(v)!.set(u, (adj.get(v)!.get(u) ?? 0) + pathFlow);
      v = u;
    }

    parent.clear();
  }

  return adj;
}

/** BFS reachability from source on residual graph (finds the S-side of the cut). */
function reachableNodes(adj: AdjMap, source: string): Set<string> {
  const visited = new Set<string>([source]);
  const queue: string[] = [source];
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const [v, cap] of adj.get(u) ?? []) {
      if (!visited.has(v) && cap > 0) {
        visited.add(v);
        queue.push(v);
      }
    }
  }
  return visited;
}

// ─── Public: Compute the SafeCut ─────────────────────────────────────────────

export interface SolverInput {
  graph: OTGraph;
  compromisedNode: string;
  /** All other nodes are protected (sink = virtual super-sink connected to all) */
  protectedNodes?: string[];
}

export interface SolverOutput {
  cutEdges: CutEdge[];
  solveTimeMs: number;
  feasible: boolean;
  infeasibilityReason?: string;
}

export function computeSafeCut(input: SolverInput): SolverOutput {
  const start = performance.now();

  const { graph, compromisedNode } = input;

  // Protected nodes = all non-compromised, safety-critical nodes
  const protectedNodes =
    input.protectedNodes ??
    graph.nodes
      .filter((n) => n.isSafetyCritical && n.id !== compromisedNode)
      .map((n) => n.id);

  if (protectedNodes.length === 0) {
    return {
      cutEdges: [],
      solveTimeMs: performance.now() - start,
      feasible: false,
      infeasibilityReason: "No protected nodes — nothing to isolate from.",
    };
  }

  // Build augmented graph with a virtual super-sink connected to all protected nodes
  const SUPER_SINK = "__SUPER_SINK__";
  const augmentedGraph: OTGraph = {
    nodes: [...graph.nodes, { id: SUPER_SINK, label: "SuperSink", type: "Switch", isSafetyCritical: false }],
    edges: [
      ...graph.edges,
      ...protectedNodes.map((pn) => ({
        source: pn,
        target: SUPER_SINK,
        capacity: Infinity, // don't cut these connector edges
        isSafetyLoop: true,
      })),
    ],
  };

  const adj = buildResidualGraph(augmentedGraph);
  const residual = edmondsKarp(adj, compromisedNode, SUPER_SINK);
  const sReachable = reachableNodes(residual, compromisedNode);

  // Collect cut edges: edges crossing from S-side to T-side in original graph
  const cutEdges: CutEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.capacity === Infinity) continue; // safety edges — never cut
    const srcInS = sReachable.has(edge.source);
    const tgtInS = sReachable.has(edge.target);
    if (srcInS !== tgtInS) {
      cutEdges.push({ source: edge.source, target: edge.target });
    }
  }

  // Feasibility: if compromised node is inside a safety loop and the loop
  // itself is the only path, the cut is infeasible
  const compromisedIsSafetyNode = graph.nodes.find((n) => n.id === compromisedNode)?.isSafetyCritical;
  if (compromisedIsSafetyNode) {
    return {
      cutEdges,
      solveTimeMs: performance.now() - start,
      feasible: false,
      infeasibilityReason:
        "Compromised node is inside a safety-instrumented function loop. SafeCut reports INFEASIBLE — manual intervention required.",
    };
  }

  return {
    cutEdges,
    solveTimeMs: performance.now() - start,
    feasible: true,
  };
}

// ─── Public: Certificate Verifier ─────────────────────────────────────────────
//
//  Independently verifies (via BFS reachability — does NOT trust the solver)
//  that every safety loop still has a connected path after the cut is applied.
// ─────────────────────────────────────────────────────────────────────────────

export function verifyCertificate(
  graph: OTGraph,
  cutEdges: CutEdge[],
  safetyLoops: SafetyLoop[] = SAFETY_LOOPS
): Certificate {
  // Build post-cut adjacency (remove cut edges)
  const cutSet = new Set(
    cutEdges.flatMap((e) => [`${e.source}:${e.target}`, `${e.target}:${e.source}`])
  );

  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) {
    if (
      cutSet.has(`${edge.source}:${edge.target}`) ||
      cutSet.has(`${edge.target}:${edge.source}`)
    )
      continue;
    adj.get(edge.source)!.push(edge.target);
    adj.get(edge.target)!.push(edge.source);
  }

  const bfsPath = (src: string, dst: string): string[] => {
    const parent = new Map<string, string | null>([[src, null]]);
    const queue = [src];
    while (queue.length > 0) {
      const u = queue.shift()!;
      if (u === dst) {
        // reconstruct path
        const path: string[] = [];
        let cur: string | null = dst;
        while (cur !== null) {
          path.unshift(cur);
          cur = parent.get(cur) ?? null;
          if (cur === src) { path.unshift(src); break; }
        }
        return path;
      }
      for (const v of adj.get(u) ?? []) {
        if (!parent.has(v)) {
          parent.set(v, u);
          queue.push(v);
        }
      }
    }
    return [];
  };

  const sifResults: SIFResult[] = safetyLoops.map((loop) => {
    // For each loop, verify every edge's endpoints remain connected
    let preserved = true;
    let path: string[] = [];

    for (const loopEdge of loop.edges) {
      path = bfsPath(loopEdge.source, loopEdge.target);
      if (path.length === 0) {
        preserved = false;
        break;
      }
    }

    return {
      loopId: loop.id,
      loopName: loop.name,
      preserved,
      path,
    };
  });

  return {
    issuedAt: new Date().toISOString(),
    solverUsed: "Edmonds-Karp",
    sifResults,
    allPreserved: sifResults.every((r) => r.preserved),
  };
}

// ─── Blind quarantine (conventional tool — for contrast demo) ─────────────────

export function computeBlindQuarantine(
  graph: OTGraph,
  compromisedNode: string
): CutEdge[] {
  // Cuts ALL edges connected to the compromised node — indiscriminate
  return graph.edges
    .filter((e) => e.source === compromisedNode || e.target === compromisedNode)
    .map((e) => ({ source: e.source, target: e.target }));
}
