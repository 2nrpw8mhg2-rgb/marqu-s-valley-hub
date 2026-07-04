DROP POLICY IF EXISTS documentos_bucket_select_auth ON storage.objects;
CREATE POLICY documentos_bucket_select_admin ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documentos' AND private.has_role(auth.uid(), 'admin'::app_role));