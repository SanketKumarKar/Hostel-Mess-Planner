
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nrngvrqiwhxwvmtdkfkg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybmd2cnFpd2h4d3ZtdGRrZmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NDk4NDAsImV4cCI6MjA4NTQyNTg0MH0.UJK2iyuXQfo6MbTQln3zl5cZY92fVwheySGDHoGl5no';

export const supabase = createClient(supabaseUrl, supabaseKey);
