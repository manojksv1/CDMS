#!/bin/bash

set -e

# Wait for the database to be ready
echo "Waiting for database..."
until pg_isready -h db -p 5432 -U cdms_user; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is up - executing migrations"
alembic upgrade head

echo "Checking/Creating default admin user..."
python -c "
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
db = SessionLocal()
try:
    user = db.query(User).filter(User.name == 'admin').first()
    if not user:
        db.add(User(name='admin', role=UserRole.ADMIN, hashed_password=get_password_hash('admin123')))
        db.commit()
        print('Admin user created successfully.')
    else:
        print('Admin user already exists.')
except Exception as e:
    print(f'Error creating admin: {e}')
finally:
    db.close()
"

# Execute the passed command (usually uvicorn)
exec "$@"
