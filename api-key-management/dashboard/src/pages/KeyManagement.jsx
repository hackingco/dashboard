import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useSocket } from '../hooks/useSocket';

export default function KeyManagement() {
  const { realtimeData } = useSocket();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showKey, setShowKey] = useState({});

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    // Update keys with realtime data
    if (realtimeData.keyStatus) {
      setKeys(prevKeys => {
        const updatedKeys = [...prevKeys];
        Object.values(realtimeData.keyStatus).forEach(realtimeKey => {
          const index = updatedKeys.findIndex(k => k.id === realtimeKey.id);
          if (index !== -1) {
            updatedKeys[index] = { ...updatedKeys[index], ...realtimeKey };
          } else {
            updatedKeys.push(realtimeKey);
          }
        });
        return updatedKeys;
      });
    }
  }, [realtimeData.keyStatus]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/keys');
      setKeys(response.data);
    } catch (error) {
      toast.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const createKey = async (keyData) => {
    try {
      const response = await axios.post('/api/keys', keyData);
      setKeys([...keys, response.data]);
      setShowCreateModal(false);
      toast.success('API key created successfully');
    } catch (error) {
      toast.error('Failed to create API key');
    }
  };

  const deleteKey = async (keyId) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    
    try {
      await axios.delete(`/api/keys/${keyId}`);
      setKeys(keys.filter(k => k.id !== keyId));
      toast.success('API key deleted successfully');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  const rotateKey = async (keyId) => {
    try {
      const response = await axios.post(`/api/keys/${keyId}/rotate`);
      setKeys(keys.map(k => k.id === keyId ? response.data : k));
      toast.success('API key rotated successfully');
    } catch (error) {
      toast.error('Failed to rotate API key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const filteredKeys = keys.filter(key => {
    const matchesSearch = key.name.toLowerCase().includes(search.toLowerCase()) ||
                         key.description?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' ||
                         (filter === 'active' && key.status === 'active') ||
                         (filter === 'inactive' && key.status === 'inactive') ||
                         (filter === 'expired' && key.status === 'expired');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your API keys and access tokens
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Create New Key
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="Search keys..."
                />
              </div>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="all">All Keys</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Keys table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Used
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
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
            ) : filteredKeys.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                  No API keys found
                </td>
              </tr>
            ) : (
              filteredKeys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{key.name}</div>
                      {key.description && (
                        <div className="text-sm text-gray-500">{key.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <code className="text-sm font-mono text-gray-600">
                        {showKey[key.id] ? key.key : '••••••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowKey({ ...showKey, [key.id]: !showKey[key.id] })}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {showKey[key.id] ? (
                          <EyeSlashIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(key.key)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`status-indicator ${
                      key.status === 'active' ? 'status-active' :
                      key.status === 'expired' ? 'status-expired' :
                      'status-inactive'
                    }`}>
                      {key.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(key.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {key.lastUsed ? format(new Date(key.lastUsed), 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => rotateKey(key.id)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Rotate key"
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => deleteKey(key.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete key"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createKey}
        />
      )}
    </div>
  );
}

function CreateKeyModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expiresIn: '30',
    permissions: [],
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create New API Key</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Expires In
              </label>
              <select
                value={formData.expiresIn}
                onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Create Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}