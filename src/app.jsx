import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';

import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Login } from './login/login';
import { About } from './about/about';
import { History } from './history/history';
import { Analyzer } from './analyzer/analyzer';
import { AuthState } from './login/authState';
import Register from './login/register';
import { Admin } from './admin/admin';

function NotFound() {
    return <main className="container-fluid bg-secondary text-center">404: Return to sender. Address unknown.</main>;
}

// Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mt-5">
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
    console.log('App component rendering');
    const [userName, setUserName] = React.useState(localStorage.getItem('userName') || '');
    const [authState, setAuthState] = React.useState(userName ? AuthState.Authenticated : AuthState.Unauthenticated);
    const [userRole, setUserRole] = React.useState(localStorage.getItem('userRole') || 'user');

    console.log('Current auth state:', authState);
    console.log('Current username:', userName);

    const onAuthChange = (userName, authState, role = 'user') => {
        setUserName(userName);
        setAuthState(authState);
        setUserRole(role);
        if (authState === AuthState.Authenticated) {
            localStorage.setItem('userName', userName);
            localStorage.setItem('userRole', role);
        } else {
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
        }
    };

    // Protected route wrapper
    const ProtectedRoute = ({ children, requiredRole = 'user' }) => {
        console.log('ProtectedRoute checking auth:', authState);
        if (authState !== AuthState.Authenticated) {
            return <Navigate to="/login" replace />;
        }

        if (requiredRole === 'admin' && userRole !== 'admin') {
            return <Navigate to="/" replace />;
        }

        return children;
    };

    return (
        <ErrorBoundary>
            <BrowserRouter>    
                <header>
                    <div className="header-content">
                        <img src="logo.ico" alt="Secure Code Logo" width="40" height="40" />
                        <h1>Free Secure Code</h1>
                    </div>

                    <nav>
                        <menu>
                            <li className="nav-item">
                                <NavLink className="nav-link active" to="/">Home</NavLink>
                            </li>
                            {authState === AuthState.Authenticated && (
                                <>
                                    <li className="nav-item">
                                        <NavLink className="nav-link" to="/analyzer">Analyzer</NavLink>
                                    </li>
                                    <li className="nav-item"> 
                                        <NavLink className="nav-link" to="/history">History</NavLink>
                                    </li>
                                    {userRole === 'admin' && (
                                        <li className="nav-item">
                                            <NavLink className="nav-link" to="/admin">Admin</NavLink>
                                        </li>
                                    )}
                                </>
                            )}
                            <li className="nav-item">
                                <NavLink className="nav-link" to="/about">About</NavLink>
                            </li>
                        </menu>
                    </nav>
                </header>
                
                <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={
                        <Login
                            userName={userName}
                            authState={authState}
                            onAuthChange={onAuthChange}
                        />
                    } />
                    <Route path="/register" element={
                        <Register
                            userName={userName}
                            authState={authState}
                            onAuthChange={onAuthChange}
                        />
                    } />
                    <Route path="/analyzer" element={
                        <ProtectedRoute>
                            <Analyzer userName={userName} />
                        </ProtectedRoute>
                    } />
                    <Route path="/history" element={
                        <ProtectedRoute>
                            <History userName={userName} />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin" element={
                        <ProtectedRoute requiredRole="admin">
                            <Admin />
                        </ProtectedRoute>
                    } />
                    <Route path="/about" element={<About />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>

                <footer>
                    <hr />
                    <span>Author: Matias Gomez Paz</span>
                    <br />
                    <a href="https://github.com/mgomezpaz/startup">GitHub</a>
                </footer>
            </BrowserRouter>
        </ErrorBoundary>
    );
}