export namespace ent {
	
	export class NodeEdges {
	    flow?: Flow;
	    outgoing_edges?: Edge[];
	    incoming_edges?: Edge[];
	
	    static createFrom(source: any = {}) {
	        return new NodeEdges(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.flow = this.convertValues(source["flow"], Flow);
	        this.outgoing_edges = this.convertValues(source["outgoing_edges"], Edge);
	        this.incoming_edges = this.convertValues(source["incoming_edges"], Edge);
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
	export class Node {
	    id?: number;
	    type?: string;
	    xyflow_id?: string;
	    data?: Record<string, any>;
	    position_x?: number;
	    position_y?: number;
	    // Go type: time
	    created_at?: any;
	    edges: NodeEdges;
	
	    static createFrom(source: any = {}) {
	        return new Node(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.xyflow_id = source["xyflow_id"];
	        this.data = source["data"];
	        this.position_x = source["position_x"];
	        this.position_y = source["position_y"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.edges = this.convertValues(source["edges"], NodeEdges);
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
	export class FlowEdges {
	    nodes?: Node[];
	    edges?: Edge[];
	
	    static createFrom(source: any = {}) {
	        return new FlowEdges(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodes = this.convertValues(source["nodes"], Node);
	        this.edges = this.convertValues(source["edges"], Edge);
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
	export class Flow {
	    id?: number;
	    name?: string;
	    description?: string;
	    viewport_x?: number;
	    viewport_y?: number;
	    viewport_zoom?: number;
	    // Go type: time
	    created_at?: any;
	    // Go type: time
	    updated_at?: any;
	    edges: FlowEdges;
	
	    static createFrom(source: any = {}) {
	        return new Flow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.viewport_x = source["viewport_x"];
	        this.viewport_y = source["viewport_y"];
	        this.viewport_zoom = source["viewport_zoom"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.edges = this.convertValues(source["edges"], FlowEdges);
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
	export class EdgeEdges {
	    flow?: Flow;
	    source_node?: Node;
	    target_node?: Node;
	
	    static createFrom(source: any = {}) {
	        return new EdgeEdges(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.flow = this.convertValues(source["flow"], Flow);
	        this.source_node = this.convertValues(source["source_node"], Node);
	        this.target_node = this.convertValues(source["target_node"], Node);
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
	export class Edge {
	    id?: number;
	    xyflow_id?: string;
	    type?: string;
	    source_handle?: string;
	    target_handle?: string;
	    data?: Record<string, any>;
	    // Go type: time
	    created_at?: any;
	    edges: EdgeEdges;
	
	    static createFrom(source: any = {}) {
	        return new Edge(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.xyflow_id = source["xyflow_id"];
	        this.type = source["type"];
	        this.source_handle = source["source_handle"];
	        this.target_handle = source["target_handle"];
	        this.data = source["data"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.edges = this.convertValues(source["edges"], EdgeEdges);
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
	
	
	
	
	
	export class SIPServer {
	    id?: number;
	    name?: string;
	    address?: string;
	    port?: number;
	    transport?: string;
	    username?: string;
	    // Go type: time
	    created_at?: any;
	    // Go type: time
	    updated_at?: any;
	
	    static createFrom(source: any = {}) {
	        return new SIPServer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.address = source["address"];
	        this.port = source["port"];
	        this.transport = source["transport"];
	        this.username = source["username"];
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

export namespace handler {
	
	export class CreateServerRequest {
	    name: string;
	    address: string;
	    port: number;
	    transport: string;
	    username: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateServerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.address = source["address"];
	        this.port = source["port"];
	        this.transport = source["transport"];
	        this.username = source["username"];
	        this.password = source["password"];
	    }
	}
	export class Error {
	    code: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Error(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.message = source["message"];
	    }
	}
	export class FlowEdgeData {
	    id: string;
	    source: string;
	    target: string;
	    sourceHandle: string;
	    targetHandle: string;
	    type: string;
	    data: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new FlowEdgeData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.source = source["source"];
	        this.target = source["target"];
	        this.sourceHandle = source["sourceHandle"];
	        this.targetHandle = source["targetHandle"];
	        this.type = source["type"];
	        this.data = source["data"];
	    }
	}
	export class FlowMeta {
	    id: number;
	    name: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FlowMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class FlowNodeData {
	    id: string;
	    type: string;
	    positionX: number;
	    positionY: number;
	    data: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new FlowNodeData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.positionX = source["positionX"];
	        this.positionY = source["positionY"];
	        this.data = source["data"];
	    }
	}
	export class FlowState {
	    flowId: number;
	    name: string;
	    nodes: FlowNodeData[];
	    edges: FlowEdgeData[];
	    viewportX: number;
	    viewportY: number;
	    viewportZoom: number;
	
	    static createFrom(source: any = {}) {
	        return new FlowState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.flowId = source["flowId"];
	        this.name = source["name"];
	        this.nodes = this.convertValues(source["nodes"], FlowNodeData);
	        this.edges = this.convertValues(source["edges"], FlowEdgeData);
	        this.viewportX = source["viewportX"];
	        this.viewportY = source["viewportY"];
	        this.viewportZoom = source["viewportZoom"];
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
	export class Response__sipflow_ent_Flow_ {
	    success: boolean;
	    data?: ent.Flow;
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response__sipflow_ent_Flow_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], ent.Flow);
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response__sipflow_ent_SIPServer_ {
	    success: boolean;
	    data?: ent.SIPServer;
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response__sipflow_ent_SIPServer_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], ent.SIPServer);
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response__sipflow_internal_handler_FlowState_ {
	    success: boolean;
	    data?: FlowState;
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response__sipflow_internal_handler_FlowState_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], FlowState);
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response___map_string_interface____ {
	    success: boolean;
	    data?: any[];
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response___map_string_interface____(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response___sipflow_internal_handler_FlowMeta_ {
	    success: boolean;
	    data?: FlowMeta[];
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response___sipflow_internal_handler_FlowMeta_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], FlowMeta);
	        this.error = this.convertValues(source["error"], Error);
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
	export class SIPServerMeta {
	    id: number;
	    name: string;
	    address: string;
	    port: number;
	    transport: string;
	
	    static createFrom(source: any = {}) {
	        return new SIPServerMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.address = source["address"];
	        this.port = source["port"];
	        this.transport = source["transport"];
	    }
	}
	export class Response___sipflow_internal_handler_SIPServerMeta_ {
	    success: boolean;
	    data?: SIPServerMeta[];
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response___sipflow_internal_handler_SIPServerMeta_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], SIPServerMeta);
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response_bool_ {
	    success: boolean;
	    data?: boolean;
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response_int_ {
	    success: boolean;
	    data?: number;
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response_int_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response_map_string_interface____ {
	    success: boolean;
	    data?: Record<string, any>;
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response_map_string_interface____(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.error = this.convertValues(source["error"], Error);
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
	export class Response_string_ {
	    success: boolean;
	    data?: string;
	    error?: Error;
	
	    static createFrom(source: any = {}) {
	        return new Response_string_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.error = this.convertValues(source["error"], Error);
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
	
	export class SaveFlowRequest {
	    flowId: number;
	    name: string;
	    nodes: FlowNodeData[];
	    edges: FlowEdgeData[];
	    viewportX: number;
	    viewportY: number;
	    viewportZoom: number;
	
	    static createFrom(source: any = {}) {
	        return new SaveFlowRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.flowId = source["flowId"];
	        this.name = source["name"];
	        this.nodes = this.convertValues(source["nodes"], FlowNodeData);
	        this.edges = this.convertValues(source["edges"], FlowEdgeData);
	        this.viewportX = source["viewportX"];
	        this.viewportY = source["viewportY"];
	        this.viewportZoom = source["viewportZoom"];
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
	export class UpdateServerRequest {
	    id: number;
	    name: string;
	    address: string;
	    port: number;
	    transport: string;
	    username: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateServerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.address = source["address"];
	        this.port = source["port"];
	        this.transport = source["transport"];
	        this.username = source["username"];
	        this.password = source["password"];
	    }
	}

}

