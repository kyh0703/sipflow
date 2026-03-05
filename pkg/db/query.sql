-- name: CreateScenario :one
INSERT INTO scenarios (
  id,
  project_id,
  name,
  flow_data,
  created_at,
  updated_at
) VALUES (
  ?, ?, ?, '{}', ?, ?
)
RETURNING id, project_id, name, flow_data, created_at, updated_at;

-- name: SaveScenario :execrows
UPDATE scenarios
SET flow_data = ?, updated_at = ?
WHERE id = ?;

-- name: GetScenario :one
SELECT id, project_id, name, flow_data, created_at, updated_at
FROM scenarios
WHERE id = ?
LIMIT 1;

-- name: ListScenarios :many
SELECT id, project_id, name, created_at, updated_at
FROM scenarios
WHERE project_id = ?
ORDER BY updated_at DESC;

-- name: DeleteScenario :execrows
DELETE FROM scenarios
WHERE id = ?;

-- name: RenameScenario :execrows
UPDATE scenarios
SET name = ?, updated_at = ?
WHERE id = ?;

-- name: UpsertNodeProperty :exec
INSERT INTO node_properties (
  scenario_id,
  node_id,
  schema_version,
  properties_json,
  created_at,
  updated_at
) VALUES (
  ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT(scenario_id, node_id) DO UPDATE SET
  schema_version = excluded.schema_version,
  properties_json = excluded.properties_json,
  updated_at = CURRENT_TIMESTAMP;

-- name: GetNodeProperty :one
SELECT scenario_id, node_id, schema_version, properties_json, created_at, updated_at
FROM node_properties
WHERE scenario_id = ? AND node_id = ?
LIMIT 1;

-- name: DeleteNodeProperty :execrows
DELETE FROM node_properties
WHERE scenario_id = ? AND node_id = ?;

-- name: UpsertScenarioNode :exec
INSERT INTO scenario_nodes (
  scenario_id,
  node_id,
  node_type,
  label,
  sip_instance_id,
  position_x,
  position_y,
  width,
  height,
  z_index,
  style_json,
  created_at,
  updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT(scenario_id, node_id) DO UPDATE SET
  node_type = excluded.node_type,
  label = excluded.label,
  sip_instance_id = excluded.sip_instance_id,
  position_x = excluded.position_x,
  position_y = excluded.position_y,
  width = excluded.width,
  height = excluded.height,
  z_index = excluded.z_index,
  style_json = excluded.style_json,
  updated_at = CURRENT_TIMESTAMP;

-- name: ListScenarioNodes :many
SELECT
  scenario_id,
  node_id,
  node_type,
  label,
  sip_instance_id,
  position_x,
  position_y,
  width,
  height,
  z_index,
  style_json,
  created_at,
  updated_at
FROM scenario_nodes
WHERE scenario_id = ?
ORDER BY node_id;

-- name: DeleteScenarioNode :execrows
DELETE FROM scenario_nodes
WHERE scenario_id = ? AND node_id = ?;

-- name: DeleteScenarioNodesByScenario :execrows
DELETE FROM scenario_nodes
WHERE scenario_id = ?;

-- name: UpsertScenarioEdge :exec
INSERT INTO scenario_edges (
  scenario_id,
  edge_id,
  source_node_id,
  target_node_id,
  source_handle,
  branch_type,
  data_json,
  created_at,
  updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT(scenario_id, edge_id) DO UPDATE SET
  source_node_id = excluded.source_node_id,
  target_node_id = excluded.target_node_id,
  source_handle = excluded.source_handle,
  branch_type = excluded.branch_type,
  data_json = excluded.data_json,
  updated_at = CURRENT_TIMESTAMP;

-- name: ListScenarioEdges :many
SELECT
  scenario_id,
  edge_id,
  source_node_id,
  target_node_id,
  source_handle,
  branch_type,
  data_json,
  created_at,
  updated_at
FROM scenario_edges
WHERE scenario_id = ?
ORDER BY edge_id;

-- name: DeleteScenarioEdge :execrows
DELETE FROM scenario_edges
WHERE scenario_id = ? AND edge_id = ?;

-- name: DeleteScenarioEdgesByScenario :execrows
DELETE FROM scenario_edges
WHERE scenario_id = ?;
