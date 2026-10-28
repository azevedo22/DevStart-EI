-- Corre só na primeira vez que o volume do Postgres é criado.
-- Uma base de dados por serviço: nenhum serviço lê as tabelas de outro.
CREATE DATABASE devstart_auth;
CREATE DATABASE devstart_auth_test;
CREATE DATABASE devstart_profile;
CREATE DATABASE devstart_tracker;
