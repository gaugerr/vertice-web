-- STUB de teste da extensão http (pgsql-http), usado só quando a extensão real não existe no container.
-- Fornece tipos e assinaturas para que as migrations do Cakto sejam criadas na ordem real.
-- Limitação: nenhuma função faz HTTP; retornos são nulos. Não validar comportamento de integração com aqui.
create type http_method as enum ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD');
create type http_header as (field varchar, value varchar);
create type http_request as (method http_method, uri varchar, headers http_header[], content_type varchar, content varchar);
create type http_response as (status int, content_type varchar, headers http_header[], content varchar);
create function http_header(varchar, varchar) returns http_header language sql as $$ select row($1, $2)::http_header $$;
create function http(http_request) returns http_response language sql as $$ select null::int, null::varchar, null::http_header[], null::varchar $$;
create function http_post(varchar, jsonb) returns http_response language sql as $$ select null::int, null::varchar, null::http_header[], null::varchar $$;
create function http_set_curlopt(varchar, varchar) returns boolean language sql as $$ select true $$;
create function http_reset_curlopt() returns boolean language sql as $$ select true $$;
