import React, { useState, useEffect } from 'react';
import { Shield, Clock, FileText } from 'lucide-react';

export default function AuditLogs({ token, addToast, tournament }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tournament) return;
    setLoading(true);
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/audit-logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLogs(data);
        }
      })
      .catch(err => {
        console.error(err);
        addToast('Failed to load audit logs', 'danger');
      })
      .finally(() => setLoading(false));
  }, [tournament]);

  return (
    <div style={{ padding: '0 15px 40px 15px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <section className="glass-panel" style={{ padding: '15px 24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)' }} className="text-gradient">Audit Logs</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Review historical system activity, bid cancellations, status switches, and configuration revisions</span>
      </section>

      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading audit history...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No logs generated in this session.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>@{log.username || 'System'}</td>
                  <td>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold', 
                      backgroundColor: log.action.includes('SELL') || log.action.includes('SOLD') ? 'rgba(16, 185, 129, 0.15)' : log.action.includes('CANCEL') ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)', 
                      color: log.action.includes('SELL') || log.action.includes('SOLD') ? 'var(--success)' : log.action.includes('CANCEL') ? 'var(--danger)' : 'var(--text-primary)',
                      padding: '3px 8px', 
                      borderRadius: '4px' 
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
