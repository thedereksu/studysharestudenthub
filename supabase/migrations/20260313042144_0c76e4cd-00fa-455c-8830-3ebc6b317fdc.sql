
-- RLS policy: teachers and admins can update teacher approval on any material
CREATE POLICY "Teachers and admins can update teacher approval"
ON public.materials
FOR UPDATE
TO authenticated
USING (has_teacher_or_admin_role(auth.uid()))
WITH CHECK (has_teacher_or_admin_role(auth.uid()));
