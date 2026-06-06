import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tekvqbbjsfncwbdsvrfw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRla3ZxYmJqc2ZuY3diZHN2cmZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzk4NzMsImV4cCI6MjA5MDIxNTg3M30.I_frs_c-zXE3lrac1SMJfn1_tb0tGejJoMSRcQCcpRY'

export const supabase = createClient(supabaseUrl, supabaseKey)
