#!/bin/bash

# Script to help create safe migrations for Supabase projects
# Usage: ./create-migration.sh "migration_name"

# Check if migration name was provided
if [ $# -eq 0 ]; then
  echo "Error: Migration name is required."
  echo "Usage: ./create-migration.sh \"your_migration_name\""
  exit 1
fi

# Get the migration name from arguments
MIGRATION_NAME=$1

# Create the migration using Supabase CLI
echo "Creating migration: $MIGRATION_NAME"
supabase migration new "$MIGRATION_NAME"

# Find the most recently created migration file
MIGRATION_FILE=$(ls -t supabase/migrations/*.sql | head -1)

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Error: Failed to find the newly created migration file."
  exit 1
fi

# Check if the template file exists
TEMPLATE_FILE="supabase/templates/migration_template.sql"
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: Template file not found: $TEMPLATE_FILE"
  exit 1
fi

# Get the content of the template
TEMPLATE_CONTENT=$(cat "$TEMPLATE_FILE")

# Get the timestamp from the filename
FILENAME=$(basename "$MIGRATION_FILE")
TIMESTAMP_RAW=$(echo "$FILENAME" | cut -d'_' -f1)
TIMESTAMP_FORMATTED="${TIMESTAMP_RAW:0:4}-${TIMESTAMP_RAW:4:2}-${TIMESTAMP_RAW:6:2}T${TIMESTAMP_RAW:8:2}:${TIMESTAMP_RAW:10:2}:${TIMESTAMP_RAW:12:2}.000Z"

# Replace placeholders in the template
TEMPLATE_CONTENT=${TEMPLATE_CONTENT//\{\{MIGRATION_NAME\}\}/$MIGRATION_NAME}
TEMPLATE_CONTENT=${TEMPLATE_CONTENT//\{\{TIMESTAMP\}\}/$TIMESTAMP_FORMATTED}
TEMPLATE_CONTENT=${TEMPLATE_CONTENT//\{\{DESCRIPTION\}\}/Add description here}

# Write the template content to the migration file
echo "$TEMPLATE_CONTENT" > "$MIGRATION_FILE"

echo "Migration created successfully: $MIGRATION_FILE"
echo "Please edit the file to implement your migration following the template guidelines."
echo "Remember to:"
echo "  1. Add a description"
echo "  2. Replace all placeholders"
echo "  3. Test locally with 'supabase db reset' before pushing to production" 