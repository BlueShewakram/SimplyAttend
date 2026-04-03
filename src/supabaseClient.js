import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fcqmtwxtxkbikejjodsq.supabase.co'

const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcW10d3h0eGtiaWtlampvZHNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTI3MzYsImV4cCI6MjA5MDc4ODczNn0.F98iL2c-RpE3g75suJd7XKlGXukcqK4B4s-9eHtPEy4'

export const supabase = createClient(supabaseUrl, supabaseKey)
