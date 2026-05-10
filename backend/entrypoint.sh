#!/bin/bash

set -e

echo "Waiting for database..."
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-cdms_user}"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is up - running migrations"
alembic upgrade head

echo "Ensuring default admin user exists..."
python -c "
from app.core.database import SessionLocal
from app.models.user import User, UserRole, SoftwareAccess
from app.core.security import get_password_hash

db = SessionLocal()
try:
    user = db.query(User).filter(User.name == 'admin').first()
    if not user:
        db.add(User(
            name='admin',
            role=UserRole.ADMIN,
            software_access=SoftwareAccess.BOTH,
            hashed_password=get_password_hash('admin123'),
            timezone='UTC',
        ))
        db.commit()
        print('Default admin user created.')
    else:
        print('Admin user already exists.')
except Exception as e:
    print(f'Error ensuring admin user: {e}')
    db.rollback()
finally:
    db.close()
"

exec "$@"
