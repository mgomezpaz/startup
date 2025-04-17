import React from 'react';
import './analyzer.css';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_FILE_TYPES = ['.zip', '.tar.gz', '.rar'];

const validateGitHubUrl = (url) => {
  if (!url) return null;
  const githubUrlRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+(\.git)?(\/)?$/;
  if (!githubUrlRegex.test(url)) {
    return 'Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo or https://github.com/owner/repo.git)';
  }
  return null;
};

export function Analyzer({ userName }) {
  const [file, setFile] = React.useState(null);
  const [repoUrl, setRepoUrl] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [error, setError] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisResults, setAnalysisResults] = React.useState(null);
  const [notifications, setNotifications] = React.useState([]);
  const [currentAnalysisId, setCurrentAnalysisId] = React.useState(null);

  const addNotification = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setNotifications(prev => [{message, timestamp}, ...prev].slice(0, 5));
  };

  const validateFile = (file) => {
    if (!file) return 'Please select a file';
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    // Check file type
    const fileExtension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0];
    if (!fileExtension || !ALLOWED_FILE_TYPES.includes(fileExtension)) {
      return `File type must be one of: ${ALLOWED_FILE_TYPES.join(', ')}`;
    }

    return null;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    addNotification(`File selected: ${selectedFile.name}`);
  };

  const checkAnalysisStatus = async (analysisId) => {
    try {
      console.log(`Checking analysis status for ID: ${analysisId}`);
      const response = await fetch(`/api/analysis/${analysisId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Status check failed:', error);
        throw new Error(error.message || 'Failed to check analysis status');
      }

      const analysis = await response.json();
      console.log(`Current status: ${analysis.status}`);
      
      if (analysis.status === 'completed') {
        console.log('Analysis completed, updating results...');
        setIsAnalyzing(false);
        if (analysis.results) {
          setAnalysisResults(analysis.results);
          addNotification('Analysis completed');
        } else {
          setError('Analysis completed but no results found');
        }
        return true;
      } else if (analysis.status === 'failed') {
        console.log('Analysis failed:', analysis.error);
        setIsAnalyzing(false);
        setError(analysis.error || 'Analysis failed');
        return true;
      } else if (analysis.status === 'analyzing') {
        console.log('Analysis in progress...');
        addNotification('Analysis in progress...');
      }

      return false;
    } catch (error) {
      console.error('Error checking analysis status:', error);
      setIsAnalyzing(false);
      setError(error.message);
      return true;
    }
  };

  const startAnalysis = async () => {
    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      if (repoUrl) {
        formData.append('repoUrl', repoUrl);
      }
      if (notes) {
        formData.append('notes', notes);
      }

      console.log('Starting new analysis...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start analysis');
      }

      const data = await response.json();
      console.log('Received response:', data);
      
      // Add a small delay to ensure database is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to fetch the analysis with retry logic
      let retries = 3;
      let analysisId = data.id || data.analysisId;
      
      if (!analysisId) {
        throw new Error('No analysis ID received from server');
      }

      console.log(`Analysis started with ID: ${analysisId}`);
      setCurrentAnalysisId(analysisId);
      setIsAnalyzing(true);
      setError(null);
      addNotification('Analysis started...');

      // Poll for results with retry logic
      const pollInterval = setInterval(async () => {
        try {
          const isComplete = await checkAnalysisStatus(analysisId);
          if (isComplete) {
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Error checking status:', error);
          retries--;
          if (retries <= 0) {
            clearInterval(pollInterval);
            setError('Failed to check analysis status after multiple attempts');
            setIsAnalyzing(false);
          }
        }
      }, 2000);

    } catch (error) {
      console.error('Analysis failed:', error);
      setError(error.message);
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    
    if (!file && !repoUrl) {
      setError('Please provide either a file or repository URL');
      return;
    }

    if (repoUrl) {
      const urlError = validateGitHubUrl(repoUrl);
      if (urlError) {
        setError(urlError);
        return;
      }
    }

    try {
      await startAnalysis();
    } catch (error) {
      setError('Analysis failed. Please try again.');
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="analyzer-container">
      <div className="prompt-box">
        <h2>What do we need to secure?</h2>
        <form onSubmit={handleAnalyze}>
          <div className="upload-option">
            <label htmlFor="zip-file">Code Archive (ZIP/TAR.GZ/RAR)</label>
            <input 
              type="file" 
              id="zip-file" 
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={handleFileChange}
              className="form-control" 
            />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="progress mt-2">
                <div 
                  className="progress-bar" 
                  role="progressbar" 
                  style={{width: `${uploadProgress}%`}}
                  aria-valuenow={uploadProgress} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                >
                  {uploadProgress}%
                </div>
              </div>
            )}
          </div>

          <div className="upload-option">
            <label htmlFor="repo-url">or GitHub URL</label>
            <input 
              type="url" 
              id="repo-url" 
              className="form-control" 
              placeholder="https://github.com/user/repo"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setError(null);
              }}
            />
            <small className="text-muted">
              Enter a public GitHub repository URL (e.g., https://github.com/owner/repo or https://github.com/owner/repo.git)
            </small>
          </div>

          <div className="upload-option">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea 
              id="notes" 
              className="form-control" 
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional context about the code..."
            />
          </div>

          <div className="upload-option">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
            </button>
          </div>

          {error && (
            <div className="alert alert-danger mt-3">
              {error}
            </div>
          )}
        </form>
      </div>

      {notifications.length > 0 && (
        <div className="notifications">
          <h3>Activity Log</h3>
          <ul className="notification-list">
            {notifications.map((notif, index) => (
              <li key={index}>
                <span className="timestamp">{notif.timestamp}</span>
                {notif.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysisResults && (
        <div className="analysis-results">
          <h2>Analysis Results</h2>
          
          <div className="analysis-details">
            <div className="detail-item">
              <label>Project:</label>
              <span>{analysisResults.projectName || (file?.name || repoUrl || 'Unknown')}</span>
            </div>
            <div className="detail-item">
              <label>Date:</label>
              <span>{analysisResults.timestamp || new Date().toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <label>Status:</label>
              <span>{analysisResults.status || 'completed'}</span>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {analysisResults.summary.highSeverity + analysisResults.summary.mediumSeverity + analysisResults.summary.lowSeverity} Issues
            </span>
          </div>
          <div className="vulnerability-summary">
            <h3>Summary</h3>
            <div className="severity-counts">
              <span className="high">High: {analysisResults.summary.highSeverity}</span>
              <span className="medium">Medium: {analysisResults.summary.mediumSeverity}</span>
              <span className="low">Low: {analysisResults.summary.lowSeverity}</span>
            </div>
          </div>
          <div className="vulnerability-list">
            <h3>Vulnerabilities</h3>
            {analysisResults.files.map((file, fileIndex) => (
              file.vulnerabilities.length > 0 && (
                <div key={fileIndex} className="file-vulnerabilities">
                  <h4>{file.path}</h4>
                  {file.vulnerabilities.map((vuln, vulnIndex) => (
                    <div key={vulnIndex} className={`vulnerability-item ${vuln.severity.toLowerCase()}`}>
                      <h5>Line {vuln.line}:{vuln.column || "0"}</h5>
                      <p className="vulnerability-description">{vuln.description}</p>
                      <p className="vulnerability-suggestion">{vuln.suggestion}</p>
                    </div>
                  ))}
                </div>
              )
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="btn-high">{analysisResults.summary.highSeverity}H</button>
            <button className="btn-medium">{analysisResults.summary.mediumSeverity}M</button>
            <button className="btn-low">{analysisResults.summary.lowSeverity}L</button>
          </div>
        </div>
      )}
    </main>
  );
}