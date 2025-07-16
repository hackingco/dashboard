import React, { useState, useEffect } from 'react';
import { Eye, Search, RefreshCw, ExternalLink } from 'lucide-react';

const Traces = () => {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrace, setSelectedTrace] = useState(null);

  useEffect(() => {
    fetchTraces();
    const interval = setInterval(fetchTraces, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTraces = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/traces');
      const data = await response.json();
      setTraces(data.traces || []);
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTraceDetails = async (traceId) => {
    try {
      const response = await fetch(`http://localhost:3002/api/traces/${traceId}`);
      const data = await response.json();
      setSelectedTrace(data);
    } catch (error) {
      console.error('Failed to fetch trace details:', error);
    }
  };

  const filteredTraces = traces.filter(trace =>
    trace.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trace.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading traces...</div>;
  }

  return (
    <div className="traces-page">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Trace Explorer</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
              <input
                type="text"
                placeholder="Search traces..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem 0.5rem 2.5rem',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  width: '200px'
                }}
              />
            </div>
            <button onClick={fetchTraces} className="btn">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
        <div className="card-content">
          <p>Explore and analyze Langfuse traces from swarm operations.</p>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Traces List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Traces ({filteredTraces.length})</h3>
          </div>
          <div className="card-content">
            {filteredTraces.length > 0 ? (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredTraces.map((trace) => (
                  <div
                    key={trace.id}
                    onClick={() => fetchTraceDetails(trace.id)}
                    style={{
                      padding: '1rem',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      marginBottom: '0.75rem',
                      cursor: 'pointer',
                      background: selectedTrace?.trace?.id === trace.id ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.05)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#00d4ff' }}>
                        {trace.id}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                        {new Date(trace.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                      {trace.name || 'Unnamed Trace'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
                      User: {trace.userId || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.7)' }}>
                {searchTerm ? 'No traces match your search.' : 'No traces found.'}
              </div>
            )}
          </div>
        </div>

        {/* Trace Details */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Trace Details</h3>
            {selectedTrace && (
              <a
                href={`http://localhost:3000/traces/${selectedTrace.trace.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
              >
                <ExternalLink size={16} />
                View in Langfuse
              </a>
            )}
          </div>
          <div className="card-content">
            {selectedTrace ? (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {/* Trace Info */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#00d4ff' }}>Trace Information</h4>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div><strong>ID:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedTrace.trace.id}</span></div>
                    <div><strong>Name:</strong> {selectedTrace.trace.name || 'Unnamed'}</div>
                    <div><strong>Timestamp:</strong> {new Date(selectedTrace.trace.timestamp).toLocaleString()}</div>
                    <div><strong>User ID:</strong> {selectedTrace.trace.userId || 'Unknown'}</div>
                    {selectedTrace.trace.startTime && (
                      <div><strong>Start Time:</strong> {new Date(selectedTrace.trace.startTime).toLocaleString()}</div>
                    )}
                    {selectedTrace.trace.endTime && (
                      <div><strong>End Time:</strong> {new Date(selectedTrace.trace.endTime).toLocaleString()}</div>
                    )}
                  </div>
                </div>

                {/* Input/Output */}
                {(selectedTrace.trace.input || selectedTrace.trace.output) && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#10b981' }}>Input/Output</h4>
                    {selectedTrace.trace.input && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong>Input:</strong>
                        <pre style={{ 
                          background: 'rgba(0,0,0,0.3)', 
                          padding: '0.75rem', 
                          borderRadius: '6px', 
                          fontSize: '0.75rem',
                          marginTop: '0.25rem',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(selectedTrace.trace.input, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedTrace.trace.output && (
                      <div>
                        <strong>Output:</strong>
                        <pre style={{ 
                          background: 'rgba(0,0,0,0.3)', 
                          padding: '0.75rem', 
                          borderRadius: '6px', 
                          fontSize: '0.75rem',
                          marginTop: '0.25rem',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(selectedTrace.trace.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Spans */}
                {selectedTrace.spans && selectedTrace.spans.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#f59e0b' }}>Spans ({selectedTrace.spans.length})</h4>
                    {selectedTrace.spans.map((span, index) => (
                      <div key={span.id || index} style={{
                        background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                          {span.name || `Span ${index + 1}`}
                        </div>
                        <div style={{ fontSize: '0.875rem', display: 'grid', gap: '0.25rem' }}>
                          <div><strong>ID:</strong> <span style={{ fontFamily: 'monospace' }}>{span.id}</span></div>
                          {span.startTime && (
                            <div><strong>Start:</strong> {new Date(span.startTime).toLocaleTimeString()}</div>
                          )}
                          {span.endTime && (
                            <div><strong>End:</strong> {new Date(span.endTime).toLocaleTimeString()}</div>
                          )}
                          {span.startTime && span.endTime && (
                            <div><strong>Duration:</strong> {Math.round(new Date(span.endTime) - new Date(span.startTime))}ms</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                {selectedTrace.trace.metadata && (
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#8b5cf6' }}>Metadata</h4>
                    <pre style={{ 
                      background: 'rgba(139,92,246,0.1)', 
                      border: '1px solid rgba(139,92,246,0.2)',
                      padding: '0.75rem', 
                      borderRadius: '6px', 
                      fontSize: '0.75rem',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(selectedTrace.trace.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.7)' }}>
                <Eye size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <div>Select a trace to view details</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Traces;