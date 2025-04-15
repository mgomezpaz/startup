import React from 'react';
import { AuthState } from './authState';
import { useNavigate } from 'react-router-dom';
import './login.css';

export function Login({ userName, authState, onAuthChange }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayError, setDisplayError] = React.useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setDisplayError('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (error) {
        // If we can't parse JSON, it might be a rate limit error
        if (response.status === 429) {
          setDisplayError('Too many login attempts. Please try again later.');
          return;
        }
        throw new Error('Failed to parse server response');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store in localStorage
      localStorage.setItem('userName', email);
      
      // Update auth state
      onAuthChange(email, AuthState.Authenticated);
      
      setDisplayError(null);
      
      // Redirect to analyzer page
      navigate('/analyzer');
    } catch (error) {
      setDisplayError(error.message || 'Failed to login. Please try again.');
    }
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
                fetch('/api/auth/logout', { method: 'POST' });
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
                  onClick={() => navigate('/register')}
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