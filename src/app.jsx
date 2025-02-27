import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';

import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Login } from './login/login';
import { About } from './about/about';
import { History } from './history/history';
import { Analyzer } from './analyzer/analyzer';
import { AuthState } from './login/authState';

export default function App() {
    const [userName, setUserName] = React.useState(localStorage.getItem('userName') || '');
    const [authState, setAuthState] = React.useState(userName ? AuthState.Authenticated : AuthState.Unauthenticated);

    // Protected route wrapper
    const ProtectedRoute = ({ children }) => {
        if (authState !== AuthState.Authenticated) {
            return <Navigate to="/" replace />;
        }
        return children;
    };

    return (
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
              </>
            )}
            <li className="nav-item">
              <NavLink className="nav-link" to="/about">About</NavLink>
            </li>
          </menu>
        </nav>
      </header>
      
      <Routes>
        <Route 
          path="/" 
          element={
            <Login 
              userName={userName}
              authState={authState}
              onAuthChange={(userName, authState) => {
                setAuthState(authState);
                setUserName(userName);
              }}
            />
          } 
        />
        <Route 
          path="/analyzer" 
          element={
            <ProtectedRoute>
              <Analyzer userName={userName} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/history" 
          element={
            <ProtectedRoute>
              <History userName={userName} />
            </ProtectedRoute>
          } 
        />
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
    );
  }

  function NotFound() {
    return <main className="container-fluid bg-secondary text-center">404: Return to sender. Address unknown.</main>;
  }