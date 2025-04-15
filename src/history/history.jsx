import React, { useEffect } from 'react';
import './history.css';

export function History({ userName }) {
  const [analysisHistory, setAnalysisHistory] = React.useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = React.useState(null);
  const [sortConfig, setSortConfig] = React.useState({ key: 'date', direction: 'desc' });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  useEffect(() => {
    fetchAnalysisHistory();
  }, []);

  const fetchAnalysisHistory = async () => {
    try {
      const response = await fetch('/api/analysis/history', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analysis history');
      }

      const data = await response.json();
      setAnalysisHistory(data);
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

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
    const sorted = [...analysisHistory];
    sorted.sort((a, b) => {
      if (sortConfig.key === 'vulnerabilities') {
        const totalA = a.results?.summary?.highSeverity + a.results?.summary?.mediumSeverity + a.results?.summary?.lowSeverity || 0;
        const totalB = b.results?.summary?.highSeverity + b.results?.summary?.mediumSeverity + b.results?.summary?.lowSeverity || 0;
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

  const getTotalVulnerabilities = (results) => {
    if (!results?.summary) return 0;
    return results.summary.highSeverity + results.summary.mediumSeverity + results.summary.lowSeverity;
  };

  const getSeverityClass = (results) => {
    if (!results?.summary) return 'none';
    if (results.summary.highSeverity > 0) return 'high';
    if (results.summary.mediumSeverity > 0) return 'medium';
    if (results.summary.lowSeverity > 0) return 'low';
    return 'none';
  };

  if (loading) {
    return <div className="history-container">Loading...</div>;
  }

  if (error) {
    return <div className="history-container error">{error}</div>;
  }

  return (
    <main className="history-container">
      <div className="history-header">
        <h2>Analysis History</h2>
      </div>

      <div className="history-content">
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
              {sortedHistory.map((analysis) => (
                <tr key={analysis._id}>
                  <td>{analysis._id}</td>
                  <td>{analysis.files?.[0]?.path || analysis.repoUrl || 'Unknown'}</td>
                  <td>{formatDate(analysis.date)}</td>
                  <td className={`vulnerabilities ${getSeverityClass(analysis.results)}`}>
                    <div className="vulnerability-summary">
                      {getTotalVulnerabilities(analysis.results)}
                      <span className="vulnerability-breakdown">
                        {analysis.results?.summary?.highSeverity > 0 && (
                          <span className="high">{analysis.results.summary.highSeverity}H</span>
                        )}
                        {analysis.results?.summary?.mediumSeverity > 0 && (
                          <span className="medium">{analysis.results.summary.mediumSeverity}M</span>
                        )}
                        {analysis.results?.summary?.lowSeverity > 0 && (
                          <span className="low">{analysis.results.summary.lowSeverity}L</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => setSelectedAnalysis(analysis)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedAnalysis && (
          <div className="analysis-details">
            <h3>Analysis Details</h3>
            <div className="details-content">
              <div className="detail-item">
                <strong>Project:</strong> {selectedAnalysis.files?.[0]?.path || selectedAnalysis.repoUrl || 'Unknown'}
              </div>
              <div className="detail-item">
                <strong>Date:</strong> {formatDate(selectedAnalysis.date)}
              </div>
              <div className="detail-item">
                <strong>Status:</strong> {selectedAnalysis.status}
              </div>
              {selectedAnalysis.results?.files?.map((file, fileIndex) => (
                file.vulnerabilities.length > 0 && (
                  <div key={fileIndex} className="file-vulnerabilities">
                    <h4>{file.path}</h4>
                    {file.vulnerabilities.map((vuln, vulnIndex) => (
                      <div key={vulnIndex} className={`vulnerability-item ${vuln.severity}`}>
                        <h5>Line {vuln.line}:{vuln.column}</h5>
                        <p>{vuln.description}</p>
                        <p className="suggestion">{vuln.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => setSelectedAnalysis(null)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </main>
  );
}