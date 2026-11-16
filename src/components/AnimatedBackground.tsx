import React from 'react';

export const AnimatedBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 artistic-pattern"
      style={{ contain: 'strict' }}
    >
      {/* Lightweight CSS radial-gradient ambient glows (zero runtime filter:blur or pulse repaint) */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `
            radial-gradient(circle at 12% 8%, var(--complex-accent, #ffc800) 0%, transparent 42%),
            radial-gradient(circle at 90% 28%, var(--duo-blue, #1cb0f6) 0%, transparent 45%),
            radial-gradient(circle at 42% 95%, var(--complex-secondary, #203843) 0%, transparent 50%)
          `
        }}
      />

      {/* Duolingo Micro-Grid Matrix Overlay */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(var(--complex-accent-rgb, 255, 200, 0), 0.08) 1.5px, transparent 0)',
          backgroundSize: '36px 36px'
        }}
      />
    </div>
  );
};

