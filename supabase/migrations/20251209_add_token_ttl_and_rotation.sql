-- Add token_ttl_minutes column to sessions table
ALTER TABLE public.sessions
ADD COLUMN token_ttl_minutes integer DEFAULT 0;

-- Add timestamp columns to track when tokens were last rotated
ALTER TABLE public.sessions
ADD COLUMN start_token_rotated_at timestamp with time zone DEFAULT now(),
ADD COLUMN end_token_rotated_at timestamp with time zone DEFAULT now();

-- Create function to rotate start_qr_token for active sessions
CREATE OR REPLACE FUNCTION public.rotate_session_start_qr_tokens()
RETURNS TABLE (rotated_count integer) AS $$
DECLARE
  v_rotated_count integer := 0;
BEGIN
  UPDATE public.sessions
  SET 
    start_qr_token = gen_random_uuid()::text,
    start_token_rotated_at = now()
  WHERE 
    status = 'in_progress'
    AND token_ttl_minutes > 0
    AND (now() - start_token_rotated_at) >= (token_ttl_minutes || ' minutes')::interval;
  
  GET DIAGNOSTICS v_rotated_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_rotated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to rotate end_qr_token for active sessions
CREATE OR REPLACE FUNCTION public.rotate_session_end_qr_tokens()
RETURNS TABLE (rotated_count integer) AS $$
DECLARE
  v_rotated_count integer := 0;
BEGIN
  UPDATE public.sessions
  SET 
    end_qr_token = gen_random_uuid()::text,
    end_token_rotated_at = now()
  WHERE 
    status = 'in_progress'
    AND token_ttl_minutes > 0
    AND end_qr_token IS NOT NULL
    AND (now() - end_token_rotated_at) >= (token_ttl_minutes || ' minutes')::interval;
  
  GET DIAGNOSTICS v_rotated_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_rotated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.rotate_session_start_qr_tokens() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_session_end_qr_tokens() TO anon, authenticated;
