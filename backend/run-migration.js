import dotenv from 'dotenv';
dotenv.config();
import { query  } from './src/config/database.js';

async function runMigration() {
  try {
    console.log('Running invites table migration...');

    // Create invites table
    await query(`
      CREATE TABLE IF NOT EXISTS invites (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          invite_code VARCHAR(20) UNIQUE NOT NULL,
          invited_by UUID NOT NULL REFERENCES users(id),
          phone_number VARCHAR(20) NOT NULL,
          context JSONB,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
          accepted_by UUID REFERENCES users(id),
          accepted_at TIMESTAMP WITH TIME ZONE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);

    console.log('✅ Invites table created');

    // Create indexes
    await query('CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(invite_code);');
    await query('CREATE INDEX IF NOT EXISTS idx_invites_invited_by ON invites(invited_by);');
    await query('CREATE INDEX IF NOT EXISTS idx_invites_phone ON invites(phone_number);');
    await query('CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);');
    await query('CREATE INDEX IF NOT EXISTS idx_invites_created ON invites(created_at);');
    await query('CREATE INDEX IF NOT EXISTS idx_invites_deleted ON invites(deleted_at);');

    console.log('✅ Indexes created');

    // Add trigger
    await query(`
      CREATE TRIGGER IF NOT EXISTS update_invites_updated_at
      BEFORE UPDATE ON invites
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Trigger created');
    console.log('🎉 Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
