"""project id counters

Revision ID: 0003_project_id_counters
Revises: 0002_admin_sessions
Create Date: 2026-11-27
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_project_id_counters"
down_revision = "0002_admin_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_id_counters",
        sa.Column("year", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("last", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("project_id_counters")
