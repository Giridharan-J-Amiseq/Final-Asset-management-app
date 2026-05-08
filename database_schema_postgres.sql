CREATE DATABASE worksphere;

\c worksphere;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('Admin', 'Viewer');
    ELSE
        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'user_role' AND e.enumlabel = 'IT Manager'
        ) THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            ) THEN
                DROP TYPE IF EXISTS user_role_new;
                CREATE TYPE user_role_new AS ENUM ('Admin', 'Viewer');
                UPDATE users SET role = 'Admin' WHERE role = 'IT Manager';
                ALTER TABLE users ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;
                DROP TYPE user_role;
                ALTER TYPE user_role_new RENAME TO user_role;
            ELSE
                DROP TYPE user_role;
                CREATE TYPE user_role AS ENUM ('Admin', 'Viewer');
            END IF;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type_enum') THEN
        CREATE TYPE asset_type_enum AS ENUM ('Laptop', 'Desktop', 'Server', 'Furniture', 'Printer', 'Phone', 'Monitor', 'UPS', 'Other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_category_enum') THEN
        CREATE TYPE asset_category_enum AS ENUM ('IT', 'Non-IT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status_enum') THEN
        CREATE TYPE asset_status_enum AS ENUM ('Available', 'Assigned', 'In Repair', 'Retired', 'Lost');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condition_status_enum') THEN
        CREATE TYPE condition_status_enum AS ENUM ('New', 'Good', 'Damaged');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type_enum') THEN
        CREATE TYPE transaction_type_enum AS ENUM ('New Asset', 'Asset Transfer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_type_enum') THEN
        CREATE TYPE issue_type_enum AS ENUM ('Repair', 'Physical Damage', 'Theft', 'Software Issue');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status_enum') THEN
        CREATE TYPE maintenance_status_enum AS ENUM ('Open', 'In Progress', 'Closed');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_master (
    asset_id SERIAL PRIMARY KEY,
    asset_name VARCHAR(150) NOT NULL,
    asset_type asset_type_enum NOT NULL,
    category asset_category_enum NOT NULL,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    asset_code VARCHAR(255),
    qr_code_value INT,
    qr_code_image_url TEXT,
    model VARCHAR(100),
    brand VARCHAR(100),
    specifications TEXT,
    purchase_date DATE,
    purchase_cost NUMERIC(10, 2),
    vendor_name VARCHAR(150),
    invoice_number VARCHAR(100),
    warranty_start_date DATE,
    warranty_expiry INT,
    asset_status asset_status_enum NOT NULL DEFAULT 'Available',
    condition_status condition_status_enum NOT NULL DEFAULT 'New',
    location VARCHAR(150),
    department VARCHAR(150),
    is_retired BOOLEAN NOT NULL DEFAULT FALSE,
    created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL REFERENCES users(user_id),
    modified_by INT NULL REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS asset_transaction (
    transaction_id SERIAL PRIMARY KEY,
    asset_id INT NOT NULL REFERENCES asset_master(asset_id),
    asset_type asset_type_enum NOT NULL,
    from_employee INT NULL REFERENCES users(user_id),
    to_assignee INT NOT NULL REFERENCES users(user_id),
    action_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_type transaction_type_enum NOT NULL,
    remarks TEXT,
    performed_by INT NOT NULL REFERENCES users(user_id),
    created_by INT NOT NULL REFERENCES users(user_id),
    created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance (
    maintenance_id SERIAL PRIMARY KEY,
    asset_id INT NOT NULL REFERENCES asset_master(asset_id),
    issue_description TEXT NOT NULL,
    issue_type issue_type_enum NOT NULL,
    warranty_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    maintenance_status maintenance_status_enum NOT NULL DEFAULT 'Open',
    vendor VARCHAR(150),
    resolution_notes TEXT,
    created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_category (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    asset_id INT NOT NULL REFERENCES asset_master(asset_id),
    alert_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
    log_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL,
    entity_id INT NOT NULL,
    action VARCHAR(80) NOT NULL,
    details TEXT,
    performed_by INT NULL REFERENCES users(user_id),
    created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_modified_on()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_modified_on ON users;
CREATE TRIGGER trg_users_modified_on
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_modified_on();

DROP TRIGGER IF EXISTS trg_asset_master_modified_on ON asset_master;
CREATE TRIGGER trg_asset_master_modified_on
BEFORE UPDATE ON asset_master
FOR EACH ROW
EXECUTE FUNCTION set_modified_on();

DROP TRIGGER IF EXISTS trg_maintenance_modified_on ON maintenance;
CREATE TRIGGER trg_maintenance_modified_on
BEFORE UPDATE ON maintenance
FOR EACH ROW
EXECUTE FUNCTION set_modified_on();

INSERT INTO asset_category (category_name, description)
VALUES
    ('Laptop', 'Portable computing devices'),
    ('Monitor', 'Display devices'),
    ('Mouse', 'Input devices'),
    ('Keyboard', 'Typing devices'),
    ('Printer', 'Printing devices'),
    ('Phone', 'Mobile and desk phones'),
    ('UPS', 'Power backup devices'),
    ('Other', 'Miscellaneous assets')
ON CONFLICT (category_name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO users (user_name, username, email, password_hash, role, is_active)
VALUES
    ('Admin One', 'admin1', 'admin1@worksphere.local', encode(digest('admin1', 'sha256'), 'hex'), 'Admin', TRUE),
    ('Admin Two', 'admin2', 'admin2@worksphere.local', encode(digest('admin2', 'sha256'), 'hex'), 'Admin', TRUE),
    ('Viewer One', 'viewer1', 'viewer1@worksphere.local', encode(digest('viewer1', 'sha256'), 'hex'), 'Viewer', TRUE),
    ('Viewer Two', 'viewer2', 'viewer2@worksphere.local', encode(digest('viewer2', 'sha256'), 'hex'), 'Viewer', TRUE),
    ('Viewer Three', 'viewer3', 'viewer3@worksphere.local', encode(digest('viewer3', 'sha256'), 'hex'), 'Viewer', TRUE),
    ('Test User', 'test1', 'test1@worksphere.local', encode(digest('test1', 'sha256'), 'hex'), 'Viewer', TRUE)
ON CONFLICT (username) DO UPDATE
SET user_name = EXCLUDED.user_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;
