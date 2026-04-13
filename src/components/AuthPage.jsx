import React, { useEffect, useState } from 'react';
import './AuthPage.css';

function AuthPage({ onLogin, onRegister, backendAvailable, errorMessage, initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setTab(initialTab === 'register' ? 'register' : 'login');
  }, [initialTab]);

  async function submit(event) {
    event.preventDefault();
    setLocalError('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await onLogin({ email, password });
      } else {
        await onRegister({ name, email, password });
      }
    } catch (error) {
      setLocalError(error.message || 'No se pudo completar la solicitud.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <h1>FlowBot</h1>
        <p className="auth-subtitle">
          {backendAvailable
            ? 'Inicia sesion o crea una cuenta para guardar tus chats en SQL Server 2019.'
            : 'Backend no disponible: modo invitado activo con almacenamiento local.'}
        </p>

        {backendAvailable && (
          <div className="auth-tabs">
            <button type="button" className={tab === 'login' ? 'is-active' : ''} onClick={() => setTab('login')}>Login</button>
            <button type="button" className={tab === 'register' ? 'is-active' : ''} onClick={() => setTab('register')}>Registro</button>
          </div>
        )}

        {backendAvailable ? (
          <form className="auth-form" onSubmit={submit}>
            {tab === 'register' && (
              <label>
                Nombre
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Contrasena
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </label>

            {(localError || errorMessage) && <p className="auth-error">{localError || errorMessage}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Procesando...' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        ) : (
          <p className="auth-guest-message">Usa FlowBot como invitado. Tus datos se guardaran localmente.</p>
        )}
      </section>
    </main>
  );
}

export default AuthPage;
