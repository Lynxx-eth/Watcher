"""initial schema: profiles, locations, biometrics, notes, sessions, admins, activity

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-27
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.String(20), nullable=False),
        sa.Column("pin_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("nationality", sa.String(80), nullable=False),
        sa.Column("gender", sa.String(40), nullable=True),
        sa.Column("photo_key", sa.String(80), nullable=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("classification", sa.String(40), nullable=False),
        sa.Column("threat_level", sa.String(16), nullable=False),
        sa.Column("watchlist_status", sa.String(16), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("priority", sa.String(16), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("access_status", sa.String(16), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False),
        sa.Column("locked_until", TS, nullable=True),
        sa.Column("last_access_at", TS, nullable=True),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        sa.CheckConstraint("risk_score BETWEEN 0 AND 100", name="ck_profiles_risk_score"),
        sa.CheckConstraint("access_status IN ('ACTIVE','SUSPENDED','REVOKED')", name="ck_profiles_access"),
    )
    op.create_index("ix_profiles_project_id", "profiles", ["project_id"], unique=True)

    op.create_table(
        "profile_locations",
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("country", sa.String(80), nullable=False),
        sa.Column("region", sa.String(80), nullable=True),
        sa.Column("city", sa.String(80), nullable=False),
        sa.Column("address", sa.String(200), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column("show_address", sa.Boolean(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("geo_source", sa.String(40), nullable=True),
        sa.Column("geocoded_at", TS, nullable=True),
    )

    op.create_table(
        "profile_biometrics",
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("facial", sa.String(16), nullable=False),
        sa.Column("fingerprint", sa.String(16), nullable=False),
        sa.Column("iris", sa.String(16), nullable=False),
        sa.Column("dna", sa.String(16), nullable=False),
    )

    op.create_table(
        "case_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_index("ix_case_notes_profile_id", "case_notes", ["profile_id"])

    op.create_table(
        "client_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("confidential_until", TS, nullable=True),
    )
    op.create_index("ix_client_sessions_token_hash", "client_sessions", ["token_hash"], unique=True)
    op.create_index("ix_client_sessions_profile_id", "client_sessions", ["profile_id"])

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(60), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_index("ix_admin_users_username", "admin_users", ["username"], unique=True)

    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=True),
        sa.Column("actor", sa.String(60), nullable=False),
        sa.Column("event", sa.String(160), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("source", sa.String(60), nullable=False),
        sa.Column("status", sa.String(8), nullable=False),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("at", TS, nullable=False),
    )
    op.create_index("ix_activity_logs_profile_id", "activity_logs", ["profile_id"])
    op.create_index("ix_activity_logs_at", "activity_logs", ["at"])


def downgrade() -> None:
    for t in (
        "activity_logs",
        "admin_users",
        "client_sessions",
        "case_notes",
        "profile_biometrics",
        "profile_locations",
        "profiles",
    ):
        op.drop_table(t)
