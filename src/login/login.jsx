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
    // Basic validation
    if (!email || !password) {
      setDisplayError('Please fill in all fields');
      return;
    }

    try {
      // Call the backend service for authentication
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const user = await response.json();
        // Update auth state
        onAuthChange(user.email, AuthState.Authenticated);
        setDisplayError(null);
        
        // Redirect to analyzer page
        navigate('/analyzer');
      } else {
        const body = await response.json();
        setDisplayError(body.msg || 'Authentication failed');
      }
    } catch (error) {
      setDisplayError('Failed to login. Please try again.');
    }
  };

  const handleCreateAccount = async () => {
    // Basic validation
    if (!email || !password) {
      setDisplayError('Please fill in all fields');
      return;
    }

    try {
      // Call the backend service to create a new account
      const response = await fetch('/api/auth/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const user = await response.json();
        // Update auth state
        onAuthChange(user.email, AuthState.Authenticated);
        setDisplayError(null);
        
        // Redirect to analyzer page
        navigate('/analyzer');
      } else {
        const body = await response.json();
        setDisplayError(body.msg || 'Failed to create account');
      }
    } catch (error) {
      setDisplayError('Failed to create account. Please try again.');
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
              onClick={async () => {
                try {
                  // Call the backend service to logout
                  await fetch('/api/auth/logout', {
                    method: 'DELETE',
                  });
                } catch (error) {
                  // If there's an error, we still want to log out locally
                  console.error('Error during logout:', error);
                } finally {
                  onAuthChange('', AuthState.Unauthenticated);
                }
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