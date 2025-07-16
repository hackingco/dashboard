import React, { useState, useEffect } from 'react';
import {
  CogIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  FingerPrintIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BellIcon,
  ClockIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SecuritySettings() {
  const [settings, setSettings] = useState({
    general: {
      enforceHttps: true,
      allowApiKeyInQuery: false,
      requireUserAgent: true,
      maxFailedAttempts: 5,
      lockoutDuration: 300, // seconds
    },
    rotation: {
      enforceRotation: true,
      maxKeyAge: 90, // days
      warningBeforeExpiry: 7, // days
      autoRotateOnExpiry: false,
    },
    validation: {
      strictValidation: true,
      checkIpWhitelist: false,
      ipWhitelist: [],
      checkRateLimit: true,
      rateLimitPerMinute: 60,
      rateLimitPerHour: 1000,
    },
    notifications: {
      emailOnKeyCreation: true,
      emailOnKeyRotation: true,
      emailOnKeyDeletion: true,
      emailOnSuspiciousActivity: true,
      webhookEnabled: false,
      webhookUrl: '',
    },
    advanced: {
      enableAuditLog: true,
      logRetentionDays: 90,
      enableEncryption: true,
      encryptionAlgorithm: 'AES-256-GCM',
      enableBackup: true,
      backupFrequency: 'daily',
    },
  });
  
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/security/settings');
      setSettings(response.data);
    } catch (error) {
      toast.error('Failed to fetch security settings');
    }
  };

  const saveSettings = async (section) => {
    try {
      setSaving(true);
      await axios.put('/api/security/settings', {
        section,
        settings: settings[section],
      });
      toast.success('Security settings updated successfully');
    } catch (error) {
      toast.error('Failed to update security settings');
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async () => {
    if (!settings.notifications.webhookUrl) {
      toast.error('Please enter a webhook URL');
      return;
    }

    try {
      setTestingWebhook(true);
      await axios.post('/api/security/test-webhook', {
        url: settings.notifications.webhookUrl,
      });
      toast.success('Webhook test successful');
    } catch (error) {
      toast.error('Webhook test failed');
    } finally {
      setTestingWebhook(false);
    }
  };

  const addIpToWhitelist = () => {
    const ip = prompt('Enter IP address to whitelist:');
    if (ip) {
      setSettings({
        ...settings,
        validation: {
          ...settings.validation,
          ipWhitelist: [...settings.validation.ipWhitelist, ip],
        },
      });
    }
  };

  const removeIpFromWhitelist = (ip) => {
    setSettings({
      ...settings,
      validation: {
        ...settings.validation,
        ipWhitelist: settings.validation.ipWhitelist.filter(i => i !== ip),
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure security policies and settings for your API key system
        </p>
      </div>

      {/* Security status */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <ShieldCheckIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Security Status</h3>
                <p className="text-sm text-gray-500">All security features are properly configured</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="status-indicator status-active">Secure</span>
              <span className="text-sm text-gray-500">Last audit: 2 hours ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* General Security */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">General Security</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Enforce HTTPS</label>
              <p className="text-sm text-gray-500">Require all API requests to use HTTPS</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.general.enforceHttps}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, enforceHttps: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Block API Key in Query String</label>
              <p className="text-sm text-gray-500">Prevent API keys from being passed in URL parameters</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!settings.general.allowApiKeyInQuery}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, allowApiKeyInQuery: !e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Require User-Agent Header</label>
              <p className="text-sm text-gray-500">Reject requests without a User-Agent header</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.general.requireUserAgent}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, requireUserAgent: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Failed Attempts
              </label>
              <input
                type="number"
                value={settings.general.maxFailedAttempts}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, maxFailedAttempts: parseInt(e.target.value) }
                })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Lockout Duration (seconds)
              </label>
              <input
                type="number"
                value={settings.general.lockoutDuration}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, lockoutDuration: parseInt(e.target.value) }
                })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => saveSettings('general')}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Rotation Policy */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Rotation Policy</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Enforce Key Rotation</label>
              <p className="text-sm text-gray-500">Require periodic rotation of API keys</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.rotation.enforceRotation}
                onChange={(e) => setSettings({
                  ...settings,
                  rotation: { ...settings.rotation, enforceRotation: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Maximum Key Age (days)
              </label>
              <input
                type="number"
                value={settings.rotation.maxKeyAge}
                onChange={(e) => setSettings({
                  ...settings,
                  rotation: { ...settings.rotation, maxKeyAge: parseInt(e.target.value) }
                })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Warning Before Expiry (days)
              </label>
              <input
                type="number"
                value={settings.rotation.warningBeforeExpiry}
                onChange={(e) => setSettings({
                  ...settings,
                  rotation: { ...settings.rotation, warningBeforeExpiry: parseInt(e.target.value) }
                })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Auto-rotate on Expiry</label>
              <p className="text-sm text-gray-500">Automatically rotate keys when they expire</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.rotation.autoRotateOnExpiry}
                onChange={(e) => setSettings({
                  ...settings,
                  rotation: { ...settings.rotation, autoRotateOnExpiry: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="pt-4">
            <button
              onClick={() => saveSettings('rotation')}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save Rotation Policy'}
            </button>
          </div>
        </div>
      </div>

      {/* Validation Rules */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Validation Rules</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Strict Validation</label>
              <p className="text-sm text-gray-500">Enable additional validation checks</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.validation.strictValidation}
                onChange={(e) => setSettings({
                  ...settings,
                  validation: { ...settings.validation, strictValidation: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">IP Whitelist</label>
              <p className="text-sm text-gray-500">Restrict API access to specific IP addresses</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.validation.checkIpWhitelist}
                onChange={(e) => setSettings({
                  ...settings,
                  validation: { ...settings.validation, checkIpWhitelist: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {settings.validation.checkIpWhitelist && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Whitelisted IPs</label>
                <button
                  onClick={addIpToWhitelist}
                  className="text-sm text-primary-600 hover:text-primary-900"
                >
                  Add IP
                </button>
              </div>
              <div className="space-y-2">
                {settings.validation.ipWhitelist.length === 0 ? (
                  <p className="text-sm text-gray-500">No IPs whitelisted</p>
                ) : (
                  settings.validation.ipWhitelist.map((ip) => (
                    <div key={ip} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <code className="text-sm">{ip}</code>
                      <button
                        onClick={() => removeIpFromWhitelist(ip)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Rate Limiting</label>
              <p className="text-sm text-gray-500">Limit API requests per key</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.validation.checkRateLimit}
                onChange={(e) => setSettings({
                  ...settings,
                  validation: { ...settings.validation, checkRateLimit: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {settings.validation.checkRateLimit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Requests per Minute
                </label>
                <input
                  type="number"
                  value={settings.validation.rateLimitPerMinute}
                  onChange={(e) => setSettings({
                    ...settings,
                    validation: { ...settings.validation, rateLimitPerMinute: parseInt(e.target.value) }
                  })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Requests per Hour
                </label>
                <input
                  type="number"
                  value={settings.validation.rateLimitPerHour}
                  onChange={(e) => setSettings({
                    ...settings,
                    validation: { ...settings.validation, rateLimitPerHour: parseInt(e.target.value) }
                  })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              onClick={() => saveSettings('validation')}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save Validation Rules'}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.emailOnKeyCreation}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailOnKeyCreation: e.target.checked }
                })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Email on key creation</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.emailOnKeyRotation}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailOnKeyRotation: e.target.checked }
                })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Email on key rotation</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.emailOnKeyDeletion}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailOnKeyDeletion: e.target.checked }
                })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Email on key deletion</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.emailOnSuspiciousActivity}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailOnSuspiciousActivity: e.target.checked }
                })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Email on suspicious activity</span>
            </label>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Webhook Notifications</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.webhookEnabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, webhookEnabled: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {settings.notifications.webhookEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="url"
                    value={settings.notifications.webhookUrl}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, webhookUrl: e.target.value }
                    })}
                    placeholder="https://example.com/webhook"
                    className="flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                  />
                  <button
                    onClick={testWebhook}
                    disabled={testingWebhook}
                    className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm hover:bg-gray-100"
                  >
                    {testingWebhook ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4">
            <button
              onClick={() => saveSettings('notifications')}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}