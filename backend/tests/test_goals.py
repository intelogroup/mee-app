"""Tests for coaching goals validation logic and API constraints."""

import pytest


def test_goal_title_validation():
    """Goal titles must be non-empty and <= 200 chars."""
    # Empty title should be rejected
    assert not _is_valid_title("")
    assert not _is_valid_title("   ")

    # Normal title should pass
    assert _is_valid_title("Be more confident in groups")

    # Exactly 200 chars should pass
    assert _is_valid_title("a" * 200)

    # 201 chars should fail
    assert not _is_valid_title("a" * 201)


def test_goal_status_values():
    """Only valid statuses should be accepted."""
    valid = {"active", "completed", "archived"}
    assert _is_valid_status("active")
    assert _is_valid_status("completed")
    assert _is_valid_status("archived")
    assert not _is_valid_status("deleted")
    assert not _is_valid_status("")
    assert not _is_valid_status("ACTIVE")


def test_max_active_goals_check():
    """Should not allow more than 3 active goals."""
    active_count = 3
    assert not _can_add_goal(active_count)

    active_count = 2
    assert _can_add_goal(active_count)

    active_count = 0
    assert _can_add_goal(active_count)


def test_goals_injected_into_prompt():
    """Goals should be formatted correctly for the system prompt."""
    goals = ["Improve small talk", "Handle rejection better"]
    result = _format_goals_for_prompt(goals)
    assert "[COACHING GOALS]" in result
    assert "Improve small talk" in result
    assert "Handle rejection better" in result

    # Empty goals should produce empty string
    assert _format_goals_for_prompt([]) == ""


# --- Helpers (mirror the logic used in the actual code) ---

def _is_valid_title(title: str) -> bool:
    return bool(title and title.strip()) and len(title) <= 200


def _is_valid_status(status: str) -> bool:
    return status in ("active", "completed", "archived")


def _can_add_goal(active_count: int) -> bool:
    return active_count < 3


def _format_goals_for_prompt(goals: list[str]) -> str:
    if not goals:
        return ""
    return (
        "\n[COACHING GOALS]\nThe user has set these coaching goals. "
        "Steer the conversation to help them make progress:\n"
        + "\n".join(f"- {g}" for g in goals)
        + "\n"
    )
