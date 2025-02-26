import React, { useEffect, useRef } from "react";
import { ValueRegistry } from "../base/ValueRegistry";
import { ResourceValue } from "../base/Value";
// p5를 정적으로 임포트하지 않고 동적으로 임포트할 예정입니다
// import P5 from "p5";
import type P5 from "p5"; // 타입만 임포트

// 상수 정의
const COLORS = {
  BACKGROUND: "#f8f9fa",
  BORDER: "#ccc",
  TEXT_DARK: "#333",
  TEXT_LIGHT: "#666",
  NODE_DEFAULT: "#9c27b0",
  NODE_RESOURCE: "#4285F4",
  NODE_UPGRADE: "#EA4335",
  NODE_FEATURE: "#FBBC05",
  BUTTON_ZOOM_IN: "#4285F4",
  BUTTON_ZOOM_OUT: "#EA4335",
  BUTTON_ROTATE_CCW: "#FBBC05",
  BUTTON_ROTATE_CW: "#34A853",
  LINE_DEFAULT: "#ddd",
  PANEL_BG: "#fff",
};

const ZOOM = {
  MIN: 0.5,
  MAX: 3,
  STEP_MOUSE: 1.1,
  STEP_BUTTON: 1.2,
};

const ROTATION = {
  STEP: 0.1,
};

const UI = {
  CONTROL_PANEL_X: 20,
  CONTROL_PANEL_Y: 20,
  CONTROL_PANEL_WIDTH: 40,
  CONTROL_PANEL_HEIGHT: 80,
  CONTROL_PANEL_RADIUS: 5,
  BUTTON_SIZE: 20,
  BUTTON_RADIUS: 3,
  BUTTON_MARGIN: 10,
  INFO_PANEL_WIDTH: 200,
  INFO_PANEL_HEIGHT: 100,
  INFO_PANEL_MARGIN: 20,
};

// 타입 정의
interface NodeArea {
  id: string;
  x: number;
  y: number;
  radius: number;
}

interface P5VisualizationProps {
  valueRegistry: ValueRegistry;
  width?: number;
  height?: number;
}

export const P5Visualization: React.FC<P5VisualizationProps> = ({
  valueRegistry,
  width = 800,
  height = 600,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<P5 | null>(null);
  const canvasRef = useRef<P5.Renderer | null>(null);

  useEffect(() => {
    // 클라이언트 사이드에서만 실행되도록 확인
    if (typeof window === 'undefined') return;

    const loadP5 = async () => {
      try {
        // 동적으로 p5 임포트
        const P5 = (await import('p5')).default;

        // 이전 p5 인스턴스 정리
        if (p5Ref.current) {
          p5Ref.current.remove();
          p5Ref.current = null;
        }

        // 새 p5 인스턴스 생성
        const sketch = (p: P5) => {
          // 상태 변수
          let selectedNodeId: string | null = null;
          let rotation = 0;
          let zoom = 1;
          let isDragging = false;
          let dragStartX = 0;
          let dragStartY = 0;
          let offsetX = 0;
          let offsetY = 0;

          // 캔버스 설정
          p.setup = () => {
            const canvas = p.createCanvas(width, height);
            canvasRef.current = canvas;
            p.frameRate(30);
            p.textAlign(p.CENTER);
          };

          // 매 프레임마다 그리기
          p.draw = () => {
            p.background(COLORS.BACKGROUND);

            // 값 레지스트리에서 데이터 가져오기
            const filteredValues = getFilteredValues();

            // 변환 적용
            p.push();
            p.translate(p.width / 2 + offsetX, p.height / 2 + offsetY);
            p.scale(zoom);
            p.rotate(rotation);

            // 원형 시각화 그리기
            drawCircularVisualization(p, filteredValues, selectedNodeId);

            p.pop();

            // UI 요소 그리기
            drawUI(p, selectedNodeId);
          };

          // 값 필터링 함수
          const getFilteredValues = () => {
            const values = Array.from(valueRegistry.Values.entries());
            return values.filter(
              ([id]) =>
                !id.includes("_delta") &&
                !id.includes("_base") &&
                !id.includes("_mult") &&
                !id.includes("_flat") &&
                !id.includes("_calculated") &&
                !id.includes("_cost") &&
                !id.includes("_reveal") &&
                !id.includes("_activate")
            );
          };

          // UI 요소 그리기
          const drawUI = (p: P5, selectedId: string | null) => {
            drawControlPanels(p);
            if (selectedId) {
              drawSelectedNodeInfo(p, selectedId);
            }
          };

          // 컨트롤 패널 그리기
          const drawControlPanels = (p: P5) => {
            p.push();

            // 줌 컨트롤
            drawControlPanel(p, UI.CONTROL_PANEL_X, UI.CONTROL_PANEL_Y);

            // 줌 인 버튼
            drawControlButton(
              p,
              UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
              UI.CONTROL_PANEL_Y + UI.BUTTON_MARGIN,
              COLORS.BUTTON_ZOOM_IN,
              "+"
            );

            // 줌 아웃 버튼
            drawControlButton(
              p,
              UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
              UI.CONTROL_PANEL_Y + UI.BUTTON_MARGIN * 5,
              COLORS.BUTTON_ZOOM_OUT,
              "-"
            );

            // 회전 컨트롤
            drawControlPanel(
              p,
              UI.CONTROL_PANEL_X,
              UI.CONTROL_PANEL_Y + UI.CONTROL_PANEL_HEIGHT + UI.BUTTON_MARGIN
            );

            // 반시계 회전 버튼
            drawControlButton(
              p,
              UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
              UI.CONTROL_PANEL_Y + UI.CONTROL_PANEL_HEIGHT + UI.BUTTON_MARGIN * 2,
              COLORS.BUTTON_ROTATE_CCW,
              "↺"
            );

            // 시계 회전 버튼
            drawControlButton(
              p,
              UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
              UI.CONTROL_PANEL_Y + UI.CONTROL_PANEL_HEIGHT + UI.BUTTON_MARGIN * 6,
              COLORS.BUTTON_ROTATE_CW,
              "↻"
            );

            p.pop();
          };

          // 컨트롤 패널 그리기 헬퍼 함수
          const drawControlPanel = (p: P5, x: number, y: number) => {
            p.fill(COLORS.PANEL_BG);
            p.stroke(COLORS.BORDER);
            p.rect(
              x,
              y,
              UI.CONTROL_PANEL_WIDTH,
              UI.CONTROL_PANEL_HEIGHT,
              UI.CONTROL_PANEL_RADIUS
            );
          };

          // 컨트롤 버튼 그리기 헬퍼 함수
          const drawControlButton = (
            p: P5,
            x: number,
            y: number,
            color: string,
            label: string
          ) => {
            p.fill(color);
            p.noStroke();
            p.rect(x, y, UI.BUTTON_SIZE, UI.BUTTON_SIZE, UI.BUTTON_RADIUS);
            p.fill(COLORS.PANEL_BG);
            p.textSize(16);
            p.text(label, x + UI.BUTTON_SIZE / 2, y + UI.BUTTON_SIZE / 2 + 5);
          };

          // 선택된 노드 정보 패널 그리기
          const drawSelectedNodeInfo = (p: P5, nodeId: string) => {
            const value = valueRegistry.Values.get(nodeId);
            if (!value) return;

            p.push();

            // 패널 배경
            p.fill(COLORS.PANEL_BG);
            p.stroke(COLORS.BORDER);
            p.rect(
              p.width - UI.INFO_PANEL_WIDTH - UI.INFO_PANEL_MARGIN,
              UI.INFO_PANEL_MARGIN,
              UI.INFO_PANEL_WIDTH,
              UI.INFO_PANEL_HEIGHT,
              UI.CONTROL_PANEL_RADIUS
            );

            // 노드 ID
            p.fill(COLORS.TEXT_DARK);
            p.noStroke();
            p.textSize(14);
            p.textAlign(p.CENTER);
            p.text(
              nodeId,
              p.width - UI.INFO_PANEL_WIDTH / 2 - UI.INFO_PANEL_MARGIN,
              UI.INFO_PANEL_MARGIN + 20
            );

            // 노드 타입
            p.textSize(12);
            p.text(
              "Type: " + getValueType(nodeId),
              p.width - UI.INFO_PANEL_WIDTH / 2 - UI.INFO_PANEL_MARGIN,
              UI.INFO_PANEL_MARGIN + 40
            );

            // 노드 값 또는 수식
            displayValueOrFormula(p, value, nodeId);

            p.pop();
          };

          // 값 또는 수식 표시
          const displayValueOrFormula = (p: P5, value: any, nodeId: string) => {
            if (value instanceof ResourceValue) {
              try {
                const currentValue = value.getValue(valueRegistry).toString();
                p.text(
                  "Value: " + currentValue,
                  p.width - UI.INFO_PANEL_WIDTH / 2 - UI.INFO_PANEL_MARGIN,
                  UI.INFO_PANEL_MARGIN + 60
                );
              } catch (e) {
                p.text(
                  "Value: Error",
                  p.width - UI.INFO_PANEL_WIDTH / 2 - UI.INFO_PANEL_MARGIN,
                  UI.INFO_PANEL_MARGIN + 60
                );
              }
            } else {
              try {
                // getExpression 메서드 존재 여부로 확인
                const hasExpression =
                  "getExpression" in value &&
                  typeof value.getExpression === "function";
                if (hasExpression) {
                  const expression = value.getExpression() || "N/A";
                  p.text(
                    "Formula: " +
                      (expression.length > 20
                        ? expression.substring(0, 17) + "..."
                        : expression),
                    p.width - UI.INFO_PANEL_WIDTH / 2 - UI.INFO_PANEL_MARGIN,
                    UI.INFO_PANEL_MARGIN + 60
                  );
                }
              } catch (e) {
                p.text(
                  "Formula: Error",
                  p.width - UI.INFO_PANEL_WIDTH / 2 - UI.INFO_PANEL_MARGIN,
                  UI.INFO_PANEL_MARGIN + 60
                );
              }
            }
          };

          // 값 유형 반환
          const getValueType = (id: string): string => {
            if (id.startsWith("resource_")) return "Resource";
            if (id.startsWith("upgrade_")) return "Upgrade";
            if (id.startsWith("feature_")) return "Feature";
            if (id.includes("_cost_")) return "Cost";
            return "Other";
          };

          // 원형 시각화 함수
          const drawCircularVisualization = (
            p: P5,
            values: [string, any][],
            selectedId: string | null
          ) => {
            const maxRadius = Math.min(p.width, p.height) * 0.35;

            // 배경 원 그리기
            drawBackgroundCircle(p, maxRadius);

            // 값들을 원형으로 배치
            const angleStep = (2 * Math.PI) / values.length;

            // 노드 그리기
            values.forEach(([id, value], index) => {
              drawNode(p, id, value, index, angleStep, maxRadius, selectedId);
            });

            // 중심 노드 그리기
            drawCenterNode(p, values.length);
          };

          // 배경 원 그리기
          const drawBackgroundCircle = (p: P5, radius: number) => {
            p.push();
            p.noFill();
            p.stroke(COLORS.LINE_DEFAULT);
            p.strokeWeight(1);
            p.ellipse(0, 0, radius * 2, radius * 2);
            p.pop();
          };

          // 중심 노드 그리기
          const drawCenterNode = (p: P5, valueCount: number) => {
            p.push();
            p.fill(COLORS.TEXT_DARK);
            p.ellipse(0, 0, 80, 80);
            p.fill(COLORS.PANEL_BG);
            p.textSize(12);
            p.text("Values", 0, 0);
            p.textSize(8);
            p.text(`${valueCount} items`, 0, 15);
            p.pop();
          };

          // 노드 그리기
          const drawNode = (
            p: P5,
            id: string,
            value: any,
            index: number,
            angleStep: number,
            maxRadius: number,
            selectedId: string | null
          ) => {
            const angle = index * angleStep;
            const x = Math.cos(angle) * maxRadius;
            const y = Math.sin(angle) * maxRadius;

            // 노드 스타일 결정
            const isSelected = id === selectedId;
            const nodeColor = getNodeColor(id);
            const nodeSize = isSelected ? 70 : 60;
            const nodeRadius = nodeSize / 2;

            // 노드 그리기
            p.push();
            p.fill(nodeColor);
            p.stroke(isSelected ? COLORS.TEXT_DARK : COLORS.PANEL_BG);
            p.strokeWeight(isSelected ? 3 : 2);
            p.ellipse(x, y, nodeSize, nodeSize);

            // 노드 ID 표시
            p.fill(COLORS.PANEL_BG);
            p.textSize(isSelected ? 12 : 10);
            p.text(id, x, y);

            // 값이 ResourceValue인 경우 현재 값 표시
            if (value instanceof ResourceValue) {
              try {
                const currentValue = value.getValue(valueRegistry).toString();
                p.textSize(isSelected ? 10 : 8);
                p.text(currentValue, x, y + 15);
              } catch (e) {
                console.error(`Failed to get value for ${id}:`, e);
              }
            }
            p.pop();

            // 중심에서 노드로 선 그리기
            p.push();
            p.stroke(isSelected ? nodeColor : COLORS.LINE_DEFAULT);
            p.strokeWeight(isSelected ? 2 : 1);
            p.line(0, 0, x, y);
            p.pop();

            // 노드 클릭 감지
            checkNodeClick(p, x, y, nodeRadius, id);
          };

          // 노드 색상 가져오기
          const getNodeColor = (id: string): string => {
            if (id.startsWith("resource_")) return COLORS.NODE_RESOURCE;
            if (id.startsWith("upgrade_")) return COLORS.NODE_UPGRADE;
            if (id.startsWith("feature_")) return COLORS.NODE_FEATURE;
            return COLORS.NODE_DEFAULT;
          };

          // 노드 클릭 감지
          const checkNodeClick = (
            p: P5,
            x: number,
            y: number,
            radius: number,
            id: string
          ) => {
            if (p.mouseIsPressed && !isDragging) {
              const mouseXTransformed = (p.mouseX - p.width / 2 - offsetX) / zoom;
              const mouseYTransformed =
                (p.mouseY - p.height / 2 - offsetY) / zoom;

              // 회전 적용
              const cosR = Math.cos(-rotation);
              const sinR = Math.sin(-rotation);
              const rotatedX =
                mouseXTransformed * cosR - mouseYTransformed * sinR;
              const rotatedY =
                mouseXTransformed * sinR + mouseYTransformed * cosR;

              const distance = Math.sqrt(
                Math.pow(rotatedX - x, 2) + Math.pow(rotatedY - y, 2)
              );
              if (distance < radius) {
                selectedNodeId = id;
              }
            }
          };

          // 마우스 이벤트 처리
          p.mousePressed = () => {
            // 줌 컨트롤 클릭 감지
            if (
              isButtonClicked(
                p,
                UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
                UI.CONTROL_PANEL_Y + UI.BUTTON_MARGIN
              )
            ) {
              // 확대
              zoom = Math.min(zoom * ZOOM.STEP_BUTTON, ZOOM.MAX);
              return;
            }

            if (
              isButtonClicked(
                p,
                UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
                UI.CONTROL_PANEL_Y + UI.BUTTON_MARGIN * 5
              )
            ) {
              // 축소
              zoom = Math.max(zoom / ZOOM.STEP_BUTTON, ZOOM.MIN);
              return;
            }

            // 회전 컨트롤 클릭 감지
            if (
              isButtonClicked(
                p,
                UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
                UI.CONTROL_PANEL_Y +
                  UI.CONTROL_PANEL_HEIGHT +
                  UI.BUTTON_MARGIN * 2
              )
            ) {
              // 반시계 방향 회전
              rotation -= ROTATION.STEP;
              return;
            }

            if (
              isButtonClicked(
                p,
                UI.CONTROL_PANEL_X + UI.BUTTON_MARGIN,
                UI.CONTROL_PANEL_Y +
                  UI.CONTROL_PANEL_HEIGHT +
                  UI.BUTTON_MARGIN * 6
              )
            ) {
              // 시계 방향 회전
              rotation += ROTATION.STEP;
              return;
            }

            // 드래그 시작
            isDragging = true;
            dragStartX = p.mouseX;
            dragStartY = p.mouseY;
          };

          // 버튼 클릭 감지 헬퍼 함수
          const isButtonClicked = (p: P5, x: number, y: number): boolean => {
            return (
              p.mouseX >= x &&
              p.mouseX <= x + UI.BUTTON_SIZE &&
              p.mouseY >= y &&
              p.mouseY <= y + UI.BUTTON_SIZE
            );
          };

          // 마우스 드래그 이벤트
          p.mouseDragged = () => {
            if (isDragging) {
              offsetX += (p.mouseX - dragStartX) / zoom;
              offsetY += (p.mouseY - dragStartY) / zoom;
              dragStartX = p.mouseX;
              dragStartY = p.mouseY;
            }
          };

          // 마우스 릴리즈 이벤트
          p.mouseReleased = () => {
            isDragging = false;
          };

          // 마우스 휠 이벤트
          p.mouseWheel = (event: any) => {
            const e = event.delta;
            if (e > 0) {
              zoom = Math.max(zoom / ZOOM.STEP_MOUSE, ZOOM.MIN);
            } else {
              zoom = Math.min(zoom * ZOOM.STEP_MOUSE, ZOOM.MAX);
            }
            return false; // 페이지 스크롤 방지
          };
        };

        // p5 인스턴스 생성 및 저장
        if (containerRef.current) {
          p5Ref.current = new P5(sketch, containerRef.current);
        }
      } catch (error) {
        console.error('Error loading p5.js:', error);
        // 에러 메시지 표시
        showErrorMessage();
      }
    };

    // 에러 메시지 표시 함수
    const showErrorMessage = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100%; background-color: ${COLORS.BACKGROUND}; border-radius: 8px; border: 1px solid ${COLORS.BORDER};">
            <div style="text-align: center; padding: 20px;">
              <h3 style="margin-bottom: 10px; color: ${COLORS.TEXT_DARK};">p5.js library is required</h3>
              <p style="color: ${COLORS.TEXT_LIGHT};">Please install with: <code>npm install p5 @types/p5</code></p>
            </div>
          </div>
        `;
      }
    };

    loadP5();

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (p5Ref.current) {
        p5Ref.current.remove();
        p5Ref.current = null;
      }
    };
  }, [valueRegistry, width, height]);

  return (
    <div className="p5-visualization-container w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ border: `1px solid ${COLORS.BORDER}`, borderRadius: "8px" }}
      />
    </div>
  );
};
