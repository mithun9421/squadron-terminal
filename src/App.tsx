import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Sidebar } from "./sidebar/Sidebar";
import { TerminalView } from "./terminal/TerminalView";
import { useSessionList } from "./sessions/useSessionList";

function App() {
  const { sessions, spawnShell, spawnAgent, close } = useSessionList();
  const [activeId, setActiveId] = useState<number | null>(null);
  const agentCounterRef = useRef(0);

  useEffect(() => {
    const activeStillExists = sessions.some((session) => session.id === activeId);
    if (activeId !== null && activeStillExists) {
      return;
    }
    setActiveId(sessions.length > 0 ? sessions[0].id : null);
  }, [sessions, activeId]);

  const handleNewShell = () => {
    spawnShell()
      .then(setActiveId)
      .catch(() => {
        // Nothing to surface here yet — no pane exists for a failed spawn.
      });
  };

  const handleNewAgent = (cwd: string) => {
    agentCounterRef.current += 1;
    const label = `Agent ${agentCounterRef.current}`;
    spawnAgent(label, cwd)
      .then(setActiveId)
      .catch(() => {
        // Same as above.
      });
  };

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNewShell={handleNewShell}
        onNewAgent={handleNewAgent}
        onClose={close}
      />
      <div className="app-layout__panes">
        {sessions.map((session) => (
          <TerminalView key={session.id} sessionId={session.id} visible={session.id === activeId} />
        ))}
      </div>
    </div>
  );
}

export default App;
