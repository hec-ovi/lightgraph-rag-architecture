from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "gpt-oss:20b"
    ollama_embed_model: str = "bge-m3:latest"

    lightrag_context_window: int = 32768
    lightrag_embedding_dim: int = 1024
    lightrag_embedding_max_tokens: int = 8192

    data_dir: str = "/app/data"
    db_path: str = "/app/data/metadata.db"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
