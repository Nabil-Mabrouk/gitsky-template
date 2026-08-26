"""Mesure l'empreinte RAM du backend pour une combinaison de modules (spike).

À lancer dans un process frais par combinaison pour éviter tout état d'import
partagé, en activant les modules voulus via l'environnement :

    python scripts/measure_ram.py landing-seule
    MODULE_ADMIN=true MODULE_ANALYTICS=true python scripts/measure_ram.py app-complete

Reporte le RSS après import de l'app (le gros de la mémoire est pris à
l'import) et quels modules ont réellement été chargés dans sys.modules.
"""

import sys

import psutil


def main() -> None:
    label = sys.argv[1] if len(sys.argv) > 1 else "défaut"

    # Import déclenche le chargement conditionnel des modules (selon les
    # variables MODULE_* déjà présentes dans l'environnement de ce process).
    import app.core.main  # noqa: F401

    proc = psutil.Process()
    rss_mb = proc.memory_info().rss / (1024 * 1024)

    print(
        f"combinaison={label} "
        f"rss_mb={rss_mb:.1f} "
        f"analytics_imported={'app.modules.analytics' in sys.modules} "
        f"agentic_imported={'app.modules.agentic' in sys.modules} "
        f"security_imported={'app.modules.security' in sys.modules}"
    )


if __name__ == "__main__":
    main()
