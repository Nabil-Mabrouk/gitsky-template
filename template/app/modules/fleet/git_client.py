"""Premier push du dépôt généré vers le dépôt GitHub lié (Chap 27, Phase E).

Le générateur (generator_client.generate_project) laisse déjà un dépôt git
local avec un premier commit (`_tasks` de `copier.yml` : `git init`/`add`/
`commit`, Chap 17) — cette fonction ajoute le remote et pousse. Les erreurs de
subprocess (remote injoignable en dev/test avec un dépôt stub `github.test`,
pas de réseau, jeton invalide...) remontent telles quelles à l'appelant : le
premier push est un best-effort documenté (Chap 26/27), jamais une garantie —
un échec ici ne doit jamais faire échouer la création du projet elle-même.
"""

import subprocess
from pathlib import Path


def push_initial_commit(project_dir: Path, remote_url: str, branch: str) -> None:
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
