import { ShieldHalf } from 'lucide-react';

export default function LoginScreen({ auth }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <ShieldHalf size={40} color="var(--accent)" />
        <h1>Handball Bench Tracker</h1>
        <p className="modal-hint">Inicia sesión con tu cuenta de Google para continuar</p>

        {auth.error && <p className="login-error">{auth.error}</p>}

        <button className="btn btn-clock btn-start btn-google" onClick={auth.loginWithGoogle}>
          INICIAR SESIÓN CON GOOGLE
        </button>
      </div>
    </div>
  );
}
