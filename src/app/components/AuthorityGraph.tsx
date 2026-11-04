// Authority Graph Visualization - Mind Map with Zoom
import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { AuthorityGraphNode } from '../services/authorityHub/types';

interface AuthorityGraphProps {
  nodes: AuthorityGraphNode[];
  onNodeClick?: (node: AuthorityGraphNode) => void;
}

const sourceColors: Record<string, string> = {
  LOC: '#dc2626',      // Red
  VIAF: '#2563eb',     // Blue
  Wikidata: '#16a34a', // Green
  AfIqa: '#9333ea',    // Purple
  ISBNdb: '#ea580c'    // Orange (ISBNdb nodes had no colour, so their badge was blank)
};

export function AuthorityGraph({ nodes: authorityNodes, onNodeClick }: AuthorityGraphProps) {
  // Safely handle undefined/null nodes
  const safeNodes = authorityNodes || [];
  
  // Debug logging
  console.log('[AuthorityGraph] Received nodes:', safeNodes);
  console.log('[AuthorityGraph] Node count:', safeNodes.length);

  // Convert AuthorityGraphNode to ReactFlow nodes
  const flowNodes: Node[] = useMemo(() => {
    console.log('[AuthorityGraph] Building flow nodes...');
    return safeNodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      position: calculatePosition(index, safeNodes.length),
      data: { 
        label: (
          <div className="flex flex-col items-center">
            <div className="font-semibold text-sm text-gray-900">{node.label}</div>
            <div 
              className="text-xs px-2 py-1 rounded mt-1" 
              style={{ 
                backgroundColor: sourceColors[node.source],
                color: 'white'
              }}
            >
              {node.source}
            </div>
          </div>
        ),
        node 
      },
      style: {
        background: 'rgba(255, 255, 255, 0.95)',
        border: `2px solid ${sourceColors[node.source]}`,
        borderRadius: 8,
        padding: 10,
        minWidth: 150,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left
    }));
  }, [safeNodes]);

  // Convert connections to ReactFlow edges
  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    const processed = new Set<string>();

    safeNodes.forEach(node => {
      node.connections.forEach(conn => {
        const edgeId = [conn.from, conn.to].sort().join('-');
        if (processed.has(edgeId)) return;
        processed.add(edgeId);

        edges.push({
          id: edgeId,
          source: conn.from,
          target: conn.to,
          label: conn.relationship,
          type: 'smoothstep',
          animated: true,
          style: { 
            stroke: '#94a3b8',
            strokeWidth: 2
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8'
          },
          labelStyle: {
            fontSize: 10,
            fill: '#475569'
          }
        });
      });
    });

    console.log('[AuthorityGraph] Built edges:', edges.length);
    return edges;
  }, [safeNodes]);

  const [nodes, , onNodesChange] = useNodesState(flowNodes);
  const [edges, , onEdgesChange] = useEdgesState(flowEdges);

  const handleNodeClick = useCallback((event: any, node: Node) => {
    const authorityNode = node.data.node as AuthorityGraphNode;
    console.log('[AuthorityGraph] Node clicked:', authorityNode);
    if (onNodeClick) {
      onNodeClick(authorityNode);
    }
  }, [onNodeClick]);

  if (safeNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <p className="text-gray-500 text-sm">No authority connections to display</p>
          <p className="text-gray-400 text-xs mt-1">Search for a person to see authority graph</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full border rounded-lg overflow-hidden shadow-sm bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const source = node.data?.node?.source as keyof typeof sourceColors;
            return sourceColors[source] || '#94a3b8';
          }}
          nodeStrokeWidth={3}
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-md border">
        <div className="text-xs font-semibold mb-2">Authority Sources</div>
        <div className="space-y-1">
          {Object.entries(sourceColors).map(([source, color]) => (
            <div key={source} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">{source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Calculate circular layout positions
function calculatePosition(index: number, total: number): { x: number; y: number } {
  const radius = 250;
  const centerX = 400;
  const centerY = 300;

  if (total === 1) {
    return { x: centerX, y: centerY };
  }

  const angle = (index * 2 * Math.PI) / total;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
}