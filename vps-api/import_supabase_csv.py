#!/usr/bin/env python3
"""
Supabase CSV → VPS PostgreSQL import
VPS'te: python3 /opt/jetbarkod-api/import_supabase_csv.py /tmp/supabase_import
"""
import csv
import json
import os
import subprocess
import sys
import tempfile

csv.field_size_limit(50_000_000)

IMPORT_DIR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/supabase_import'
DB_NAME = os.environ.get('DB_NAME', 'jetbarkod')

USER_COLS = [
    'id', 'username', 'password', 'company', 'contact_email', 'trial_end',
    'is_active', 'is_admin', 'created_at', 'updated_at', 'max_ip_count',
    'ip_tracking_enabled', 'tracked_ips', 'chat_messages', 'last_chat_update',
    'premium_features', 'keyboard_shortcuts', 'counting_data', 'allowed_ips',
]


def find_file(name_patterns):
    for pat in name_patterns:
        for fn in os.listdir(IMPORT_DIR):
            if fn == pat or fn.startswith(pat):
                return os.path.join(IMPORT_DIR, fn)
    return None


def pg_bool(val):
    return 'true' if str(val).lower() == 'true' else 'false'


def pg_text_array(val):
    if not val or str(val).strip() in ('', '[]', '{}'):
        return '{}'
    try:
        arr = json.loads(val) if isinstance(val, str) else val
    except json.JSONDecodeError:
        return '{}'
    if not arr:
        return '{}'
    out = []
    for item in arr:
        s = str(item).replace('\\', '\\\\').replace('"', '\\"')
        out.append(f'"{s}"')
    return '{' + ','.join(out) + '}'


def read_csv(path):
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def write_csv(path, columns, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(columns)
        for row in rows:
            w.writerow([row.get(c, '') for c in columns])


def run_psql_file(sql_path):
    proc = subprocess.run(
        ['sudo', '-u', 'postgres', 'psql', '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-f', sql_path],
        capture_output=True,
        text=True,
    )
    if proc.stdout.strip():
        print(proc.stdout.strip())
    if proc.returncode != 0:
        print(proc.stderr, file=sys.stderr)
        raise RuntimeError(f'psql failed: {sql_path}')


def import_table(table, csv_path, upsert_sql):
    rows = read_csv(csv_path)
    if not rows:
        print(f'– {table}: boş, atlandı')
        return
    cols = list(rows[0].keys())
    with tempfile.TemporaryDirectory() as tmp:
        data_csv = os.path.join(tmp, f'{table}.csv')
        sql_path = os.path.join(tmp, f'{table}.sql')
        write_csv(data_csv, cols, rows)
        cols_sql = ','.join(cols)
        with open(sql_path, 'w', encoding='utf-8') as f:
            f.write(f'CREATE TEMP TABLE stg_import (LIKE {table} INCLUDING DEFAULTS);\n')
            f.write(f"\\copy stg_import ({cols_sql}) FROM '{data_csv}' WITH (FORMAT csv, HEADER true, NULL '')\n")
            f.write(upsert_sql)
            f.write('\n')
        run_psql_file(sql_path)
    print(f'✓ {table}: {len(rows)} satır')


def import_users(csv_path):
    rows = read_csv(csv_path)
    cleaned = []
    for r in rows:
        cleaned.append({
            'id': r['id'],
            'username': r['username'],
            'password': r['password'],
            'company': r.get('company') or 'Şirket',
            'contact_email': r.get('contact_email') or '',
            'trial_end': r['trial_end'],
            'is_active': pg_bool(r.get('is_active', 'true')),
            'is_admin': pg_bool(r.get('is_admin', 'false')),
            'created_at': r.get('created_at') or '',
            'updated_at': r.get('updated_at') or '',
            'max_ip_count': r.get('max_ip_count') or '5',
            'ip_tracking_enabled': pg_bool(r.get('ip_tracking_enabled', 'true')),
            'tracked_ips': pg_text_array(r.get('tracked_ips')),
            'chat_messages': r.get('chat_messages') or '[]',
            'last_chat_update': r.get('last_chat_update') or '',
            'premium_features': r.get('premium_features') or '{}',
            'keyboard_shortcuts': r.get('keyboard_shortcuts') or '{}',
            'counting_data': r.get('counting_data') or '{}',
            'allowed_ips': pg_text_array(r.get('allowed_ips') or '["*"]'),
        })

    cols_sql = ','.join(USER_COLS)
    with tempfile.TemporaryDirectory() as tmp:
        data_csv = os.path.join(tmp, 'users.csv')
        sql_path = os.path.join(tmp, 'users.sql')
        write_csv(data_csv, USER_COLS, cleaned)
        with open(sql_path, 'w', encoding='utf-8') as f:
            f.write('CREATE TEMP TABLE stg_users (LIKE users INCLUDING DEFAULTS);\n')
            f.write(f"\\copy stg_users ({cols_sql}) FROM '{data_csv}' WITH (FORMAT csv, HEADER true, NULL '')\n")
            f.write("""
INSERT INTO users (
    id, username, password, company, contact_email, trial_end, is_active, is_admin,
    created_at, updated_at, max_ip_count, ip_tracking_enabled, tracked_ips,
    chat_messages, last_chat_update, premium_features, keyboard_shortcuts,
    counting_data, allowed_ips
)
SELECT
    id, username, password, company, NULLIF(contact_email,''), trial_end::timestamptz,
    is_active::boolean, is_admin::boolean,
    NULLIF(created_at,'')::timestamptz, NULLIF(updated_at,'')::timestamptz,
    NULLIF(max_ip_count,'')::integer, ip_tracking_enabled::boolean,
    tracked_ips::text[], chat_messages, NULLIF(last_chat_update,'')::timestamptz,
    premium_features::jsonb, keyboard_shortcuts::jsonb, counting_data::jsonb,
    allowed_ips::text[]
FROM stg_users
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    company = EXCLUDED.company,
    contact_email = EXCLUDED.contact_email,
    trial_end = EXCLUDED.trial_end,
    is_active = EXCLUDED.is_active,
    is_admin = EXCLUDED.is_admin,
    max_ip_count = EXCLUDED.max_ip_count,
    ip_tracking_enabled = EXCLUDED.ip_tracking_enabled,
    tracked_ips = EXCLUDED.tracked_ips,
    chat_messages = EXCLUDED.chat_messages,
    last_chat_update = EXCLUDED.last_chat_update,
    premium_features = EXCLUDED.premium_features,
    keyboard_shortcuts = EXCLUDED.keyboard_shortcuts,
    counting_data = EXCLUDED.counting_data,
    allowed_ips = EXCLUDED.allowed_ips,
    updated_at = NOW();
""")
        run_psql_file(sql_path)
    print(f'✓ users: {len(cleaned)} satır')


def main():
    if not os.path.isdir(IMPORT_DIR):
        print(f'Klasör yok: {IMPORT_DIR}', file=sys.stderr)
        sys.exit(1)

    users_path = find_file(['users_rows', 'users.csv'])
    if not users_path:
        sys.exit('users CSV bulunamadı!')

    print(f'Import: {IMPORT_DIR}\n=== users ===')
    import_users(users_path)

    optional = [
        ('user_data', ['user_data_rows', 'user_data.csv'], """
INSERT INTO user_data (id, username, custom_products, settings, created_at, updated_at)
SELECT id, username, custom_products::jsonb, settings::jsonb,
       created_at::timestamptz, updated_at::timestamptz
FROM stg_import
ON CONFLICT (username) DO UPDATE SET
    custom_products = EXCLUDED.custom_products,
    settings = EXCLUDED.settings,
    updated_at = EXCLUDED.updated_at;
"""),
        ('admin_settings', ['admin_settings_rows', 'admin_settings.csv'], """
INSERT INTO admin_settings (id, telegram_bot_token, telegram_chat_id, gemini_api_key,
    cloudinary_cloud_name, cloudinary_api_key, cloudinary_upload_preset, updated_at)
SELECT id, NULLIF(telegram_bot_token,''), NULLIF(telegram_chat_id,''), NULLIF(gemini_api_key,''),
    NULLIF(cloudinary_cloud_name,''), NULLIF(cloudinary_api_key,''), NULLIF(cloudinary_upload_preset,''),
    NULLIF(updated_at,'')::timestamptz
FROM stg_import
ON CONFLICT (id) DO UPDATE SET
    telegram_bot_token = EXCLUDED.telegram_bot_token,
    telegram_chat_id = EXCLUDED.telegram_chat_id,
    gemini_api_key = EXCLUDED.gemini_api_key,
    cloudinary_cloud_name = EXCLUDED.cloudinary_cloud_name,
    cloudinary_api_key = EXCLUDED.cloudinary_api_key,
    cloudinary_upload_preset = EXCLUDED.cloudinary_upload_preset,
    updated_at = EXCLUDED.updated_at;
"""),
        ('system_features', ['system_features_rows', 'system_features.csv'], """
INSERT INTO system_features (id, feature_key, feature_name, current_value, default_value,
    value_type, description, is_active, created_at, updated_at)
SELECT id, feature_key, feature_name, current_value::jsonb, default_value::jsonb,
    value_type, description, is_active::boolean, created_at::timestamptz, updated_at::timestamptz
FROM stg_import
ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    current_value = EXCLUDED.current_value,
    default_value = EXCLUDED.default_value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;
"""),
        ('dispatch_agenda_items', ['dispatch_agenda_items_rows', 'dispatch_agenda_items.csv'], """
INSERT INTO dispatch_agenda_items (id, username, product_id, product_name, product_image,
    barcodes, quantity, reason_preset, reason_note, pickup_required, address, event_date,
    created_at, updated_at)
SELECT id, username, product_id, product_name, NULLIF(product_image,''),
    barcodes::jsonb, quantity::integer, reason_preset, NULLIF(reason_note,''),
    pickup_required::boolean, NULLIF(address,''), NULLIF(event_date,'')::date,
    created_at::timestamptz, updated_at::timestamptz
FROM stg_import
ON CONFLICT (id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    reason_note = EXCLUDED.reason_note,
    updated_at = EXCLUDED.updated_at;
"""),
        ('updates', ['updates_rows', 'updates.csv'], """
INSERT INTO updates (id, update_number, title, description, steps, feature_changes,
    scheduled_at, is_active, created_at, updated_at)
SELECT id, update_number, title, NULLIF(description,''), steps::jsonb,
    COALESCE(NULLIF(feature_changes,''), '[]')::jsonb,
    NULLIF(scheduled_at,'')::timestamptz, is_active::boolean,
    created_at::timestamptz, updated_at::timestamptz
FROM stg_import
ON CONFLICT (update_number) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    steps = EXCLUDED.steps,
    feature_changes = EXCLUDED.feature_changes,
    scheduled_at = EXCLUDED.scheduled_at,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;
"""),
        ('user_update_status', ['user_update_status_rows', 'user_update_status.csv'], """
INSERT INTO user_update_status (id, username, update_number, is_seen, is_completed,
    seen_at, completed_at, created_at, updated_at)
SELECT id, username, update_number, is_seen::boolean, is_completed::boolean,
    NULLIF(seen_at,'')::timestamptz, NULLIF(completed_at,'')::timestamptz,
    created_at::timestamptz, updated_at::timestamptz
FROM stg_import
ON CONFLICT (username, update_number) DO UPDATE SET
    is_seen = EXCLUDED.is_seen,
    is_completed = EXCLUDED.is_completed,
    seen_at = EXCLUDED.seen_at,
    completed_at = EXCLUDED.completed_at,
    updated_at = EXCLUDED.updated_at;
"""),
    ]

    for table, patterns, upsert in optional:
        path = find_file(patterns)
        print(f'=== {table} ===')
        if not path:
            print(f'– atlandı (CSV yok)')
            continue
        import_table(table, path, upsert)

    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as f:
        f.write("NOTIFY pgrst, 'reload schema';\n")
        f.write('SELECT COUNT(*) AS users FROM users;\n')
        f.write('SELECT COUNT(*) AS user_data FROM user_data;\n')
        f.write('SELECT COUNT(*) AS updates FROM updates;\n')
        tail = f.name
    print('=== kontrol ===')
    run_psql_file(tail)
    os.unlink(tail)
    print('\n✅ Import tamamlandı!')


if __name__ == '__main__':
    main()
