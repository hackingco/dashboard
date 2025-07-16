
setInterval(async () => {
  const timestamp = new Date().toISOString();
  const agentStatuses = ["agent_1752502984645_49ej94","agent_1752502984717_ia9189","agent_1752502984789_y3bzb9","agent_1752502984871_knkbv7","agent_1752502984958_fukrua","agent_1752502985037_v9pe4e","agent_1752502985121_98ojvl","agent_1752502985200_coordination"].map(agentId => ({
    agentId,
    timestamp,
    status: 'active',
    lastActivity: timestamp
  }));
  
  for (const status of agentStatuses) {
    await require('child_process').exec(
      `npx claude-flow@alpha hooks notification --message "Agent ${status.agentId} heartbeat at ${status.timestamp}" --memory-key "agents/${status.agentId}/heartbeat" --telemetry true`
    );
  }
}, 30000);
