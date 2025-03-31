-- Update existing records from 'quick', 'casual', or 'local' to 'online'
UPDATE games
SET game_mode = 'online'
WHERE game_mode IN ('quick', 'casual', 'local');

-- Check if the game_mode column uses an enum type
DO $$
DECLARE
    enum_name text;
    has_rows boolean;
BEGIN
    -- Check if any rows would violate the new constraint
    SELECT EXISTS (
        SELECT 1 FROM games 
        WHERE game_mode NOT IN ('online', 'ranked')
    ) INTO has_rows;
    
    -- If there are rows that would violate the constraint, update them
    IF has_rows THEN
        UPDATE games SET game_mode = 'online' 
        WHERE game_mode NOT IN ('online', 'ranked');
    END IF;

    -- Get the enum type name if it exists
    SELECT t.typname INTO enum_name
    FROM pg_type t
    JOIN pg_catalog.pg_attribute a ON a.atttypid = t.oid
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'games' AND a.attname = 'game_mode' AND t.typtype = 'e';
    
    -- If an enum exists for game_mode, update it
    IF enum_name IS NOT NULL THEN
        -- Create a new enum type without 'local' and with 'online' instead of 'quick'
        EXECUTE format('
            -- Create the new enum type if it doesn''t exist
            DO $enum_check$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = ''%I_new'') THEN
                    CREATE TYPE %I_new AS ENUM (''online'', ''ranked'');
                END IF;
            END $enum_check$;
            
            -- Update column to use the new enum type
            ALTER TABLE games
            ALTER COLUMN game_mode TYPE %I_new 
            USING (
                CASE 
                    WHEN game_mode::text NOT IN (''online'', ''ranked'') THEN ''online''::text
                    ELSE game_mode::text
                END
            )::%I_new;
            
            -- Drop the old enum type if it exists
            DROP TYPE IF EXISTS %I;
            
            -- Rename the new enum type to the original name
            ALTER TYPE %I_new RENAME TO %I;
        ', enum_name, enum_name, enum_name, enum_name, enum_name, enum_name, enum_name);
    ELSE
        -- If it's not an enum, check if it has a check constraint
        -- Remove any existing constraint on game_mode
        EXECUTE (
            'DO $constraint$ 
            BEGIN
                -- Drop any existing check constraint on game_mode
                ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_mode_check;
                
                -- Create new constraint that only allows "online" and "ranked"
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.constraint_column_usage 
                    WHERE table_name = ''games'' AND constraint_name = ''games_game_mode_check''
                ) THEN
                    ALTER TABLE games
                    ADD CONSTRAINT games_game_mode_check
                    CHECK (game_mode IN (''online'', ''ranked''));
                END IF;
            END $constraint$;'
        );
    END IF;
END $$;

-- Add comment to explain the migration
COMMENT ON COLUMN games.game_mode IS 'Game mode: "online" (previously "quick") or "ranked". "local" mode has been removed.';

