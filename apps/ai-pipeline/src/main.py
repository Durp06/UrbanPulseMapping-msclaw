"""Entry point — starts the job consumer."""

import asyncio
import logging

from src.config import settings


def _setup_logging() -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def main() -> None:
    _setup_logging()
    logger = logging.getLogger("ai-pipeline")
    logger.info("AI Pipeline starting (provider=%s, model=%s)", settings.llm_provider, settings.llm_model)

    # Consumer will be implemented in Step 2
    from src.consumer import run_consumer  # noqa: F811

    asyncio.run(run_consumer())


if __name__ == "__main__":
    main()
