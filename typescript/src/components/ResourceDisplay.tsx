import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GameState } from '../base/GameState';

interface ResourceDisplayProps {
  resourceId: string;
}

interface DataPoint {
  time: number;
  value: number;
}

export function ResourceDisplay({ resourceId }: ResourceDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dataRef = useRef<DataPoint[]>([]);

  useEffect(() => {
    const gameState = GameState.getInstance();
    const resource = gameState.getResource(resourceId);
    if (!resource || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const line = d3.line<DataPoint>()
      .x((d: DataPoint) => x(d.time))
      .y((d: DataPoint) => y(d.value));

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(y));

    // Add title
    g.append('text')
      .attr('x', width / 2)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(resource.name);

    const updateChart = () => {
      const now = Date.now();
      const value = gameState.Registry.get(resourceId).getValue(gameState.Registry).toNumber();
      
      dataRef.current.push({ time: now, value });
      if (dataRef.current.length > 100) {
        dataRef.current.shift();
      }

      const xDomain = d3.extent(dataRef.current, (d: DataPoint) => d.time) as [number, number];
      const yDomain = d3.extent(dataRef.current, (d: DataPoint) => d.value) as [number, number];

      x.domain(xDomain);
      y.domain([0, yDomain[1] * 1.1]); // Add 10% padding to the top

      g.select('.line')
        .datum(dataRef.current)
        .attr('d', line);
    };

    // Add path
    g.append('path')
      .datum(dataRef.current)
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5);

    const interval = setInterval(updateChart, 100);

    return () => clearInterval(interval);
  }, [resourceId]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <svg ref={svgRef} width="600" height="400" />
    </div>
  );
} 