import React from 'react';
import './analyzer.css';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_FILE_TYPES = ['.zip', '.tar.gz', '.rar'];

export function Analyzer({ userName }) {
  const [file, setFile] = React.useState(null);
  const [repoUrl, setRepoUrl] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [error, setError] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisResults, setAnalysisResults] = React.useState(null);
  const [notifications, setNotifications] = React.useState([]);

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

  const mockAnalysis = async () => {
    // Simulate file upload progress
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Mock analysis results
    setIsAnalyzing(true);
    addNotification('Analysis started...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock results
    setAnalysisResults({
      vulnerabilities: [
        {
          file: 'src/main.js',
          line: 42,
          severity: 'high',
          description: 'Potential SQL injection vulnerability detected',
          code: 'const query = `SELECT * FROM users WHERE id = ${userId}`;'
        },
        {
          file: 'src/auth.js',
          line: 15,
          severity: 'medium',
          description: 'Weak password hashing algorithm',
          code: 'const hash = md5(password);'
        }
      ],
      summary: {
        highSeverity: 1,
        mediumSeverity: 1,
        lowSeverity: 0
      }
    });

    setIsAnalyzing(false);
    addNotification('Analysis completed');
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    
    if (!file && !repoUrl) {
      setError('Please provide either a file or repository URL');
      return;
    }

    try {
      await mockAnalysis();
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
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>

          <div className="upload-option">
            <label htmlFor="notes">Additional Notes (Optional)</label>
            <textarea 
              id="notes" 
              className="form-control" 
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific concerns or areas to focus on?"
            />
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <div className="upload-option">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
            </button>
          </div>
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
          <div className="summary-box">
            <h3>Summary</h3>
            <div className="severity-counts">
              <div className="severity high">
                <span className="count">{analysisResults.summary.highSeverity}</span>
                <span className="label">High</span>
              </div>
              <div className="severity medium">
                <span className="count">{analysisResults.summary.mediumSeverity}</span>
                <span className="label">Medium</span>
              </div>
              <div className="severity low">
                <span className="count">{analysisResults.summary.lowSeverity}</span>
                <span className="label">Low</span>
              </div>
            </div>
          </div>

          <div className="vulnerabilities">
            <h3>Detected Vulnerabilities</h3>
            {analysisResults.vulnerabilities.map((vuln, index) => (
              <div key={index} className={`vulnerability-card ${vuln.severity}`}>
                <div className="vulnerability-header">
                  <span className="severity-badge">{vuln.severity}</span>
                  <span className="file-location">{vuln.file}:{vuln.line}</span>
                </div>
                <p className="description">{vuln.description}</p>
                <pre className="code-snippet">
                  <code>{vuln.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}