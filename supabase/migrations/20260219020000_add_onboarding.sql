-- Add onboarding_step column to track onboarding progress (0-3: active, 4: complete)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
