
CREATE POLICY "Admins can delete requests"
ON public.material_requests FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all requests"
ON public.material_requests FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
