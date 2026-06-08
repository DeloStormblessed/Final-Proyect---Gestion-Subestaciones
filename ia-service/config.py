from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    jwt_secret: str
    jwt_algorithm: str = "HS256"

    node_api_url: str  # ej: http://localhost:3000/api/v1
    database_url: str  # mismo Postgres que Node, para el checkpointer

    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    allowed_origin: str = ""  # vacío = acepta cualquier origen en dev


settings = Settings()
