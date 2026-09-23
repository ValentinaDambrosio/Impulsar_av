-- Buckets de Storage para Impulsar (eran las carpetas de uploads/).
-- Correr en el SQL Editor de Supabase, después de schema_postgres.sql.
--
-- Públicos para lectura: las fotos y los videos se muestran en el directorio.
-- Solo el backend (service_role) sube y borra.
-- Los límites repiten los de api/_lib/archivos.js: si alguien saltea el backend,
-- Storage igual rechaza archivos grandes o de otro tipo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos-perfil',   'fotos-perfil',   true, 3145728,  array['image/jpeg','image/png','image/webp']),
  ('fotos-trabajo',  'fotos-trabajo',  true, 3145728,  array['image/jpeg','image/png','image/webp']),
  ('videos-trabajo', 'videos-trabajo', true, 8388608, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

-- Si el bucket ya existía con el tope viejo de 15MB, lo baja a 8MB.
update storage.buckets
  set file_size_limit = 8388608
  where id = 'videos-trabajo';
