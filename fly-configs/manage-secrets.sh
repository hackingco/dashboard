#!/bin/bash
# Manage secrets for Hive Mind deployment

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to set secret for an app
set_secret() {
    local app=$1
    local key=$2
    local value=$3
    
    echo -e "${YELLOW}🔐 Setting ${key} for ${app}...${NC}"
    fly secrets set "${key}=${value}" --app "${app}"
}

# Function to set multiple secrets
set_secrets_bulk() {
    local app=$1
    shift
    local secrets=("$@")
    
    echo -e "${YELLOW}🔐 Setting multiple secrets for ${app}...${NC}"
    fly secrets set "${secrets[@]}" --app "${app}"
}

# Function to import secrets from .env file
import_secrets() {
    local app=$1
    local env_file=$2
    
    if [ ! -f "$env_file" ]; then
        echo -e "${RED}❌ Error: File ${env_file} not found${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}📄 Importing secrets from ${env_file} to ${app}...${NC}"
    fly secrets import --app "${app}" < "${env_file}"
}

# Function to list secrets
list_secrets() {
    local app=$1
    
    echo -e "${BLUE}📋 Secrets for ${app}:${NC}"
    fly secrets list --app "${app}"
}

# Function to unset secret
unset_secret() {
    local app=$1
    local key=$2
    
    echo -e "${YELLOW}🗑️  Removing ${key} from ${app}...${NC}"
    fly secrets unset "${key}" --app "${app}"
}

# Main menu
show_menu() {
    echo -e "${GREEN}🐝 Hive Mind Secrets Manager${NC}"
    echo -e "${BLUE}========================${NC}"
    echo "1) Set individual secret"
    echo "2) Set multiple secrets"
    echo "3) Import from .env file"
    echo "4) List secrets"
    echo "5) Remove secret"
    echo "6) Setup all required secrets"
    echo "7) Exit"
}

# Setup all required secrets
setup_all_secrets() {
    echo -e "${GREEN}🔧 Setting up all required secrets${NC}"
    
    # Manager secrets
    echo -e "${BLUE}Manager API Secrets:${NC}"
    read -p "SUPABASE_URL: " SUPABASE_URL
    read -p "SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY
    read -p "FLY_API_TOKEN: " FLY_API_TOKEN
    read -p "LANGFUSE_PUBLIC_KEY (optional): " LANGFUSE_PUBLIC_KEY
    read -p "LANGFUSE_SECRET_KEY (optional): " LANGFUSE_SECRET_KEY
    
    if fly apps list | grep -q "manager-app"; then
        secrets=("SUPABASE_URL=$SUPABASE_URL" "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" "FLY_API_TOKEN=$FLY_API_TOKEN")
        
        if [ -n "$LANGFUSE_PUBLIC_KEY" ]; then
            secrets+=("LANGFUSE_PUBLIC_KEY=$LANGFUSE_PUBLIC_KEY")
        fi
        
        if [ -n "$LANGFUSE_SECRET_KEY" ]; then
            secrets+=("LANGFUSE_SECRET_KEY=$LANGFUSE_SECRET_KEY")
        fi
        
        set_secrets_bulk "manager-app" "${secrets[@]}"
    fi
    
    # Dashboard secrets
    echo -e "${BLUE}Dashboard Secrets:${NC}"
    read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if fly apps list | grep -q "dashboard-app"; then
        set_secrets_bulk "dashboard-app" \
            "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL" \
            "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    fi
    
    echo -e "${GREEN}✅ All required secrets configured!${NC}"
}

# Main loop
if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -p "Select option: " choice
        
        case $choice in
            1)
                read -p "App name: " app
                read -p "Secret key: " key
                read -s -p "Secret value: " value
                echo
                set_secret "$app" "$key" "$value"
                ;;
            2)
                read -p "App name: " app
                echo "Enter secrets in KEY=VALUE format (one per line, empty line to finish):"
                secrets=()
                while IFS= read -r line; do
                    [ -z "$line" ] && break
                    secrets+=("$line")
                done
                set_secrets_bulk "$app" "${secrets[@]}"
                ;;
            3)
                read -p "App name: " app
                read -p "Path to .env file: " env_file
                import_secrets "$app" "$env_file"
                ;;
            4)
                read -p "App name (or 'all' for all apps): " app
                if [ "$app" = "all" ]; then
                    for a in manager-app dashboard-app; do
                        list_secrets "$a"
                    done
                else
                    list_secrets "$app"
                fi
                ;;
            5)
                read -p "App name: " app
                read -p "Secret key to remove: " key
                unset_secret "$app" "$key"
                ;;
            6)
                setup_all_secrets
                ;;
            7)
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac
        
        echo
        read -p "Press Enter to continue..."
    done
else
    # Command line mode
    case "$1" in
        set)
            set_secret "$2" "$3" "$4"
            ;;
        import)
            import_secrets "$2" "$3"
            ;;
        list)
            list_secrets "$2"
            ;;
        unset)
            unset_secret "$2" "$3"
            ;;
        setup)
            setup_all_secrets
            ;;
        *)
            echo "Usage: $0 [set|import|list|unset|setup] [args...]"
            echo "  set <app> <key> <value>  - Set a single secret"
            echo "  import <app> <file>      - Import secrets from .env file"
            echo "  list <app>               - List secrets for an app"
            echo "  unset <app> <key>        - Remove a secret"
            echo "  setup                    - Setup all required secrets"
            exit 1
            ;;
    esac
fi