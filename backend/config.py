from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional
from pathlib import Path

# Load .env into os.environ so other modules (llm_provider, auth, etc.)
# that still use os.environ.get() continue to work after we removed
# the load_dotenv block from main.py.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=False)
except ImportError:
    pass

_repo_root = Path(__file__).parent.parent

class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_key: str = Field(..., description="Supabase anon/public key")
    supabase_service_key: Optional[str] = Field(default="", description="Supabase service role key")

    # API & Network Configuration
    api_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    cors_allow_all: bool = False
    additional_cors_origins: str = ""

    # Model Configuration
    model_dir: str = str(_repo_root / "Models")
    stream_a_model: Optional[str] = None
    stream_b_model: Optional[str] = None

    # Dev / Auth Configuration
    dev_bypass_auth: bool = False
    dev_bypass_token: str = "dev-local-bypass-token"

    # Automatically loads variables from the .env file
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_stream_a_path(self) -> str:
        return self.stream_a_model or str(Path(self.model_dir) / "freshscan_stream_a_body.pth")

    def get_stream_b_path(self) -> str:
        return self.stream_b_model or str(Path(self.model_dir) / "stream_b_checkpoint.pth")

# Initialize a global settings instance
settings = Settings()
