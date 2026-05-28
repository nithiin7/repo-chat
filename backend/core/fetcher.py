"""
Repository fetcher — clones or downloads a GitHub or Bitbucket repository
to a local temp directory and returns the local path for indexing.
"""

import os
import shutil
from pathlib import Path
from urllib.parse import urlparse

import git
from github import Github, GithubException

from backend.config import get_settings


def parse_repo_url(repo_url: str) -> dict:
    """Extract host, owner, and repo name from a GitHub or Bitbucket URL."""
    ...


def fetch_github_repo(owner: str, repo_name: str, dest: Path) -> Path:
    """Clone a GitHub repository to dest using PyGithub + gitpython."""
    ...


def fetch_bitbucket_repo(owner: str, repo_name: str, dest: Path) -> Path:
    """Clone a Bitbucket repository to dest using authenticated HTTPS."""
    ...


def fetch_repo(repo_url: str, repo_id: str) -> Path:
    """
    Entry point: parse repo_url, dispatch to the right fetcher,
    and return the local directory Path containing the source files.
    """
    ...
