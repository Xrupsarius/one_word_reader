export interface Settings {
  wpm: number;
  fontSize: number;
  theme: 'system' | 'light' | 'dark';
  ramp: boolean;
  punctuation: boolean;
}

export const defaultSettings: Settings = {
  wpm: 300,
  fontSize: 40,
  theme: 'system',
  ramp: false,
  punctuation: true,
};

export function readSettings(): Settings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('viewreader.settings') ?? 'null');
    if (!value || typeof value !== 'object') return defaultSettings;
    const s = value as Partial<Settings>;
    return {
      wpm:
        typeof s.wpm === 'number' && Number.isFinite(s.wpm)
          ? Math.round(Math.min(1000, Math.max(100, s.wpm)) / 25) * 25
          : 300,
      fontSize:
        typeof s.fontSize === 'number' && Number.isFinite(s.fontSize)
          ? Math.min(64, Math.max(24, s.fontSize))
          : 40,
      theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
      ramp: s.ramp === true,
      punctuation: s.punctuation !== false,
    };
  } catch {
    return defaultSettings;
  }
}
