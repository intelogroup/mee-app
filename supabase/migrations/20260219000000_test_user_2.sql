-- Insert a mock profile for User 2 to test isolation
INSERT INTO profiles (id, email, telegram_chat_id, message_count)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'testuser2@example.com', '999999999', 5)
ON CONFLICT (id) DO NOTHING;
