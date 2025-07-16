import React, { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useSocket } from '../hooks/useSocket';

export default function KeyValidation() {
  const { realtimeData } = useSocket();
  const [validationKey, setValidationKey] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationHistory, setValidationHistory] = useState([]);
  const [stats, setStats] = useState({
    totalValidations: 0,
    successRate: 0,
    avgResponseTime: 0,
    failureReasons: [],
  });

  useEffect(() => {
    fetchValidationStats();
    fetchValidationHistory();
  }, []);

  const fetchValidationStats = async () => {
    try {
      const response = await axios.get('/api/validation/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch validation stats:', error);
    }
  };

  const fetchValidationHistory = async () => {
    try {
      const response = await axios.get('/api/validation/history');
      setValidationHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch validation history:', error);
    }
  };

  const validateKey = async () => {
    if (!validationKey.trim()) {
      toast.error('Please enter an API key to validate');
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const startTime = Date.now();
      const response = await axios.post('/api/validation/validate', {
        key: validationKey,
      });
      const responseTime = Date.now() - startTime;

      setValidationResult({
        ...response.data,
        responseTime,
      });

      if (response.data.valid) {
        toast.success('API key is valid');
      } else {
        toast.error(`Invalid key: ${response.data.reason}`);
      }

      // Refresh history
      fetchValidationHistory();
      fetchValidationStats();
    } catch (error) {
      setValidationResult({
        valid: false,
        reason: error.response?.data?.message || 'Validation failed',
        responseTime: 0,
      });
      toast.error('Failed to validate API key');
    } finally {
      setValidating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      validateKey();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Key Validation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Validate API keys and check their permissions
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-primary-100 rounded-lg">
                <ShieldCheckIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Validations</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalValidations}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Success Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.successRate}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-blue-100 rounded-lg">
                <ClockIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Response Time</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.avgResponseTime}ms</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation form */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Validate API Key</h3>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  value={validationKey}
                  onChange={(e) => setValidationKey(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter API key to validate..."
                  className="flex-1 focus:ring-primary-500 focus:border-primary-500 block w-full min-w-0 rounded-md sm:text-sm border-gray-300"
                  disabled={validating}
                />
                <button
                  onClick={validateKey}
                  disabled={validating}
                  className="ml-3 btn btn-primary"
                >
                  {validating ? (
                    <>
                      <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="-ml-1 mr-2 h-5 w-5" />
                      Validate
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Validation result */}
            {validationResult && (
              <div className={`rounded-lg p-4 ${
                validationResult.valid
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {validationResult.valid ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className={`text-sm font-medium ${
                      validationResult.valid ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {validationResult.valid ? 'Valid API Key' : 'Invalid API Key'}
                    </h3>
                    <div className={`mt-2 text-sm ${
                      validationResult.valid ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {validationResult.valid ? (
                        <div className="space-y-1">
                          <p>Key Name: {validationResult.keyInfo?.name}</p>
                          <p>Status: {validationResult.keyInfo?.status}</p>
                          <p>Created: {format(new Date(validationResult.keyInfo?.createdAt), 'MMM d, yyyy')}</p>
                          <p>Response Time: {validationResult.responseTime}ms</p>
                          {validationResult.keyInfo?.permissions && (
                            <div>
                              <p>Permissions:</p>
                              <ul className="ml-4 mt-1 list-disc">
                                {validationResult.keyInfo.permissions.map((perm, idx) => (
                                  <li key={idx}>{perm}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p>Reason: {validationResult.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Common failure reasons */}
      {stats.failureReasons.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Common Failure Reasons</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {stats.failureReasons.map((reason, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3" />
                    <span className="text-sm text-gray-700">{reason.reason}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {reason.count} occurrences ({reason.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Validation history */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Recent Validations</h3>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key (Masked)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {validationHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                    No validation history
                  </td>
                </tr>
              ) : (
                validationHistory.map((validation) => (
                  <tr key={validation.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(validation.timestamp), 'MMM d, h:mm a')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {validation.keyMasked}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`status-indicator ${
                        validation.valid ? 'status-active' : 'status-expired'
                      }`}>
                        {validation.valid ? 'Valid' : 'Invalid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {validation.responseTime}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {validation.valid ? validation.keyName : validation.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}