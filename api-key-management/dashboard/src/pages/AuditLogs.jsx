import React, { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  UserIcon,
  KeyIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const eventTypeIcons = {
  'key.created': { icon: KeyIcon, color: 'text-green-600 bg-green-100' },
  'key.deleted': { icon: XCircleIcon, color: 'text-red-600 bg-red-100' },
  'key.rotated': { icon: ArrowPathIcon, color: 'text-blue-600 bg-blue-100' },
  'key.validated': { icon: ShieldCheckIcon, color: 'text-purple-600 bg-purple-100' },
  'key.expired': { icon: ExclamationTriangleIcon, color: 'text-yellow-600 bg-yellow-100' },
  'auth.login': { icon: UserIcon, color: 'text-indigo-600 bg-indigo-100' },
  'auth.logout': { icon: UserIcon, color: 'text-gray-600 bg-gray-100' },
  'system.error': { icon: ExclamationTriangleIcon, color: 'text-red-600 bg-red-100' },
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    eventType: 'all',
    dateRange: '7d',
    user: 'all',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 50,
    total: 0,
  });
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [filters, pagination.page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        perPage: pagination.perPage,
        ...filters,
      });
      const response = await axios.get(`/api/audit/logs?${params}`);
      setLogs(response.data.logs);
      setPagination(prev => ({ ...prev, total: response.data.total }));
    } catch (error) {
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await axios.get(`/api/audit/export?${params}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Audit logs exported successfully');
    } catch (error) {
      toast.error('Failed to export audit logs');
    }
  };

  const getEventIcon = (eventType) => {
    const config = eventTypeIcons[eventType] || {
      icon: DocumentTextIcon,
      color: 'text-gray-600 bg-gray-100',
    };
    const Icon = config.icon;
    return (
      <div className={`p-2 rounded-lg ${config.color}`}>
        <Icon className="h-5 w-5" />
      </div>
    );
  };

  const totalPages = Math.ceil(pagination.total / pagination.perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            View system activity and security events
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={exportLogs}
            className="btn btn-secondary"
          >
            <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" />
            Export Logs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Search</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="Search logs..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Event Type</label>
              <select
                value={filters.eventType}
                onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="all">All Events</option>
                <option value="key.created">Key Created</option>
                <option value="key.deleted">Key Deleted</option>
                <option value="key.rotated">Key Rotated</option>
                <option value="key.validated">Key Validated</option>
                <option value="auth.login">Login</option>
                <option value="auth.logout">Logout</option>
                <option value="system.error">System Error</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    search: '',
                    eventType: 'all',
                    dateRange: '7d',
                    user: 'all',
                  });
                  setPagination({ ...pagination, page: 1 });
                }}
                className="btn btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logs table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getEventIcon(log.eventType)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {log.eventType.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-sm text-gray-500">{log.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{log.user?.name || 'System'}</div>
                    <div className="text-sm text-gray-500">{log.user?.email || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.resource || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ipAddress}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{format(new Date(log.timestamp), 'MMM d, yyyy')}</div>
                    <div className="text-xs text-gray-400">
                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
              disabled={pagination.page === 1}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination({ ...pagination, page: Math.min(totalPages, pagination.page + 1) })}
              disabled={pagination.page === totalPages}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(pagination.page - 1) * pagination.perPage + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.perPage, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Previous
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPagination({ ...pagination, page: i + 1 })}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      pagination.page === i + 1
                        ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPagination({ ...pagination, page: Math.min(totalPages, pagination.page + 1) })}
                  disabled={pagination.page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Log detail modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

function LogDetailModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Audit Log Details</h3>
        </div>
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Event Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{log.eventType}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{log.description}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">User</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {log.user?.name || 'System'} {log.user?.email && `(${log.user.email})`}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Timestamp</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {format(new Date(log.timestamp), 'MMMM d, yyyy HH:mm:ss')}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">IP Address</dt>
              <dd className="mt-1 text-sm text-gray-900">{log.ipAddress}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">User Agent</dt>
              <dd className="mt-1 text-sm text-gray-900 break-all">{log.userAgent}</dd>
            </div>
            {log.resource && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Resource</dt>
                <dd className="mt-1 text-sm text-gray-900">{log.resource}</dd>
              </div>
            )}
            {log.metadata && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Additional Data</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}