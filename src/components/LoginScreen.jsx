import { useState } from 'react';
import { Copy, ShieldHalf } from 'lucide-react';
import { isInAppBrowser, inAppBrowserName } from '../utils/browserEnvironment';

export default function LoginScreen({ auth }) {
  const [copied, setCopied] = useState(false);
  const inApp = isInAppBrowser();

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <ShieldHalf size={40} color="var(--accent)" />
        <h1>Handball Bench Tracker</h1>

        {inApp ? (
          <>
            <p className="modal-hint">
              Has abierto este enlace desde {inAppBrowserName()}. Google no permite iniciar sesión dentro de esa
              app — ábrelo en Safari o Chrome y vuelve a intentarlo.
            </p>
            <button className="btn btn-clock btn-start" onClick={copyLink}>
              <Copy size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {copied ? 'Enlace copiado' : 'Copiar enlace'}
            </button>
            <p className="modal-hint">
              Pega el enlace en Safari, o toca el icono de más opciones (⋯) o de compartir de {inAppBrowserName()}
              {' '}y elige "Abrir en el navegador".
            </p>
          </>
        ) : (
          <>
            <p className="modal-hint">Inicia sesión con tu cuenta de Google para continuar</p>
            {auth.error && <p className="login-error">{auth.error}</p>}
            <button className="btn btn-clock btn-start btn-google" onClick={auth.loginWithGoogle}>
              INICIAR SESIÓN CON GOOGLE
            </button>
          </>
        )}
      </div>
    </div>
  );
}
