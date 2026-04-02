import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

const LEVELS = [
  { key: 5, label: "N5" },
  { key: 4, label: "N4" },
  { key: 3, label: "N3" },
  { key: 2, label: "N2" },
  { key: 1, label: "N1" },
];

type DisplayMode = "underline" | "ruby" | "force";

const MODES: Array<{ key: DisplayMode; label: string; desc: string }> = [
  { key: "underline", label: "밑줄", desc: "호버 시 일본어 팝업" },
  { key: "ruby", label: "루비", desc: "한국어 옆에 일본어 표시" },
  { key: "force", label: "강제모드", desc: "한국어를 일본어로 대체" },
];

function Popup() {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<DisplayMode>("underline");
  const [levels, setLevels] = useState<number[]>([2]);

  useEffect(() => {
    chrome.storage.sync.get(["enabled", "displayMode", "levels"], (result) => {
      if (result.enabled !== undefined) setEnabled(result.enabled as boolean);
      if (result.displayMode) setMode(result.displayMode as DisplayMode);
      if (result.levels !== undefined) setLevels(result.levels as number[]);
    });
  }, []);

  const sendToTab = (action: string, value: unknown) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action, value });
      }
    });
  };

  const toggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    chrome.storage.sync.set({ enabled: checked });
    sendToTab("setEnabled", checked);
  };

  const changeMode = (m: DisplayMode) => {
    setMode(m);
    chrome.storage.sync.set({ displayMode: m });
    sendToTab("setDisplayMode", m);
  };

  const toggleLevel = (level: number) => {
    const next = levels.includes(level)
      ? levels.filter((l) => l !== level)
      : [...levels, level];
    setLevels(next);
    chrome.storage.sync.set({ levels: next });
    sendToTab("setLevels", next);
  };

  return (
    <div style={{ width: 260, padding: 16, fontFamily: "sans-serif" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>
        JLPT Hijack
      </h2>

      <label style={labelStyle}>
        <input type="checkbox" checked={enabled} onChange={(e) => toggleEnabled(e.target.checked)} />
        단어 감지
      </label>

      {/* 표시 모드 */}
      <div style={{ marginTop: 10, marginBottom: 4, fontSize: 12, color: "#999" }}>
        표시 모드
      </div>
      <div style={{ display: "flex", gap: 4, opacity: enabled ? 1 : 0.4 }}>
        {MODES.map(({ key, label }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              disabled={!enabled}
              onClick={() => changeMode(key)}
              style={{
                flex: 1,
                padding: "5px 0",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                border: active
                  ? key === "force"
                    ? "2px solid #e63946"
                    : "2px solid #4cc9f0"
                  : "1px solid #555",
                borderRadius: 6,
                background: active
                  ? key === "force"
                    ? "rgba(230, 57, 70, 0.15)"
                    : "rgba(76, 201, 240, 0.15)"
                  : "transparent",
                color: active
                  ? key === "force"
                    ? "#e63946"
                    : "#4cc9f0"
                  : "#888",
                cursor: enabled ? "pointer" : "default",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
        {MODES.find((m) => m.key === mode)?.desc}
      </div>

      {/* 레벨 필터 */}
      <div style={{ marginTop: 12, marginBottom: 4, fontSize: 12, color: "#999" }}>
        레벨 필터
      </div>
      <div style={{ display: "flex", gap: 4, opacity: enabled ? 1 : 0.4 }}>
        {LEVELS.map(({ key, label }) => {
          const active = levels.includes(key);
          return (
            <button
              key={key}
              disabled={!enabled}
              onClick={() => toggleLevel(key)}
              style={{
                flex: 1,
                padding: "4px 0",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                border: active ? "2px solid #4cc9f0" : "1px solid #555",
                borderRadius: 6,
                background: active ? "rgba(76, 201, 240, 0.15)" : "transparent",
                color: active ? "#4cc9f0" : "#888",
                cursor: enabled ? "pointer" : "default",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#666", marginTop: 12 }}>v0.2.0</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
  fontSize: 14,
  cursor: "pointer",
};

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);
