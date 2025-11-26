-- Migration: Add invites table for referral system
-- Version: 004
-- Date: 2025-11-25

-- Create invites table
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

-- Create indexes
CREATE INDEX idx_invites_code ON invites(invite_code);
CREATE INDEX idx_invites_invited_by ON invites(invited_by);
CREATE INDEX idx_invites_phone ON invites(phone_number);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_created ON invites(created_at);
CREATE INDEX idx_invites_deleted ON invites(deleted_at);

-- Add trigger for updated_at
CREATE TRIGGER update_invites_updated_at BEFORE UPDATE ON invites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE invites IS 'User invitation and referral system';
COMMENT ON COLUMN invites.invite_code IS 'Unique code shared with invitees';
COMMENT ON COLUMN invites.context IS 'JSON data with additional context (group info, etc.)';
COMMENT ON COLUMN invites.status IS 'pending, accepted, expired, or cancelled';
