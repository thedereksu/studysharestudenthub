-- Add foreign key from materials.uploader_id to profiles.id
-- This allows PostgREST to resolve the profiles(*) embedded select
ALTER TABLE public.materials
ADD CONSTRAINT materials_uploader_id_profiles_fkey
FOREIGN KEY (uploader_id) REFERENCES public.profiles(id);