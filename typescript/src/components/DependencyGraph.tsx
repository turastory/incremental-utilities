import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ValueRegistry } from '../base/ValueRegistry';
import { FormulaValue } from '../base/Value';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  expression?: string; // Formula expression
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: Node;
  target: Node;
  value: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface DependencyGraphProps {
  valueRegistry: ValueRegistry;
  width?: number;
  height?: number;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  valueRegistry,
  width = 800,
  height = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600
  });

  // 창 크기 변화 감지
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    // Prepare graph data
    const nodes: Node[] = [];
    const nodeMap = new Map<string, Node>();
    const links: Link[] = [];

    // Get dependencies from registry
    valueRegistry.Values.forEach((value, valueId) => {
      // Check if it's a FormulaValue and get the expression
      let expression: string | undefined;
      if (value instanceof FormulaValue) {
        try {
          const formulaValue = value as FormulaValue;
          expression = formulaValue.getExpression?.() || undefined;
        } catch (e) {
          console.error(`Failed to get expression for ${valueId}:`, e);
        }
      }
      
      const node: Node = { 
        id: valueId, 
        group: 1,
        expression 
      };
      nodes.push(node);
      nodeMap.set(valueId, node);
    });

    // 의존성 방향을 반대로 변경: A가 B에 의존하면, 화살표는 B→A로 표시
    valueRegistry.Dependencies.forEach((deps, valueId) => {
      const sourceNode = nodeMap.get(valueId);
      if (!sourceNode) return;

      deps.forEach(dep => {
        let targetNode = nodeMap.get(dep);
        if (!targetNode) {
          targetNode = { id: dep, group: 1 };
          nodes.push(targetNode);
          nodeMap.set(dep, targetNode);
        }

        links.push({
          source: sourceNode,
          target: targetNode,
          value: 1
        });
      });
    });

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    // Add zoom behavior
    const g = svg.append("g");
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      }));

    // Calculate node dimensions - 더 큰 네모 상자로 변경
    const nodeWidth = (d: Node) => Math.max(d.id.length, d.expression?.length || 0) * 10;
    const nodeHeight = 100;
    const nodePadding = 10;

    // Create force simulation
    const simulation = d3.forceSimulation<Node, Link>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(250))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(200 / 1.5));

    // Draw links with correct connection points
    const link = g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value))
      .attr("fill", "none");

    // Draw nodes as rectangles
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", d => `node-group node-${d.id.replace(/[^a-zA-Z0-9]/g, '_')}`)
      .on("click", (event, d) => {
        // 노드 클릭 시 선택 상태 토글
        if (selectedNode === d) {
          setSelectedNode(null);
          d3.selectAll(".node-group").classed("selected", false);
        } else {
          setSelectedNode(d);
          d3.selectAll(".node-group").classed("selected", false);
          d3.select(event.currentTarget).classed("selected", true);
        }
        
        event.stopPropagation(); // Prevent propagation to SVG click handler
      });
      
    // 드래그 기능 추가
    const drag = d3.drag<any, any>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
      
    node.call(drag as any);

    // Add rectangles for nodes
    node.append("rect")
      .attr("width", d => nodeWidth(d))
      .attr("height", nodeHeight)
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", d => {
        // Color nodes based on their type (inferred from ID prefix)
        if (d.id.startsWith("resource_")) return "#4285F4"; // Blue for resources
        if (d.id.startsWith("upgrade_")) return "#EA4335"; // Red for upgrades
        if (d.id.startsWith("feature_")) return "#FBBC05"; // Yellow for features
        if (d.id.includes("_cost_")) return "#34A853"; // Green for costs
        return "#9c27b0"; // Purple for other values
      })
      .attr("fill-opacity", 0.8)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Add ID labels
    node.append("text")
      .text(d => d.id)
      .attr("x", nodePadding)
      .attr("y", nodePadding + 12) // 상단에 ID 표시
      .attr("text-anchor", "start")
      .attr("font-size", "12px")
      .attr("fill", "#fff")
      .attr("font-weight", "bold");

    // Add expression labels (if available)
    node.append("text")
      .text(d => d.expression ? d.expression : "")
      .attr("x", nodePadding)
      .attr("y", nodePadding + 32) // ID 아래에 표현식 표시
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("fill", "#fff")

    // Add arrows to links
    g.append("defs").selectAll("marker")
      .data(["end"])
      .join("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#666")
      .attr("d", "M0,-5L10,0L0,5");

    link.attr("marker-end", "url(#arrow)")
      .attr("stroke-width", 2);

    // Add click handler to clear selected node when clicking on the background
    svg.on("click", () => {
      setSelectedNode(null);
      d3.selectAll(".node-group").classed("selected", false);
    });

    // Add CSS for selected nodes
    const style = document.createElement('style');
    style.textContent = `
      .node-group.selected rect {
        stroke: #333;
        stroke-width: 2;
      }
    `;
    document.head.appendChild(style);

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link.attr("d", d => {
        const sourceNode = d.source as Node;
        const targetNode = d.target as Node;

        const sourceX = sourceNode.x || 0;
        const sourceY = sourceNode.y || 0;
        const targetX = targetNode.x || 0;
        const targetY = targetNode.y || 0;
        
        // 네모 상자의 가장자리에서 연결선 시작/종료
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const angle = Math.atan2(dy, dx);
        
        // 소스 노드의 가장자리 좌표 계산
        let sx = sourceX;
        let sy = sourceY;
        
        // 타겟 노드의 가장자리 좌표 계산
        let tx = targetX;
        let ty = targetY;
        
        // 상자 모서리 처리를 위한 계산 - 단순화된 방식으로 수정
        const sourceHalfWidth = nodeWidth(sourceNode) / 2;
        const targetHalfWidth = nodeWidth(targetNode) / 2;
        const halfHeight = nodeHeight / 2;
        
        // 소스 노드 가장자리 계산
        if (Math.abs(dx) * halfHeight > Math.abs(dy) * sourceHalfWidth) {
          // 좌우 가장자리에 연결
          sx = sourceX + Math.sign(dx) * sourceHalfWidth;
          sy = sourceY + (dy / dx) * Math.sign(dx) * sourceHalfWidth;
        } else {
          // 상하 가장자리에 연결
          sx = sourceX + (dx / dy) * Math.sign(dy) * halfHeight;
          sy = sourceY + Math.sign(dy) * halfHeight;
        }
        
        // 타겟 노드 가장자리 계산
        if (Math.abs(dx) * halfHeight > Math.abs(dy) * targetHalfWidth) {
          // 좌우 가장자리에 연결
          tx = targetX - Math.sign(dx) * targetHalfWidth;
          ty = targetY - (dy / dx) * Math.sign(dx) * targetHalfWidth;
        } else {
          // 상하 가장자리에 연결
          tx = targetX - (dx / dy) * Math.sign(dy) * halfHeight;
          ty = targetY - Math.sign(dy) * halfHeight;
        }
        
        // 곡선 연결선 생성 - 제어점 조정
        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2;
        
        return `M${sx},${sy} Q${midX},${midY} ${tx},${ty}`;
      });

      node.attr("transform", d => `translate(${(d.x || 0) - nodeWidth(d) / 2},${(d.y || 0) - nodeHeight / 2})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      // Clean up the style element when component unmounts
      document.head.removeChild(style);
      simulation.stop();
    };

  }, [valueRegistry, width, height, windowSize]);

  return (
    <div className="dependency-graph-container w-full h-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ border: '1px solid #ccc', borderRadius: '8px' }}
      />
    </div>
  );
};