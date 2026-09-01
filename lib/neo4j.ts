import neo4j, { Driver } from "neo4j-driver";
import type { OTGraph } from "@/types";
import { OT_TOPOLOGY } from "@/lib/ot-topology";

// ─── Neo4j driver singleton ───────────────────────────────────────────────────

let _driver: Driver | null = null;

function getDriver(): Driver | null {
  if (_driver) return _driver;

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    console.warn("[Neo4j] No credentials configured — topology served from in-memory definition.");
    return null;
  }

  try {
    _driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    return _driver;
  } catch (err) {
    console.error("[Neo4j] Failed to create driver:", err);
    return null;
  }
}

// ─── Seed topology into Neo4j ─────────────────────────────────────────────────

export async function seedTopology(graph: OTGraph = OT_TOPOLOGY): Promise<void> {
  const driver = getDriver();
  if (!driver) return;

  const session = driver.session();
  try {
    // Clear existing topology
    await session.run("MATCH (n:OTDevice) DETACH DELETE n");

    // Create nodes
    for (const node of graph.nodes) {
      await session.run(
        `CREATE (n:OTDevice {
          id: $id, label: $label, type: $type,
          isSafetyCritical: $isSafetyCritical
        })`,
        node
      );
    }

    // Create edges
    for (const edge of graph.edges) {
      await session.run(
        `MATCH (a:OTDevice {id: $source}), (b:OTDevice {id: $target})
         CREATE (a)-[:NETWORK_LINK {
           capacity: $capacity,
           isSafetyLoop: $isSafetyLoop,
           safetyLoopId: $safetyLoopId
         }]->(b)`,
        {
          source: edge.source,
          target: edge.target,
          capacity: edge.capacity === Infinity ? -1 : edge.capacity, // -1 = Infinity in Neo4j
          isSafetyLoop: edge.isSafetyLoop,
          safetyLoopId: edge.safetyLoopId ?? null,
        }
      );
    }
    console.log("[Neo4j] Topology seeded successfully.");
  } catch (err) {
    console.error("[Neo4j] Seed error:", err);
  } finally {
    await session.close();
  }
}

// ─── Fetch live topology from Neo4j ──────────────────────────────────────────

export async function fetchTopology(): Promise<OTGraph> {
  const driver = getDriver();
  if (!driver) return OT_TOPOLOGY; // fallback

  const session = driver.session();
  try {
    const nodeRes = await session.run("MATCH (n:OTDevice) RETURN n");
    const edgeRes = await session.run(
      "MATCH (a:OTDevice)-[r:NETWORK_LINK]->(b:OTDevice) RETURN a.id AS source, b.id AS target, r"
    );

    const nodes = nodeRes.records.map((r) => {
      const n = r.get("n").properties;
      return {
        id: n.id,
        label: n.label,
        type: n.type,
        isSafetyCritical: n.isSafetyCritical,
      };
    }) as OTGraph["nodes"];

    const edges = edgeRes.records.map((r) => {
      const rel = r.get("r").properties;
      return {
        source: r.get("source"),
        target: r.get("target"),
        capacity: rel.capacity === -1 ? Infinity : Number(rel.capacity),
        isSafetyLoop: rel.isSafetyLoop,
        safetyLoopId: rel.safetyLoopId ?? undefined,
      };
    }) as OTGraph["edges"];

    return { nodes, edges };
  } catch (err) {
    console.error("[Neo4j] Fetch error:", err);
    return OT_TOPOLOGY;
  } finally {
    await session.close();
  }
}

// ─── Write isolation event to Neo4j ──────────────────────────────────────────

export async function writeIsolationEvent(
  compromisedNode: string,
  cutEdges: Array<{ source: string; target: string }>,
  mode: string
): Promise<void> {
  const driver = getDriver();
  if (!driver) return;

  const session = driver.session();
  try {
    await session.run(
      `MATCH (n:OTDevice {id: $nodeId})
       CREATE (e:IsolationEvent {
         id: randomUUID(),
         timestamp: datetime(),
         mode: $mode,
         cutEdgeCount: $cutEdgeCount
       })
       CREATE (e)-[:ISOLATED_NODE]->(n)`,
      {
        nodeId: compromisedNode,
        mode,
        cutEdgeCount: cutEdges.length,
      }
    );
  } catch (err) {
    console.error("[Neo4j] Write event error:", err);
  } finally {
    await session.close();
  }
}
