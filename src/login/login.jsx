import React from 'react';
import { AuthState } from './authState';
import './login.css';

export function Login({ userName, authState, onAuthChange }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayError, setDisplayError] = React.useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    // For now, we'll just do basic validation
    if (!email || !password) {
      setDisplayError('Please fill in all fields');
      return;
    }

    // Mock authentication - in the future, this will call your backend
    try {
      // Store in localStorage
      localStorage.setItem('userName', email);
      
      // Update auth state
      onAuthChange(email, AuthState.Authenticated);
      
      setDisplayError(null);
    } catch (error) {
      setDisplayError('Failed to login. Please try again.');
    }
  };

  const handleCreateAccount = async () => {
    // For now, we'll use the same logic as login
    handleLogin(new Event('submit'));
  };

  return (
    <main className="container">
      <section id="login" className="centered-content">
        <h2>Welcome to Free Secure Code</h2>
        {authState === AuthState.Authenticated ? (
          <div>
            <p>Welcome back, {userName}!</p>
            <button 
              className="btn btn-secondary"
              onClick={() => {
                localStorage.removeItem('userName');
                onAuthChange('', AuthState.Unauthenticated);
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <form onSubmit={handleLogin}>
              <div className="input-group mb-3">
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="your@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="input-group mb-3">
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
              {displayError && (
                <div className="alert alert-danger" role="alert">
                  {displayError}
                </div>
              )}
              <div className="button-group">
                <button type="submit" className="btn btn-primary">Log In</button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleCreateAccount}
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}