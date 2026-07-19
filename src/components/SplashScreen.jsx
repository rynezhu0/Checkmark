import { useState, useEffect } from 'react';
import { CheckmarkLogo } from './Icons';

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState('visible'); // 'visible' | 'fading' | 'done'

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('fading'), 1800);
    const timer2 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center
        bg-navy-950 transition-all duration-600
        ${phase === 'fading' ? 'animate-splash-out' : ''}`}
    >
      <div className="flex flex-col items-center gap-4">
        <CheckmarkLogo size={72} className="text-blue-400" />
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Checkmark
        </h1>
        <p className="text-navy-400 text-sm tracking-widest uppercase">
          Your tasks, organized.
        </p>
      </div>

      {/* Subtle pulse dots */}
      <div className="mt-12 flex gap-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-400"
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
