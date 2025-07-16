#!/bin/bash
set -e

# Create additional databases for Claude Flow
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE claude_flow;
    CREATE DATABASE swarm_coordination;
    GRANT ALL PRIVILEGES ON DATABASE claude_flow TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE swarm_coordination TO $POSTGRES_USER;
EOSQL

echo "Additional databases created successfully!"