'use client'

import React, { useState } from 'react'
import { Play, Pause, Square, RotateCcw, Power, PowerOff, Archive, Download, Upload, Clock, AlertTriangle, CheckCircle, Settings, Trash2, Copy, Edit, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SwarmSnapshot {
  id: string
  name: string
  timestamp: string
  version: string
  size: string
  agentCount: number
  status: 'creating' | 'ready' | 'restoring' | 'failed'
  metadata: {
    creator: string
    description: string
    tags: string[]
  }
}

interface SwarmBackup {
  id: string
  name: string
  timestamp: string
  type: 'full' | 'incremental' | 'configuration'
  size: string
  status: 'in_progress' | 'completed' | 'failed' | 'corrupted'
  retention: number
  location: string
}

interface SwarmMigration {
  id: string
  name: string
  sourceRegion: string
  targetRegion: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startTime?: string
  estimatedCompletion?: string
  downtime: number
  strategy: 'blue-green' | 'rolling' | 'canary'
}

interface SwarmLifecycleData {
  swarmId: string
  swarmName: string
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'maintenance' | 'migrating' | 'error'
  uptime: number
  lastAction: string
  lastActionTime: string
  snapshots: SwarmSnapshot[]
  backups: SwarmBackup[]
  migrations: SwarmMigration[]
  schedules: {
    autoBackup: {
      enabled: boolean
      frequency: 'daily' | 'weekly' | 'monthly'
      retention: number
      time: string
    }
    autoSnapshot: {
      enabled: boolean
      frequency: 'hourly' | 'daily' | 'weekly'
      retention: number
    }
    maintenance: {
      enabled: boolean
      schedule: string
      duration: number
      autoApprove: boolean
    }
  }
  permissions: {
    canStart: boolean
    canStop: boolean
    canDelete: boolean
    canBackup: boolean
    canRestore: boolean
    canMigrate: boolean
  }
}

interface SwarmLifecycleControlsProps {
  swarm: SwarmLifecycleData
  onStart: () => void
  onStop: () => void
  onRestart: () => void
  onDelete: () => void
  onCreateSnapshot: (name: string, description: string) => void
  onRestoreSnapshot: (snapshotId: string) => void
  onDeleteSnapshot: (snapshotId: string) => void
  onCreateBackup: (type: string, name: string) => void
  onRestoreBackup: (backupId: string) => void
  onDeleteBackup: (backupId: string) => void
  onStartMigration: (targetRegion: string, strategy: string) => void
  onCloneSwarm: (newName: string) => void
  onUpdateSchedules: (schedules: any) => void
  onEnterMaintenance: () => void
  onExitMaintenance: () => void
}

export const SwarmLifecycleControls: React.FC<SwarmLifecycleControlsProps> = ({
  swarm,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup,
  onStartMigration,
  onCloneSwarm,
  onUpdateSchedules,
  onEnterMaintenance,
  onExitMaintenance
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshotDescription, setSnapshotDescription] = useState('')
  const [backupName, setBackupName] = useState('')
  const [backupType, setBackupType] = useState<'full' | 'incremental' | 'configuration'>('full')
  const [cloneName, setCloneName] = useState('')
  const [migrationTarget, setMigrationTarget] = useState('')
  const [migrationStrategy, setMigrationStrategy] = useState<'blue-green' | 'rolling' | 'canary'>('blue-green')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-50'
      case 'stopped': return 'text-gray-600 bg-gray-50'
      case 'starting': case 'stopping': return 'text-blue-600 bg-blue-50'
      case 'maintenance': return 'text-yellow-600 bg-yellow-50'
      case 'migrating': return 'text-purple-600 bg-purple-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4" />
      case 'stopped': return <Square className="w-4 h-4" />
      case 'starting': return <Power className="w-4 h-4" />
      case 'stopping': return <PowerOff className="w-4 h-4" />
      case 'maintenance': return <Settings className="w-4 h-4" />
      case 'migrating': return <Upload className="w-4 h-4" />
      case 'error': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const formatSize = (sizeStr: string) => {
    const match = sizeStr.match(/^([\d.]+)(\w+)$/)
    if (!match) return sizeStr
    const [, size, unit] = match
    return `${parseFloat(size).toFixed(1)} ${unit}`
  }

  return (
    <div className="space-y-6">
      {/* Swarm Status & Primary Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <div className={`p-1 rounded mr-3 ${getStatusColor(swarm.status)}`}>
                {getStatusIcon(swarm.status)}
              </div>
              Swarm Lifecycle - {swarm.swarmName}
            </CardTitle>
            <Badge className={getStatusColor(swarm.status)}>
              {swarm.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-lg font-bold">{formatUptime(swarm.uptime)}</div>
              <div className="text-sm text-gray-600">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{swarm.snapshots.length}</div>
              <div className="text-sm text-gray-600">Snapshots</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{swarm.backups.length}</div>
              <div className="text-sm text-gray-600">Backups</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{swarm.migrations.filter(m => m.status === 'completed').length}</div>
              <div className="text-sm text-gray-600">Migrations</div>
            </div>
          </div>

          <div className="flex justify-center space-x-3">
            {swarm.status === 'stopped' && swarm.permissions.canStart && (
              <Button onClick={onStart} className="flex items-center">
                <Play className="w-4 h-4 mr-2" />
                Start Swarm
              </Button>
            )}
            
            {swarm.status === 'running' && swarm.permissions.canStop && (
              <Button variant="outline" onClick={onStop} className="flex items-center">
                <Pause className="w-4 h-4 mr-2" />
                Stop Swarm
              </Button>
            )}
            
            {(swarm.status === 'running' || swarm.status === 'stopped') && (
              <Button variant="outline" onClick={onRestart} className="flex items-center">
                <RotateCcw className="w-4 h-4 mr-2" />
                Restart
              </Button>
            )}

            {swarm.status !== 'maintenance' && (
              <Button variant="outline" onClick={onEnterMaintenance} className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Maintenance Mode
              </Button>
            )}

            {swarm.status === 'maintenance' && (
              <Button variant="outline" onClick={onExitMaintenance} className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Exit Maintenance
              </Button>
            )}

            {swarm.permissions.canDelete && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>

          <div className="mt-4 text-sm text-gray-600 text-center">
            Last action: {swarm.lastAction} at {new Date(swarm.lastActionTime).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="text-red-600">Confirm Deletion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This will permanently delete the swarm "{swarm.swarmName}" and all associated data. 
                This action cannot be undone.
              </p>
              <div className="flex space-x-2">
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    onDelete()
                    setShowDeleteConfirm(false)
                  }}
                  className="flex-1"
                >
                  Delete Permanently
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="snapshots" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="snapshots" className="flex items-center">
            <Archive className="w-4 h-4 mr-2" />
            Snapshots
          </TabsTrigger>
          <TabsTrigger value="backups" className="flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Backups
          </TabsTrigger>
          <TabsTrigger value="migrations" className="flex items-center">
            <Upload className="w-4 h-4 mr-2" />
            Migrations
          </TabsTrigger>
          <TabsTrigger value="clone" className="flex items-center">
            <Copy className="w-4 h-4 mr-2" />
            Clone
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Schedules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Snapshots</CardTitle>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Snapshot name"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    className="w-40"
                  />
                  <Input
                    placeholder="Description"
                    value={snapshotDescription}
                    onChange={(e) => setSnapshotDescription(e.target.value)}
                    className="w-48"
                  />
                  <Button 
                    onClick={() => {
                      if (snapshotName) {
                        onCreateSnapshot(snapshotName, snapshotDescription)
                        setSnapshotName('')
                        setSnapshotDescription('')
                      }
                    }}
                    disabled={!snapshotName}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Create Snapshot
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {swarm.snapshots.map(snapshot => (
                  <div key={snapshot.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{snapshot.name}</div>
                        <div className="text-sm text-gray-600">{snapshot.metadata.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(snapshot.timestamp).toLocaleString()} • 
                          {formatSize(snapshot.size)} • 
                          {snapshot.agentCount} agents • 
                          v{snapshot.version}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(snapshot.status)}>
                          {snapshot.status}
                        </Badge>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onRestoreSnapshot(snapshot.id)}
                            disabled={snapshot.status !== 'ready'}
                          >
                            Restore
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => onDeleteSnapshot(snapshot.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {snapshot.metadata.tags.length > 0 && (
                      <div className="flex space-x-1 mt-2">
                        {snapshot.metadata.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {swarm.snapshots.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No snapshots available. Create your first snapshot to preserve the current state.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Backups</CardTitle>
                <div className="flex space-x-2">
                  <Select value={backupType} onValueChange={(value: 'full' | 'incremental' | 'configuration') => setBackupType(value)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Backup</SelectItem>
                      <SelectItem value="incremental">Incremental</SelectItem>
                      <SelectItem value="configuration">Config Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Backup name"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                    className="w-40"
                  />
                  <Button 
                    onClick={() => {
                      if (backupName) {
                        onCreateBackup(backupType, backupName)
                        setBackupName('')
                      }
                    }}
                    disabled={!backupName}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Create Backup
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {swarm.backups.map(backup => (
                  <div key={backup.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{backup.name}</div>
                        <div className="text-sm text-gray-600">
                          {backup.type} backup • {formatSize(backup.size)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(backup.timestamp).toLocaleString()} • 
                          Retention: {backup.retention} days • 
                          {backup.location}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(backup.status)}>
                          {backup.status.replace('_', ' ')}
                        </Badge>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onRestoreBackup(backup.id)}
                            disabled={backup.status !== 'completed'}
                          >
                            Restore
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => onDeleteBackup(backup.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {swarm.backups.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No backups available. Create a backup to preserve your swarm data.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migrations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Migrations</CardTitle>
                <div className="flex space-x-2">
                  <Select value={migrationTarget} onValueChange={setMigrationTarget}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Target Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east">US East</SelectItem>
                      <SelectItem value="us-west">US West</SelectItem>
                      <SelectItem value="eu-central">EU Central</SelectItem>
                      <SelectItem value="asia-pacific">Asia Pacific</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={migrationStrategy} onValueChange={(value: 'blue-green' | 'rolling' | 'canary') => setMigrationStrategy(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue-green">Blue-Green</SelectItem>
                      <SelectItem value="rolling">Rolling</SelectItem>
                      <SelectItem value="canary">Canary</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => {
                      if (migrationTarget) {
                        onStartMigration(migrationTarget, migrationStrategy)
                      }
                    }}
                    disabled={!migrationTarget || !swarm.permissions.canMigrate}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Start Migration
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {swarm.migrations.map(migration => (
                  <div key={migration.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{migration.name}</div>
                        <div className="text-sm text-gray-600">
                          {migration.sourceRegion} → {migration.targetRegion} • {migration.strategy}
                        </div>
                        {migration.status === 'in_progress' && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{migration.progress}%</span>
                            </div>
                            <Progress value={migration.progress} className="h-2" />
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {migration.startTime && `Started: ${new Date(migration.startTime).toLocaleString()}`}
                          {migration.estimatedCompletion && ` • ETA: ${new Date(migration.estimatedCompletion).toLocaleString()}`}
                          {migration.downtime > 0 && ` • Downtime: ${migration.downtime}s`}
                        </div>
                      </div>
                      <Badge className={getStatusColor(migration.status)}>
                        {migration.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
                {swarm.migrations.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No migrations performed yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clone" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clone Swarm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">New Swarm Name</label>
                <Input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Enter name for cloned swarm"
                  className="mt-1"
                />
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium mb-2">Clone Options</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span>Clone configuration and settings</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span>Clone agent definitions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span>Clone current data state</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span>Start cloned swarm immediately</span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => {
                  if (cloneName) {
                    onCloneSwarm(cloneName)
                    setCloneName('')
                  }
                }}
                disabled={!cloneName}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Clone Swarm
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Auto Backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={swarm.schedules.autoBackup.enabled}
                    onChange={(e) => onUpdateSchedules({
                      ...swarm.schedules,
                      autoBackup: { ...swarm.schedules.autoBackup, enabled: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <label className="text-sm font-medium">Enable automatic backups</label>
                </div>
                
                {swarm.schedules.autoBackup.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Frequency</label>
                      <Select
                        value={swarm.schedules.autoBackup.frequency}
                        onValueChange={(value: 'daily' | 'weekly' | 'monthly') => onUpdateSchedules({
                          ...swarm.schedules,
                          autoBackup: { ...swarm.schedules.autoBackup, frequency: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Time</label>
                      <Input
                        type="time"
                        value={swarm.schedules.autoBackup.time}
                        onChange={(e) => onUpdateSchedules({
                          ...swarm.schedules,
                          autoBackup: { ...swarm.schedules.autoBackup, time: e.target.value }
                        })}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Retention (days)</label>
                      <Input
                        type="number"
                        value={swarm.schedules.autoBackup.retention}
                        onChange={(e) => onUpdateSchedules({
                          ...swarm.schedules,
                          autoBackup: { ...swarm.schedules.autoBackup, retention: parseInt(e.target.value) || 30 }
                        })}
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Auto Snapshots</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={swarm.schedules.autoSnapshot.enabled}
                    onChange={(e) => onUpdateSchedules({
                      ...swarm.schedules,
                      autoSnapshot: { ...swarm.schedules.autoSnapshot, enabled: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <label className="text-sm font-medium">Enable automatic snapshots</label>
                </div>
                
                {swarm.schedules.autoSnapshot.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Frequency</label>
                      <Select
                        value={swarm.schedules.autoSnapshot.frequency}
                        onValueChange={(value: 'hourly' | 'daily' | 'weekly') => onUpdateSchedules({
                          ...swarm.schedules,
                          autoSnapshot: { ...swarm.schedules.autoSnapshot, frequency: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Keep (count)</label>
                      <Input
                        type="number"
                        value={swarm.schedules.autoSnapshot.retention}
                        onChange={(e) => onUpdateSchedules({
                          ...swarm.schedules,
                          autoSnapshot: { ...swarm.schedules.autoSnapshot, retention: parseInt(e.target.value) || 10 }
                        })}
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Maintenance Window</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={swarm.schedules.maintenance.enabled}
                    onChange={(e) => onUpdateSchedules({
                      ...swarm.schedules,
                      maintenance: { ...swarm.schedules.maintenance, enabled: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <label className="text-sm font-medium">Enable scheduled maintenance</label>
                </div>
                
                {swarm.schedules.maintenance.enabled && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Schedule (cron)</label>
                      <Input
                        value={swarm.schedules.maintenance.schedule}
                        onChange={(e) => onUpdateSchedules({
                          ...swarm.schedules,
                          maintenance: { ...swarm.schedules.maintenance, schedule: e.target.value }
                        })}
                        placeholder="0 2 * * 0"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Weekly at 2 AM Sunday
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Duration (minutes)</label>
                      <Input
                        type="number"
                        value={swarm.schedules.maintenance.duration}
                        onChange={(e) => onUpdateSchedules({
                          ...swarm.schedules,
                          maintenance: { ...swarm.schedules.maintenance, duration: parseInt(e.target.value) || 60 }
                        })}
                        min="1"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-6">
                      <input
                        type="checkbox"
                        checked={swarm.schedules.maintenance.autoApprove}
                        onChange={(e) => onUpdateSchedules({
                          ...swarm.schedules,
                          maintenance: { ...swarm.schedules.maintenance, autoApprove: e.target.checked }
                        })}
                        className="rounded"
                      />
                      <label className="text-sm">Auto-approve</label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SwarmLifecycleControls