interface StatusTerminalProps {
  messages: string[];
  className?: string;
}

export default function StatusTerminal({ messages, className = '' }: StatusTerminalProps) {
  return (
    <div className={`status-terminal flex flex-wrap gap-x-6 gap-y-1 ${className}`}>
      {messages.map((msg, i) => (
        <span key={i} className="data-stream" style={{ animationDelay: `${i * 0.3}s` }}>
          {msg}
        </span>
      ))}
    </div>
  );
}
