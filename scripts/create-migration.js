#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get migration name from command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Error: Migration name is required');
  console.error('Usage: node scripts/create-migration.js <migration-name>');
  process.exit(1);
}

const migrationName = args[0].toLowerCase().replace(/\s+/g, '-');

// Create migrations directory if it doesn't exist
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Generate timestamp
const now = new Date();
const timestamp = now.getUTCFullYear().toString() +
  (now.getUTCMonth() + 1).toString().padStart(2, '0') +
  now.getUTCDate().toString().padStart(2, '0') +
  now.getUTCHours().toString().padStart(2, '0') +
  now.getUTCMinutes().toString().padStart(2, '0') +
  now.getUTCSeconds().toString().padStart(2, '0');

// Create migration file
const fileName = `${timestamp}_${migrationName}.sql`;
const filePath = path.join(migrationsDir, fileName);

// Migration template
const template = `-- Migration: ${migrationName}
-- Created at: ${now.toISOString()}

-- Up Migration
-- This section contains the changes to apply the migration

-- Step 1: Create any new tables or modify existing ones

-- Step 2: Update or create any new functions

-- Step 3: Set up any required policies

-- Down Migration (Optional)
-- This section contains the SQL to revert the migration if needed

-- Example:
-- DROP TABLE IF EXISTS public.table_name;

`;

// Write migration file
fs.writeFileSync(filePath, template);

console.log(`Created migration file: ${filePath}`); 