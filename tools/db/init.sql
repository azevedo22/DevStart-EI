-- Corre só na primeira vez que o volume do Postgres é criado.
-- Uma base de dados por serviço: nenhum serviço lê as tabelas de outro.
CREATE DATABASE devstart_auth;
CREATE DATABASE devstart_profile;
CREATE DATABASE devstart_tracker;
-- Testes e2e: partilhada pelos serviços (cada um tem as suas tabelas e a sua tabela de migrações).
CREATE DATABASE devstart_test;
