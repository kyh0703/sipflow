CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  flow_data TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenario_nodes (
  scenario_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('sipInstance', 'command', 'event')),
  label TEXT NOT NULL DEFAULT '',
  sip_instance_id TEXT,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  width REAL,
  height REAL,
  z_index INTEGER NOT NULL DEFAULT 0,
  style_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scenario_id, node_id),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scenario_nodes_scenario
ON scenario_nodes (scenario_id);

CREATE INDEX IF NOT EXISTS idx_scenario_nodes_instance
ON scenario_nodes (scenario_id, sip_instance_id);

CREATE TABLE IF NOT EXISTS scenario_edges (
  scenario_id TEXT NOT NULL,
  edge_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  source_handle TEXT,
  branch_type TEXT NOT NULL DEFAULT 'success' CHECK (branch_type IN ('success', 'failure')),
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scenario_id, edge_id),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id, source_node_id) REFERENCES scenario_nodes(scenario_id, node_id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id, target_node_id) REFERENCES scenario_nodes(scenario_id, node_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scenario_edges_scenario
ON scenario_edges (scenario_id);

CREATE TABLE IF NOT EXISTS node_properties (
  scenario_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  properties_json TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scenario_id, node_id),
  FOREIGN KEY (scenario_id, node_id) REFERENCES scenario_nodes(scenario_id, node_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_node_properties_scenario
ON node_properties (scenario_id);

INSERT OR IGNORE INTO projects (id, name) VALUES ('default', 'Default Project');
