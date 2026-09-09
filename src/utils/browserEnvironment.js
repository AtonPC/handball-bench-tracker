// Detecta navegadores integrados (WhatsApp, Instagram, Facebook, TikTok...)
// que abren los enlaces en su propia vista embebida. Google bloquea o rompe
// ahí el inicio de sesión con Google (el sessionStorage que usa Firebase
// para el popup queda particionado/inaccesible) — mejor avisar con
// instrucciones claras que dejar que falle con un error críptico.
const IN_APP_PATTERNS = [
  [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
  [/Instagram/i, 'Instagram'],
  [/WhatsApp/i, 'WhatsApp'],
  [/MicroMessenger/i, 'WeChat'],
  [/TikTok|musical_ly/i, 'TikTok'],
  [/Twitter/i, 'Twitter/X'],
  [/\bLine\//i, 'Line'],
];

function match() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return IN_APP_PATTERNS.find(([re]) => re.test(ua)) || null;
}

export function isInAppBrowser() {
  return !!match();
}

export function inAppBrowserName() {
  return match()?.[1] || 'esta app';
}
