export namespace binding {
	
	export class WAVValidationResult {
	    valid: boolean;
	    error?: string;
	    details?: string;
	
	    static createFrom(source: any = {}) {
	        return new WAVValidationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.error = source["error"];
	        this.details = source["details"];
	    }
	}

}

export namespace dto {
	
	export class EdgeUpsert {
	    scenario_id: string;
	    edge_id: string;
	    source_node_id: string;
	    target_node_id: string;
	    source_handle?: string;
	    branch_type: string;
	    data_json: string;
	
	    static createFrom(source: any = {}) {
	        return new EdgeUpsert(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scenario_id = source["scenario_id"];
	        this.edge_id = source["edge_id"];
	        this.source_node_id = source["source_node_id"];
	        this.target_node_id = source["target_node_id"];
	        this.source_handle = source["source_handle"];
	        this.branch_type = source["branch_type"];
	        this.data_json = source["data_json"];
	    }
	}
	export class NodePropertyUpsert {
	    scenario_id: string;
	    node_id: string;
	    schema_version: number;
	    properties_json: string;
	
	    static createFrom(source: any = {}) {
	        return new NodePropertyUpsert(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scenario_id = source["scenario_id"];
	        this.node_id = source["node_id"];
	        this.schema_version = source["schema_version"];
	        this.properties_json = source["properties_json"];
	    }
	}
	export class NodeUpsert {
	    scenario_id: string;
	    node_id: string;
	    node_type: string;
	    label: string;
	    sip_instance_id?: string;
	    position_x: number;
	    position_y: number;
	    width?: number;
	    height?: number;
	    z_index: number;
	    style_json: string;
	
	    static createFrom(source: any = {}) {
	        return new NodeUpsert(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scenario_id = source["scenario_id"];
	        this.node_id = source["node_id"];
	        this.node_type = source["node_type"];
	        this.label = source["label"];
	        this.sip_instance_id = source["sip_instance_id"];
	        this.position_x = source["position_x"];
	        this.position_y = source["position_y"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.z_index = source["z_index"];
	        this.style_json = source["style_json"];
	    }
	}

}

export namespace entity {
	
	export class EdgeRecord {
	    scenario_id: string;
	    edge_id: string;
	    source_node_id: string;
	    target_node_id: string;
	    source_handle?: string;
	    branch_type: string;
	    data_json: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new EdgeRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scenario_id = source["scenario_id"];
	        this.edge_id = source["edge_id"];
	        this.source_node_id = source["source_node_id"];
	        this.target_node_id = source["target_node_id"];
	        this.source_handle = source["source_handle"];
	        this.branch_type = source["branch_type"];
	        this.data_json = source["data_json"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NodePropertyRecord {
	    scenario_id: string;
	    node_id: string;
	    schema_version: number;
	    properties_json: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new NodePropertyRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scenario_id = source["scenario_id"];
	        this.node_id = source["node_id"];
	        this.schema_version = source["schema_version"];
	        this.properties_json = source["properties_json"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NodeRecord {
	    scenario_id: string;
	    node_id: string;
	    node_type: string;
	    label: string;
	    sip_instance_id?: string;
	    position_x: number;
	    position_y: number;
	    width?: number;
	    height?: number;
	    z_index: number;
	    style_json: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new NodeRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scenario_id = source["scenario_id"];
	        this.node_id = source["node_id"];
	        this.node_type = source["node_type"];
	        this.label = source["label"];
	        this.sip_instance_id = source["sip_instance_id"];
	        this.position_x = source["position_x"];
	        this.position_y = source["position_y"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.z_index = source["z_index"];
	        this.style_json = source["style_json"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Scenario {
	    id: string;
	    project_id: string;
	    name: string;
	    flow_data: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Scenario(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.name = source["name"];
	        this.flow_data = source["flow_data"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ScenarioListItem {
	    id: string;
	    project_id: string;
	    name: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new ScenarioListItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.name = source["name"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

