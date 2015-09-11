// Graph.js

(function () {
	// Basic graph impl
	var Graph = this.Graph = function () {
		this.edges = {};	// map of edge ids to an array of connected node ids
		this.nodes = {}; 	// map of node ids to node data
	};
	// Connect node id `first` to node id `second` (two way connection; could be one way)
	Graph.prototype.connect = function (first, second) {
		this.addEdge(first, second);
		this.addEdge(second, first);
	};
	Graph.prototype.addConnections(node, connectedNodes) {
		connectedNodes.forEach(function (connectedNode) {
			this.connect(node, connectedNode);
		}, this);
	};
	Graph.prototype.addEdge = function (from, to) {
		var i = from.getId(), j = to.getId();
		if (!this.edges[i]) {
			this.edges[i] = {}; // pseudo-set
		}
		assert(this.edges[i][j] ? this.edges[i][j] == to : true);
		this.edges[i][j] = to;
	};
	Graph.prototype.addNode = function (node) {
		this.nodes[node.getId()] = node;
	};
	Graph.prototype.deleteNode = function (nodeId) {
		if (this.nodes[nodeId]) {
			// Delete connections
			this.iterConnectedNodes(nodeId, function (connectedNode, connectedNodeId) {
				if (this.nodes[connectedNodeId] && this.nodes[connectedNodeId][nodeId]) {
					delete this.nodes[connectedNodeId][nodeId];
				}
			}, this);

			// Remove node
			this.nodes[nodeId].destroy();
			delete this.nodes[nodeId];
		} else {
			assert(!this.edges[nodeId]);
		}
	};
	Graph.prototype.getNode = function (nodeId) {
		return this.nodes[nodeId];
	};
	// Iterates over all directly connected nodes
	Graph.prototype.iterConnectedNodes = function (nodeId, callback, context) {
		if (this.edges[nodeId]) {
			this.edges[nodeId].forEach(function (connectedNode) {
				callback.call(context || this, connectedNode, connectedNode.getId());
			});
		}
	};
	// Visits all connected nodes once. Depth first traversal. (Breadth first would be more complicated)
	Graph.prototype.visitConnected = function (startNode, callback, context) {
		var visited = {};
		function iterConnected (id) {
			this.iterConnectedNodes(id, function (connected, connectedId) {
				if (!visited[connectedId()]) {
					visited[connectedId] = true;
					callback.call(context || this, connected, connectedId);
					iterConnected(connectedId);
				}
			}, this);
		}
		visited[startNode.getId()] = true;
		iterConnected(startNode.getId());
	}
	Graph.prototype.iterEachNode = function (callback, context) {
		this.nodes.forEach(function (node, id) {
			callback.call(context || this, node, id, this);
		}, this);
	}




	// POD-ish node type
	var Node = this.Node = function () {
		// ...
	}
	Node.prototype.getId = function () {
		// ...
	}

})();