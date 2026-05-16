-- This migration adds an 'is_ai_generated' column to the 'materials' table.

ALTER TABLE public.materials
ADD COLUMN is_ai_generated BOOLEAN DEFAULT FALSE;
