import { useEffect, useState } from 'react';

export default function BotDebugPanel() {
  const [log, setLog] = useState<any[]>([]);

  useEffect(() => {
    const handler = (e: any) => setLog(e.detail);
    window.addEventListener('botdebug', handler);
    return () => window.removeEventListener('botdebug', handler);
  }, []);

  if (log.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 5,
        left: 5,
        right: 5,
        background: 'rgba(0,0,0,0.85)',
        color: '#0f0',
        fontSize: 10,
        fontFamily: 'monospace',
        padding: 6,
        borderRadius: 6,
        zIndex: 9999,
        maxHeight: '40vh',
        overflow: 'auto',
        pointerEvents: 'none',
      }}
    >
      {log.map((entry, i) => (
        <div key={i} style={{ marginBottom: 6, borderBottom: '1px solid #444', paddingBottom: 4 }}>
          <div>
            <b>{entry.colour}</b> dice={entry.dice} → chose <b>{entry.chosen}</b>
          </div>
          {entry.candidates.map((c: any, j: number) => (
            <div key={j} style={{ paddingLeft: 8 }}>
              #{c.id} ({c.pos}) score={c.score} safe={c.safe ? 'Y' : 'N'} bwd={c.backward ? 'Y' : 'N'}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}