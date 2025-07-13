#!/bin/bash

# Docker Cleanup Script for Langfuse Testing
# Safely removes containers, networks, and volumes

echo "🧹 Docker Cleanup for Langfuse Testing"
echo "===================================="
echo ""

# Function to check if user wants to proceed
confirm() {
    read -p "$1 (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

# Stop all running containers for our project
echo "📦 Checking for running containers..."
RUNNING_CONTAINERS=$(docker ps -q --filter "label=com.docker.compose.project=langfuse-test" 2>/dev/null)
if [ ! -z "$RUNNING_CONTAINERS" ]; then
    echo "Found running containers:"
    docker ps --filter "label=com.docker.compose.project=langfuse-test" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    if confirm "Stop these containers?"; then
        docker stop $RUNNING_CONTAINERS
        echo "✅ Containers stopped"
    fi
fi

# Remove stopped containers
echo ""
echo "🗑️  Checking for stopped containers..."
STOPPED_CONTAINERS=$(docker ps -aq --filter "label=com.docker.compose.project=langfuse-test" 2>/dev/null)
if [ ! -z "$STOPPED_CONTAINERS" ]; then
    echo "Found stopped containers:"
    docker ps -a --filter "label=com.docker.compose.project=langfuse-test" --format "table {{.Names}}\t{{.Status}}"
    echo ""
    
    if confirm "Remove these containers?"; then
        docker rm $STOPPED_CONTAINERS
        echo "✅ Containers removed"
    fi
fi

# Remove networks
echo ""
echo "🌐 Checking for networks..."
NETWORKS=$(docker network ls -q --filter "name=langfuse-testing-network" 2>/dev/null)
if [ ! -z "$NETWORKS" ]; then
    echo "Found networks:"
    docker network ls --filter "name=langfuse-testing-network" --format "table {{.Name}}\t{{.Driver}}"
    echo ""
    
    if confirm "Remove these networks?"; then
        docker network rm $NETWORKS 2>/dev/null || true
        echo "✅ Networks removed"
    fi
fi

# Remove volumes
echo ""
echo "💾 Checking for volumes..."
VOLUMES=$(docker volume ls -q --filter "name=langfuse-test" 2>/dev/null)
if [ ! -z "$VOLUMES" ]; then
    echo "Found volumes:"
    docker volume ls --filter "name=langfuse-test" --format "table {{.Name}}\t{{.Driver}}"
    echo ""
    
    if confirm "Remove these volumes? (This will delete all data!)"; then
        docker volume rm $VOLUMES
        echo "✅ Volumes removed"
    fi
fi

# Clean up dangling images
echo ""
echo "🖼️  Checking for dangling images..."
DANGLING_IMAGES=$(docker images -q -f "dangling=true" 2>/dev/null)
if [ ! -z "$DANGLING_IMAGES" ]; then
    echo "Found dangling images"
    
    if confirm "Remove dangling images?"; then
        docker rmi $DANGLING_IMAGES
        echo "✅ Dangling images removed"
    fi
fi

# Check ports
echo ""
echo "🔍 Checking port usage..."
PORTS=(3000 3001 3002 5432 6379 8080 8123 9000)
USED_PORTS=()

for PORT in "${PORTS[@]}"; do
    if lsof -i :$PORT >/dev/null 2>&1; then
        PROCESS=$(lsof -i :$PORT | grep LISTEN | awk '{print $1, $2}' | tail -1)
        USED_PORTS+=("Port $PORT: $PROCESS")
    fi
done

if [ ${#USED_PORTS[@]} -gt 0 ]; then
    echo "Found processes using common ports:"
    for USED in "${USED_PORTS[@]}"; do
        echo "  - $USED"
    done
    echo ""
    echo "ℹ️  You may need to stop these processes for testing"
fi

# Summary
echo ""
echo "✨ Cleanup complete!"
echo ""
echo "To start fresh testing environment, run:"
echo "  ./port-manager.js"
echo ""