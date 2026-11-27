"""admin sessions + admin lockout fields

Revision ID: 0002_admin_sessions
Revises: 0001_initial
Create Date: 2026-11-27
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_admin_sessions"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("admin_users", sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("admin_users", sa.Column("locked_until", TS, nullable=True))
    op.add_column("admin_users", sa.Column("last_login_at", TS, nullable=True))
    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
    )
    op.create_index("ix_admin_sessions_token_hash", "admin_sessions", ["token_hash"], unique=True)
    op.create_index("ix_admin_sessions_admin_id", "admin_sessions", ["admin_id"])


def downgrade() -> None:
    op.drop_table("admin_sessions")
    op.drop_column("admin_users", "last_login_at")
    op.drop_column("admin_users", "locked_until")
    op.drop_column("admin_users", "failed_attempts")
