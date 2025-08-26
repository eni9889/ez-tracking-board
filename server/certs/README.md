# SSL Certificates

This directory contains SSL certificates for secure database connections.

## DigitalOcean Managed PostgreSQL

For production deployments using DigitalOcean managed PostgreSQL, place the CA certificate here:

- `ca-certificate.crt` - DigitalOcean CA certificate for PostgreSQL SSL connections

## Getting the Certificate

1. Download the CA certificate from your DigitalOcean database cluster
2. Save it as `ca-certificate.crt` in this directory
3. The application will automatically use it for secure connections

## Security

- Certificates are ignored by Git (see `.gitignore`)
- Only add trusted CA certificates from your database provider
- In development, SSL is disabled for local PostgreSQL connections
