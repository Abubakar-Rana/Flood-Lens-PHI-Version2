"""Orchestrator — runs every ETL step end-to-end.

Usage:
    python scripts/etl/run_all.py            # all countries
    python scripts/etl/run_all.py pak        # one country
    python scripts/etl/run_all.py pak bgd    # subset
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boundaries
import points
import stats
import zonal_stats
import registry


def main(codes: list[str] | None = None):
    only = codes if codes else [None]
    t0 = time.time()
    for c in only:
        print(f"\n{'='*60}\nProcessing: {c or 'ALL'}\n{'='*60}")
        boundaries.main(c)
        points.main(c)
        zonal_stats.main(c)
        stats.main(c)
    registry.main()
    print(f"\nDONE in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a]
    main(args if args else None)
