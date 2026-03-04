
-- Make the materials bucket private
UPDATE storage.buckets SET public = false WHERE id = 'materials';

-- Storage policies: allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own files
CREATE POLICY "Users can update their own materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read files (signed URLs still need read access)
CREATE POLICY "Authenticated users can read materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'materials');

-- Allow service role to read (for edge function signed URL generation)
-- The service role bypasses RLS by default, so no extra policy needed
