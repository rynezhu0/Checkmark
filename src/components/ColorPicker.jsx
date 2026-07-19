import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Color conversion helpers ───────────────────────────
function hsvToRgb(h, s, v) {
  h = h / 360;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s, v };
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return null;
  const num = parseInt(hex, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ─── ColorPicker Component ──────────────────────────────
export default function ColorPicker({ value, onChange, onLiveChange, theme }) {
  const isDark = theme === 'dark';

  // Parse initial color
  const initRgb = hexToRgb(value || '#3b82f6') || { r: 59, g: 130, b: 246 };
  const initHsv = rgbToHsv(initRgb.r, initRgb.g, initRgb.b);

  const [hue, setHue] = useState(initHsv.h);
  const [sat, setSat] = useState(initHsv.s);
  const [val, setVal] = useState(initHsv.v);
  const [hexInput, setHexInput] = useState((value || '#3b82f6').toUpperCase());
  const [rgbInputs, setRgbInputs] = useState(initRgb);

  const gradientRef = useRef(null);
  const hueRef = useRef(null);
  const isDraggingGradient = useRef(false);
  const isDraggingHue = useRef(false);

  // `onLiveChange` fires synchronously on every drag event, same as the state setters
  // below. `onChange` — the one callers use to persist the color — is throttled to once
  // per animation frame so a fast drag can't outrun what the caller can afford to commit.
  const pendingHexRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const emitColor = useCallback((h, s, v) => {
    const rgb = hsvToRgb(h, s, v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHexInput(hex.toUpperCase());
    setRgbInputs(rgb);
    onLiveChange?.(hex);
    pendingHexRef.current = hex;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingHexRef.current != null) {
          onChange(pendingHexRef.current);
          pendingHexRef.current = null;
        }
      });
    }
  }, [onChange, onLiveChange]);

  // ─── Gradient (saturation + value) interaction ────────
  const handleGradientInteraction = useCallback((e) => {
    const rect = gradientRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const newSat = x / rect.width;
    const newVal = 1 - y / rect.height;
    setSat(newSat);
    setVal(newVal);
    emitColor(hue, newSat, newVal);
  }, [hue, emitColor]);

  const handleGradientDown = useCallback((e) => {
    e.preventDefault();
    isDraggingGradient.current = true;
    handleGradientInteraction(e);
  }, [handleGradientInteraction]);

  // ─── Hue slider interaction ───────────────────────────
  const handleHueInteraction = useCallback((e) => {
    const rect = hueRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const newHue = Math.round((y / rect.height) * 360);
    setHue(newHue);
    emitColor(newHue, sat, val);
  }, [sat, val, emitColor]);

  const handleHueDown = useCallback((e) => {
    e.preventDefault();
    isDraggingHue.current = true;
    handleHueInteraction(e);
  }, [handleHueInteraction]);

  // Global mouse move/up
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingGradient.current) {
        handleGradientInteraction(e);
      }
      if (isDraggingHue.current) {
        handleHueInteraction(e);
      }
    };
    const handleMouseUp = () => {
      isDraggingGradient.current = false;
      isDraggingHue.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleGradientInteraction, handleHueInteraction]);

  // ─── Hex input handler ────────────────────────────────
  const handleHexChange = (e) => {
    let raw = e.target.value;
    setHexInput(raw);
    if (!raw.startsWith('#')) raw = '#' + raw;
    const rgb = hexToRgb(raw);
    if (rgb) {
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
      setRgbInputs(rgb);
      const hex = raw.length === 4 ? rgbToHex(rgb.r, rgb.g, rgb.b) : raw;
      onLiveChange?.(hex);
      onChange(hex);
    }
  };

  // ─── RGB input handler ────────────────────────────────
  const handleRgbChange = (channel, rawValue) => {
    const numVal = Math.max(0, Math.min(255, parseInt(rawValue) || 0));
    const newRgb = { ...rgbInputs, [channel]: numVal };
    setRgbInputs({ ...rgbInputs, [channel]: rawValue === '' ? '' : numVal });
    if (rawValue !== '') {
      const hsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
      setHexInput(hex.toUpperCase());
      onLiveChange?.(hex);
      onChange(hex);
    }
  };

  // Current hue color for gradient background
  const hueColor = (() => {
    const rgb = hsvToRgb(hue, 1, 1);
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  })();

  const currentColor = (() => {
    const rgb = hsvToRgb(hue, sat, val);
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  })();

  const inputClass = `w-full text-xs text-center py-1 rounded border outline-none
    ${isDark
      ? 'bg-navy-900 border-navy-600 text-white focus:border-navy-400'
      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-400'
    }`;

  const labelClass = `text-[10px] font-medium uppercase tracking-wider
    ${isDark ? 'text-navy-500' : 'text-gray-400'}`;

  return (
    <div className="color-picker-area space-y-3">
      {/* Color preview swatch */}
      <div
        className="w-full h-6 rounded-md border"
        style={{
          backgroundColor: currentColor,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }}
      />

      {/* Gradient area + Hue slider */}
      <div className="flex gap-2.5">
        {/* Saturation/Value gradient */}
        <div
          ref={gradientRef}
          className="relative flex-1 rounded-lg cursor-crosshair overflow-hidden"
          style={{
            aspectRatio: '1',
            backgroundColor: hueColor,
          }}
          onMouseDown={handleGradientDown}
        >
          {/* White overlay (left to right = saturation) */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, #fff, transparent)',
            }}
          />
          {/* Black overlay (top to bottom = value) */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, transparent, #000)',
            }}
          />
          {/* Selector circle */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${sat * 100}%`,
              top: `${(1 - val) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white"
              style={{
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.15)',
                backgroundColor: currentColor,
              }}
            />
          </div>
        </div>

        {/* Hue slider */}
        <div
          ref={hueRef}
          className="relative w-5 rounded-full cursor-pointer flex-shrink-0"
          style={{
            background: 'linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
          onMouseDown={handleHueDown}
        >
          {/* Hue selector */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: `${(hue / 360) * 100}%`,
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-white"
              style={{
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.15)',
                backgroundColor: hueColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Hex + RGB inputs */}
      <div className="flex gap-2 items-end">
        {/* Hex */}
        <div className="flex-1">
          <span className={labelClass}>Hex</span>
          <input
            type="text"
            value={hexInput}
            onChange={handleHexChange}
            maxLength={7}
            className={inputClass}
          />
        </div>
        {/* R */}
        <div className="w-10">
          <span className={labelClass}>R</span>
          <input
            type="text"
            value={rgbInputs.r}
            onChange={(e) => handleRgbChange('r', e.target.value)}
            maxLength={3}
            className={inputClass}
          />
        </div>
        {/* G */}
        <div className="w-10">
          <span className={labelClass}>G</span>
          <input
            type="text"
            value={rgbInputs.g}
            onChange={(e) => handleRgbChange('g', e.target.value)}
            maxLength={3}
            className={inputClass}
          />
        </div>
        {/* B */}
        <div className="w-10">
          <span className={labelClass}>B</span>
          <input
            type="text"
            value={rgbInputs.b}
            onChange={(e) => handleRgbChange('b', e.target.value)}
            maxLength={3}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
