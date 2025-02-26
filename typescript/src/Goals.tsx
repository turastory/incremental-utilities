import React, { useState, useEffect, useMemo } from "react";
import data from "../../data/data.json";
import { RawData, GoalData, TriggerData, Condition, GoalEvent } from "./base/GameData";
import { GameState } from "./base/GameState";

// Type assertion for imported data
const gameData = data as RawData;

// Helper type for connected goals/triggers
interface NodeData {
  id: string;
  type: 'goal' | 'trigger';
  data: GoalData | TriggerData;
  next: string[];
  prev: string[];
}

// 이벤트 타입별 색상 및 라벨 정의
const EVENT_STYLES: Record<string, { borderColor: string; bgColor: string; textColor: string; label: string }> = {
  'new_goal': { 
    borderColor: 'border-blue-500', 
    bgColor: 'bg-blue-50', 
    textColor: 'text-blue-600', 
    label: '목표 추가' 
  },
  'feature_unlock': { 
    borderColor: 'border-green-500', 
    bgColor: 'bg-green-50', 
    textColor: 'text-green-600', 
    label: '기능 해금' 
  },
  'core_unlock': { 
    borderColor: 'border-purple-500', 
    bgColor: 'bg-purple-50', 
    textColor: 'text-purple-600', 
    label: '코어 해금' 
  },
  'wait_until': { 
    borderColor: 'border-amber-500', 
    bgColor: 'bg-amber-50', 
    textColor: 'text-amber-600', 
    label: '목표 대기' 
  },
  'log': { 
    borderColor: 'border-gray-500', 
    bgColor: 'bg-gray-50', 
    textColor: 'text-gray-600', 
    label: '로그' 
  },
  'upgrade_unlock': { 
    borderColor: 'border-rose-500', 
    bgColor: 'bg-rose-50', 
    textColor: 'text-rose-600', 
    label: '업그레이드 해금' 
  },
  'resource_unlock': { 
    borderColor: 'border-emerald-500', 
    bgColor: 'bg-emerald-50', 
    textColor: 'text-emerald-600', 
    label: '자원 해금' 
  },
  'resource_add': { 
    borderColor: 'border-teal-500', 
    bgColor: 'bg-teal-50', 
    textColor: 'text-teal-600', 
    label: '자원 추가' 
  },
  'resource_set': { 
    borderColor: 'border-cyan-500', 
    bgColor: 'bg-cyan-50', 
    textColor: 'text-cyan-600', 
    label: '자원 설정' 
  },
  'resource_mult': { 
    borderColor: 'border-lime-500', 
    bgColor: 'bg-lime-50', 
    textColor: 'text-lime-600', 
    label: '자원 배수' 
  },
};

// 기본 스타일 (알 수 없는 이벤트 타입용)
const DEFAULT_EVENT_STYLE = { 
  borderColor: 'border-gray-500', 
  bgColor: 'bg-gray-50', 
  textColor: 'text-gray-600', 
  label: '이벤트' 
};

// 이벤트 타입에 따른 스타일 가져오기
const getEventStyle = (type: string) => {
  return EVENT_STYLES[type] || DEFAULT_EVENT_STYLE;
};

// Condition component - 간소화된 버전
const ConditionItem: React.FC<{ condition: Condition }> = ({ condition }) => {
  const gameState = GameState.getInstance();
  const [totalCost, setTotalCost] = useState<string | null>(null);
  
  useEffect(() => {
    // upgrade_unlocked 조건인 경우 총 비용 계산
    if (condition.type === 'upgrade_unlocked' && condition.targetId) {
      const cost = gameState.totalCost(condition.targetId, parseInt(condition.amount ?? '0'));
      if (cost) {
        setTotalCost(cost.toFixed(4));
      }
    }
  }, [condition]);

  return (
    <div className="py-1 border-l-2 border-yellow-400 pl-2 text-sm">
      <span className="font-medium text-yellow-700">{condition.type}</span>
      {" "}
      <span className="font-medium">{condition.targetId}</span>
      {condition.amount && <span className="text-gray-600"> ≥ {condition.amount}</span>}
      {condition.text && <span className="text-xs text-gray-500 ml-1 italic">({condition.text})</span>}
      {condition.type === 'upgrade_unlocked' && totalCost && (
        <span className="text-xs text-blue-600 ml-2 font-medium">
          필요 비용: {totalCost}
        </span>
      )}
    </div>
  );
};

// Event component - 간소화된 버전
const EventItem: React.FC<{ event: GoalEvent }> = ({ event }) => {
  const { borderColor, bgColor, textColor, label } = getEventStyle(event.type);
  
  return (
    <div className={`py-1 border-l-2 ${borderColor} pl-2 text-sm`}>
      <div className="flex flex-wrap items-center gap-1">
        <span className={`font-medium ${textColor} ${bgColor} px-1.5 py-0.5 rounded text-xs`}>
          {label}
        </span>
        
        {event.id && (
          <span className="font-medium">
            {event.id}
          </span>
        )}
        
        {event.who && event.text && (
          <span className="text-gray-700">
            "{event.who}: {event.text}"
          </span>
        )}
        
        {event.delay && (
          <span className="text-xs text-gray-500">
            (지연: {event.delay})
          </span>
        )}
        
        {event.conditions && event.conditions.length > 0 && (
          <span className="text-xs text-gray-500">
            (조건: {event.conditions.join(', ')})
          </span>
        )}
      </div>
    </div>
  );
};

// Conditions section component - 간소화된 버전
const ConditionsSection: React.FC<{ conditions: Condition[] }> = ({ conditions }) => {
  if (conditions.length === 0) return null;
  
  return (
    <div className="mb-3">
      <h3 className="text-sm font-medium text-gray-700 border-b pb-1 mb-1">필요 조건</h3>
      <div className="space-y-0.5">
        {conditions.map((condition, idx) => (
          <ConditionItem key={idx} condition={condition} />
        ))}
      </div>
    </div>
  );
};

// Events section component - 간소화된 버전
const EventsSection: React.FC<{ events: GoalEvent[] }> = ({ events }) => {
  if (events.length === 0) return null;
  
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 border-b pb-1 mb-1">이벤트</h3>
      <div className="space-y-0.5">
        {events.map((event, idx) => (
          <EventItem key={idx} event={event} />
        ))}
      </div>
    </div>
  );
};

// Node component - 간소화된 버전
const NodeCard: React.FC<{ 
  node: NodeData; 
  isCollapsed: boolean;
  onToggle: () => void;
}> = ({ node, isCollapsed, onToggle }) => {
  const bgColor = node.type === 'goal' ? 'bg-blue-50' : 'bg-green-50';
  const headerBgColor = node.type === 'goal' ? 'bg-blue-100' : 'bg-green-100';
  const icon = node.type === 'goal' ? '🎯' : '⚡';
  
  return (
    <div className={`rounded-md shadow-sm overflow-hidden ${bgColor}`}>
      <div 
        className={`flex justify-between items-center p-2 cursor-pointer ${headerBgColor}`}
        onClick={onToggle}
      >
        <h2 className="text-base font-medium flex items-center">
          {icon} <span className="ml-1">{node.id}</span>
        </h2>
        <span className={`transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {!isCollapsed && (
        <div className="p-2 text-sm">
          <ConditionsSection conditions={node.data.conditions} />
          <EventsSection events={node.data.events} />
          
          {node.data.conditions.length === 0 && node.data.events.length === 0 && (
            <p className="text-xs text-gray-500 italic">데이터 없음</p>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to build the connected graph
const buildConnectedGraph = (gameData: RawData): NodeData[] => {
  const nodes = new Map<string, NodeData>();
  
  // Initialize nodes with goals
  gameData.goals.forEach(goal => {
    nodes.set(goal.id, {
      id: goal.id,
      type: 'goal',
      data: goal,
      next: [],
      prev: []
    });
  });

  // Initialize nodes with triggers
  gameData.triggers.forEach(trigger => {
    nodes.set(trigger.id, {
      id: trigger.id,
      type: 'trigger',
      data: trigger,
      next: [],
      prev: []
    });
  });

  // Connect nodes based on new_goal events
  nodes.forEach(node => {
    const events = node.data.events;
    events.forEach(event => {
      if (event.type === 'new_goal' && event.id) {
        // This node points to the goal with event.id
        node.next.push(event.id);
        
        // Update the target goal's prev array
        const targetNode = nodes.get(event.id);
        if (targetNode) {
          targetNode.prev.push(node.id);
        }
      }
    });
  });

  // Sort nodes in connected order
  const sortedNodes: NodeData[] = [];
  const visited = new Set<string>();

  // Find root nodes (nodes with no predecessors)
  const rootNodes = Array.from(nodes.values()).filter(node => node.prev.length === 0);

  // Depth-first traversal function
  const traverse = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.get(nodeId);
    if (node) {
      sortedNodes.push(node);
      node.next.forEach(nextId => traverse(nextId));
    }
  };

  // Start traversal from each root node
  rootNodes.forEach(node => traverse(node.id));

  // Add any remaining nodes that weren't connected
  nodes.forEach((node, id) => {
    if (!visited.has(id)) {
      sortedNodes.push(node);
    }
  });

  return sortedNodes;
};

// Main component
export default function Goals() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Toggle collapse state for a node
  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  useEffect(() => {
    const state = GameState.getInstance();
    setGameState(state);

    // Initialize game state with data
    const initGame = async () => {
      try {
        await state.initialize(gameData);
        setInitialized(true);
      } catch (error) {
        console.error("Failed to initialize game state:", error);
      } finally {
        setLoading(false);
      }
    };

    initGame();

    // Set up update interval
    const interval = setInterval(() => {
      if (initialized) {
        state.update(0.1); // Update every 100ms
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Build the connected graph of goals and triggers
  const connectedNodes = useMemo(() => {
    if (!gameState || !initialized) return [];
    return buildConnectedGraph(gameData);
  }, [gameState, initialized]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-700 mb-2">로딩 중...</h2>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-600">
          <h2 className="text-xl font-bold mb-2">오류 발생</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">목표 및 트리거 데이터</h1>
      
      <div className="space-y-2">
        {connectedNodes.map(node => (
          <NodeCard 
            key={node.id}
            node={node}
            isCollapsed={!!collapsedNodes[node.id]}
            onToggle={() => toggleCollapse(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
