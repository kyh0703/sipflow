import type { Node, Edge } from '@xyflow/react';

export interface ValidationError {
  type: 'cycle' | 'isolated' | 'required-field' | 'instance-assignment';
  nodeId?: string;
  message: string;
}

/**
 * Check if creating a new connection would form a cycle using DFS.
 * Returns true if a cycle would be created, false otherwise.
 */
export function wouldCreateCycle(
  nodes: Node[],
  edges: Edge[],
  newConnection: { source: string; target: string }
): boolean {
  // Create adjacency list with the new edge included
  const adjacencyList = new Map<string, string[]>();

  // Add all existing edges
  edges.forEach((edge) => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push(edge.target);
  });

  // Add the proposed new edge
  if (!adjacencyList.has(newConnection.source)) {
    adjacencyList.set(newConnection.source, []);
  }
  adjacencyList.get(newConnection.source)!.push(newConnection.target);

  // DFS from newConnection.target to see if we can reach newConnection.source
  const visited = new Set<string>();
  const stack = [newConnection.target];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current === newConnection.source) {
      return true; // Cycle detected
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return false; // No cycle
}

/**
 * Detect cycles in the entire graph using DFS with recursion stack.
 * Returns array of validation errors for nodes involved in cycles.
 */
export function detectCycles(nodes: Node[], edges: Edge[]): ValidationError[] {
  const adjacencyList = new Map<string, string[]>();

  // Build adjacency list
  edges.forEach((edge) => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push(edge.target);
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleNodes = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          cycleNodes.add(nodeId);
          cycleNodes.add(neighbor);
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Back edge found - cycle detected
        cycleNodes.add(nodeId);
        cycleNodes.add(neighbor);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Run DFS from all unvisited nodes
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  // Return errors for all nodes in cycles
  return Array.from(cycleNodes).map((nodeId) => ({
    type: 'cycle',
    nodeId,
    message: 'Node is part of a cycle',
  }));
}

/**
 * Detect isolated nodes (nodes not reachable from any SIP Instance start point).
 * Uses BFS from all SIP Instance nodes.
 */
export function detectIsolatedNodes(nodes: Node[], edges: Edge[]): ValidationError[] {
  const sipInstanceIds = nodes.filter((node) => node.type === 'sipInstance').map((node) => node.id);

  if (sipInstanceIds.length === 0) {
    // No SIP instances - all other nodes are isolated
    return nodes
      .filter((node) => node.type !== 'sipInstance')
      .map((node) => ({
        type: 'isolated',
        nodeId: node.id,
        message: 'No SIP Instance found',
      }));
  }

  // Build adjacency list (both directions for reachability)
  const adjacencyList = new Map<string, string[]>();
  const reverseAdjacencyList = new Map<string, string[]>();

  edges.forEach((edge) => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push(edge.target);

    if (!reverseAdjacencyList.has(edge.target)) {
      reverseAdjacencyList.set(edge.target, []);
    }
    reverseAdjacencyList.get(edge.target)!.push(edge.source);
  });

  // BFS from all SIP instances to find reachable nodes
  const reachable = new Set<string>();
  const queue = [...sipInstanceIds];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (reachable.has(current)) {
      continue;
    }

    reachable.add(current);

    // Add forward neighbors
    const forwardNeighbors = adjacencyList.get(current) || [];
    for (const neighbor of forwardNeighbors) {
      if (!reachable.has(neighbor)) {
        queue.push(neighbor);
      }
    }

    // Add backward neighbors (nodes that point to this one)
    const backwardNeighbors = reverseAdjacencyList.get(current) || [];
    for (const neighbor of backwardNeighbors) {
      if (!reachable.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  // Return errors for all unreachable nodes
  return nodes
    .filter((node) => !reachable.has(node.id))
    .map((node) => ({
      type: 'isolated',
      nodeId: node.id,
      message: 'Node is not connected to any SIP Instance',
    }));
}

/**
 * Validate that all command/event nodes have a SIP instance assignment.
 */
export function validateInstanceAssignments(nodes: Node[]): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach((node) => {
    if (node.type === 'command' || node.type === 'event') {
      const data = node.data as any;
      if (!data.sipInstanceId) {
        errors.push({
          type: 'instance-assignment',
          nodeId: node.id,
          message: `${node.type === 'command' ? 'Command' : 'Event'} node must be assigned to a SIP Instance`,
        });
      }
    }
  });

  return errors;
}

/**
 * Validate required fields for specific node types.
 * - MakeCall command: requires targetUri
 * - TIMEOUT event: requires timeout
 * - DN mode SIP Instance: requires dn
 */
export function validateRequiredFields(nodes: Node[]): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach((node) => {
    const data = node.data as any;

    if (node.type === 'command') {
      if (data.command === 'MakeCall') {
        if (!data.targetUri || data.targetUri.trim() === '') {
          errors.push({
            type: 'required-field',
            nodeId: node.id,
            message: 'MakeCall command requires targetUri',
          });
        }
      }
    } else if (node.type === 'event') {
      if (data.event === 'TIMEOUT') {
        if (!data.timeout || data.timeout <= 0) {
          errors.push({
            type: 'required-field',
            nodeId: node.id,
            message: 'TIMEOUT event requires a positive timeout value',
          });
        }
      }
    } else if (node.type === 'sipInstance') {
      if (data.mode === 'DN') {
        if (!data.dn || data.dn.trim() === '') {
          errors.push({
            type: 'required-field',
            nodeId: node.id,
            message: 'DN mode requires dn field',
          });
        }
      }
    }
  });

  return errors;
}

/**
 * Run all validation checks and return combined errors.
 */
export function validateScenario(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  errors.push(...detectCycles(nodes, edges));
  errors.push(...detectIsolatedNodes(nodes, edges));
  errors.push(...validateInstanceAssignments(nodes));
  errors.push(...validateRequiredFields(nodes));

  return errors;
}
