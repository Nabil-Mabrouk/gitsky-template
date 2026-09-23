"""Premier push du dépôt généré vers le dépôt GitHub lié (Chap 27, Phase E).

Le générateur (generator_client.generate_project) laisse déjà un dépôt git
local avec un premier commit (`_tasks` de `copier.yml` : `git init`/`add`/
`commit`, Chap 17) — cette fonction ajoute le remote et pousse. Les erreurs de
subprocess (remote injoignable en dev/test avec un dépôt stub `github.test`,
pas de réseau, jeton invalide...) remontent telles quelles à l'appelant : le
premier push est un best-effort documenté (Chap 26/27), jamais une garantie —
un échec ici ne doit jamais faire échouer la création du projet elle-même.

Bug de prod réel (ai-qube, 2026-09-23) : `remote_url` embarque
FLEET_GITHUB_TOKEN (router.py, seul moyen d'authentifier ce push sans prompt
interactif) — sans nettoyage après coup, ce jeton à portée `repo` complète
restait stocké EN CLAIR, de façon permanente, dans le `.git/config` de
CHAQUE projet créé via le wizard avec "créer un dépôt". `clean_url`
(optionnel, l'URL sans le jeton — `clone_url`, déjà documenté ci-dessous
comme n'embarquant jamais d'identifiants) réécrit le remote après un push
réussi, jamais avant : le jeton ne doit exister sur disque que le temps
strictement nécessaire à l'opération qui en a besoin.
"""

import subprocess
from pathlib import Path


def push_initial_commit(
    project_dir: Path, remote_url: str, branch: str, *, clean_url: str | None = None
) -> None:
    subprocess.run(
        ["git", "-C", str(project_dir), "remote", "add", "origin", remote_url],
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        ["git", "-C", str(project_dir), "push", "-u", "origin", f"HEAD:{branch}"],
        check=True,
        capture_output=True,
        text=True,
    )
    if clean_url and clean_url != remote_url:
        subprocess.run(
            ["git", "-C", str(project_dir), "remote", "set-url", "origin", clean_url],
            check=True,
            capture_output=True,
            text=True,
        )
