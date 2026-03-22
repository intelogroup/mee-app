"""Shared fixtures for backend tests."""

import os
import sys
import pytest

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
