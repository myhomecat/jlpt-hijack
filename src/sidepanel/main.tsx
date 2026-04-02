import {} from "react";
import { createRoot } from "react-dom/client";

function SidePanel() {
  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>SRS 복습</h2>
      <p style={{ color: "#888" }}>복습할 카드가 없습니다.</p>
      {/* TODO: Week 4에서 플래시카드 복습 UI 구현 */}
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<SidePanel />);
