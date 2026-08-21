-- PostgreSQL superuser ostida bir marta:
-- psql -U postgres -f scripts/init-db.sql

SELECT 'CREATE DATABASE yangi'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yangi')\gexec
