import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  BellIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import { useSocket } from '../hooks/useSocket';

export default function RotationSchedule() {
  const { realtimeData } = useSocket();
  const [schedules, setSchedules] = useState([]);
  const [upcomingRotations, setUpcomingRotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState({
    totalScheduled: 0,
    dueToday: 0,
    overdue: 0,
    completedThisMonth: 0,
  });

  useEffect(() => {
    fetchSchedules();
    fetchStats();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/rotation/schedules');
      setSchedules(response.data);
      
      // Filter upcoming rotations
      const upcoming = response.data
        .filter(s => s.status === 'scheduled' && new Date(s.nextRotation) > new Date())
        .sort((a, b) => new Date(a.nextRotation) - new Date(b.nextRotation));
      setUpcomingRotations(upcoming);
    } catch (error) {
      toast.error('Failed to fetch rotation schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/rotation/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch rotation stats:', error);
    }
  };

  const createSchedule = async (scheduleData) => {
    try {
      const response = await axios.post('/api/rotation/schedules', scheduleData);
      setSchedules([...schedules, response.data]);
      setShowCreateModal(false);
      toast.success('Rotation schedule created successfully');
      fetchSchedules();
    } catch (error) {
      toast.error('Failed to create rotation schedule');
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (!confirm('Are you sure you want to delete this rotation schedule?')) return;
    
    try {
      await axios.delete(`/api/rotation/schedules/${scheduleId}`);
      setSchedules(schedules.filter(s => s.id !== scheduleId));
      toast.success('Schedule deleted successfully');
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  const rotateNow = async (scheduleId) => {
    try {
      await axios.post(`/api/rotation/schedules/${scheduleId}/rotate`);
      toast.success('Key rotated successfully');
      fetchSchedules();
    } catch (error) {
      toast.error('Failed to rotate key');
    }
  };

  const getStatusColor = (schedule) => {
    const nextRotation = new Date(schedule.nextRotation);
    const now = new Date();
    const daysUntil = Math.floor((nextRotation - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'text-red-600 bg-red-100';
    if (daysUntil <= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rotation Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage automatic API key rotation schedules
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Create Schedule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-blue-100 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Scheduled</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalScheduled}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-yellow-100 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Due Today</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.dueToday}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-red-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.overdue}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-green-100 rounded-lg">
                <ArrowPathIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed (30d)</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.completedThisMonth}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming rotations */}
      {upcomingRotations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Rotations</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {upcomingRotations.slice(0, 5).map((schedule) => {
                const daysUntil = Math.floor((new Date(schedule.nextRotation) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={schedule.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${getStatusColor(schedule)}`}>
                        <ClockIcon className="h-5 w-5" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{schedule.keyName}</p>
                        <p className="text-sm text-gray-500">
                          {daysUntil === 0 ? 'Due today' : 
                           daysUntil === 1 ? 'Due tomorrow' :
                           `Due in ${daysUntil} days`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => rotateNow(schedule.id)}
                      className="text-sm text-primary-600 hover:text-primary-900"
                    >
                      Rotate Now
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Schedules table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                API Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Frequency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Rotation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Rotated
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notifications
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : schedules.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                  No rotation schedules configured
                </td>
              </tr>
            ) : (
              schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{schedule.keyName}</div>
                    <div className="text-sm text-gray-500">{schedule.keyId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Every {schedule.frequencyDays} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(schedule.nextRotation), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(schedule.nextRotation), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {schedule.lastRotated ? 
                      format(new Date(schedule.lastRotated), 'MMM d, yyyy') : 
                      'Never'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`status-indicator ${
                      schedule.status === 'active' ? 'status-active' :
                      schedule.status === 'paused' ? 'status-inactive' :
                      'status-expired'
                    }`}>
                      {schedule.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      {schedule.notificationsEnabled ? (
                        <>
                          <BellIcon className="h-4 w-4 mr-1 text-green-500" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <BellIcon className="h-4 w-4 mr-1 text-gray-400" />
                          Disabled
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => rotateNow(schedule.id)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Rotate now"
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete schedule"
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

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <CreateScheduleModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createSchedule}
        />
      )}
    </div>
  );
}

function CreateScheduleModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    keyId: '',
    frequencyDays: '30',
    notificationsEnabled: true,
    notifyBeforeDays: '3',
  });
  const [availableKeys, setAvailableKeys] = useState([]);

  useEffect(() => {
    fetchAvailableKeys();
  }, []);

  const fetchAvailableKeys = async () => {
    try {
      const response = await axios.get('/api/keys?status=active');
      setAvailableKeys(response.data);
    } catch (error) {
      console.error('Failed to fetch keys:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create Rotation Schedule</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <select
                value={formData.keyId}
                onChange={(e) => setFormData({ ...formData, keyId: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                required
              >
                <option value="">Select a key...</option>
                {availableKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Rotation Frequency
              </label>
              <select
                value={formData.frequencyDays}
                onChange={(e) => setFormData({ ...formData, frequencyDays: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="7">Every 7 days</option>
                <option value="14">Every 14 days</option>
                <option value="30">Every 30 days</option>
                <option value="60">Every 60 days</option>
                <option value="90">Every 90 days</option>
              </select>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notificationsEnabled}
                  onChange={(e) => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Enable email notifications
                </span>
              </label>
            </div>
            {formData.notificationsEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notify Before
                </label>
                <select
                  value={formData.notifyBeforeDays}
                  onChange={(e) => setFormData({ ...formData, notifyBeforeDays: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="1">1 day before</option>
                  <option value="3">3 days before</option>
                  <option value="7">7 days before</option>
                </select>
              </div>
            )}
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
              Create Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}