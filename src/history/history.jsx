import React from 'react';
import './history.css';

export function History({ userName }) {
  const [analysisHistory, setAnalysisHistory] = React.useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = React.useState(null);
  const [sortConfig, setSortConfig] = React.useState({ key: 'date', direction: 'desc' });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Fetch analysis history from the backend
  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/history');
        
        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }
        
        const data = await response.json();
        setAnalysisHistory(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching history:', err);
        setError('Failed to load analysis history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: 
        prevConfig.key === key && prevConfig.direction === 'asc' 
          ? 'desc' 
          : 'asc'
    }));
  };

  const sortedHistory = React.useMemo(() => {
    if (!analysisHistory.length) return [];
    
    const sorted = [...analysisHistory];
    sorted.sort((a, b) => {
      if (sortConfig.key === 'vulnerabilities') {
        const totalA = a.vulnerabilities.high + a.vulnerabilities.medium + a.vulnerabilities.low;
        const totalB = b.vulnerabilities.high + b.vulnerabilities.medium + b.vulnerabilities.low;
        return sortConfig.direction === 'asc' ? totalA - totalB : totalB - totalA;
      }
      
      if (sortConfig.key === 'date') {
        return sortConfig.direction === 'asc' 
          ? new Date(a.date) - new Date(b.date)
          : new Date(b.date) - new Date(a.date);
      }
      
      return sortConfig.direction === 'asc'
        ? a[sortConfig.key].localeCompare(b[sortConfig.key])
        : b[sortConfig.key].localeCompare(a[sortConfig.key]);
    });
    return sorted;
  }, [analysisHistory, sortConfig]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalVulnerabilities = (vulns) => {
    return vulns.high + vulns.medium + vulns.low;
  };

  const getSeverityClass = (vulns) => {
    if (vulns.high > 0) return 'high';
    if (vulns.medium > 0) return 'medium';
    if (vulns.low > 0) return 'low';
    return 'none';
  };

  // Fetch a specific analysis by ID
  const fetchAnalysisDetails = async (id) => {
    try {
      const response = await fetch(`/api/analysis/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analysis details');
      }
      
      const data = await response.json();
      setSelectedAnalysis(data);
    } catch (err) {
      console.error('Error fetching analysis details:', err);
      setError('Failed to load analysis details. Please try again later.');
    }
  };

  return (
    <main className="history-container">
      <div className="history-header">
        <h2>Analysis History</h2>
      </div>

      <div className="history-content">
        {loading ? (
          <div className="loading">Loading analysis history...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : analysisHistory.length === 0 ? (
          <div className="no-history">No analysis history found. Try analyzing some code first!</div>
        ) : (
          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th style={{width: '5%'}} onClick={() => handleSort('id')}>#</th>
                  <th style={{width: '30%'}} onClick={() => handleSort('projectName')}>
                    Project Name
                    {sortConfig.key === 'projectName' && (
                      <span className="sort-indicator">
                        {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </th>
                  <th style={{width: '25%'}} onClick={() => handleSort('date')}>
                    Date
                    {sortConfig.key === 'date' && (
                      <span className="sort-indicator">
                        {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </th>
                  <th style={{width: '25%'}} onClick={() => handleSort('vulnerabilities')}>
                    Vulnerabilities
                    {sortConfig.key === 'vulnerabilities' && (
                      <span className="sort-indicator">
                        {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </th>
                  <th style={{width: '15%'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((analysis, index) => (
                  <tr key={analysis._id || index}>
                    <td>{index + 1}</td>
                    <td>{analysis.projectName}</td>
                    <td>{formatDate(analysis.date)}</td>
                    <td className={`vulnerabilities ${getSeverityClass(analysis.vulnerabilities)}`}>
                      <div className="vulnerability-summary">
                        {getTotalVulnerabilities(analysis.vulnerabilities)}
                        <span className="vulnerability-breakdown">
                          {analysis.vulnerabilities.high > 0 && (
                            <span className="high">{analysis.vulnerabilities.high}H</span>
                          )}
                          {analysis.vulnerabilities.medium > 0 && (
                            <span className="medium">{analysis.vulnerabilities.medium}M</span>
                          )}
                          {analysis.vulnerabilities.low > 0 && (
                            <span className="low">{analysis.vulnerabilities.low}L</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          if (analysis._id) {
                            fetchAnalysisDetails(analysis._id);
                          } else {
                            setSelectedAnalysis(analysis);
                          }
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedAnalysis && (
          <div className="analysis-details">
            <div className="details-header">
              <h3>Analysis Details - {selectedAnalysis.projectName}</h3>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedAnalysis(null)}
              >
                Close
              </button>
            </div>

            <div className="summary-box">
              <h4>Summary</h4>
              <div className="severity-counts">
                <div className="severity high">
                  <span className="count">{selectedAnalysis.vulnerabilities.high}</span>
                  <span className="label">High</span>
                </div>
                <div className="severity medium">
                  <span className="count">{selectedAnalysis.vulnerabilities.medium}</span>
                  <span className="label">Medium</span>
                </div>
                <div className="severity low">
                  <span className="count">{selectedAnalysis.vulnerabilities.low}</span>
                  <span className="label">Low</span>
                </div>
              </div>
            </div>

            <div className="vulnerabilities-list">
              <h4>Detected Vulnerabilities</h4>
              {selectedAnalysis.results.vulnerabilities.map((vuln, index) => (
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
              {selectedAnalysis.results.vulnerabilities.length === 0 && (
                <p className="no-vulnerabilities">No vulnerabilities detected</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}