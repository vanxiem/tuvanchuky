@import "tailwindcss";
@plugin "@tailwindcss/typography";

:root {
  --color-ai-bg: #020617;
  --color-ai-surface: #0f172a;
  --color-ai-accent: #3b82f6;
  --color-ai-glow: rgba(59, 130, 246, 0.2);
  --color-ai-text: #93c5fd;
  --color-ai-text-muted: #60a5fa;
  --color-ai-border: rgba(59, 130, 246, 0.2);
}

.light-mode {
  --color-ai-bg: #f8fafc;
  --color-ai-surface: #ffffff;
  --color-ai-accent: #2563eb;
  --color-ai-glow: rgba(37, 99, 235, 0.1);
  --color-ai-text: #1e293b;
  --color-ai-text-muted: #475569;
  --color-ai-border: rgba(37, 99, 235, 0.1);
}

@theme {
  --color-ai-bg: var(--color-ai-bg);
  --color-ai-surface: var(--color-ai-surface);
  --color-ai-accent: var(--color-ai-accent);
  --color-ai-glow: var(--color-ai-glow);
}

body {
  background-color: var(--color-ai-bg);
  color: var(--color-ai-text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.glass-card {
  background: var(--color-ai-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-ai-border);
}

.ai-gradient-text {
  background: linear-gradient(to right, #60a5fa, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 25px rgba(59, 130, 246, 0.8);
    transform: scale(1.02);
  }
}

.animate-pulse-glow {
  animation: pulse-glow 2s infinite ease-in-out;
}

