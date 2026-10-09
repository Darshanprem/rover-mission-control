from typing import Literal
from pydantic import BaseModel, Field


class MissionConfig(BaseModel):
    seed: int = Field(default=42, ge=0, le=999999)
    size: int = Field(default=24, ge=12, le=40)
    energy: int = Field(default=240, ge=40, le=1000)
    obstacle_density: float = Field(default=0.13, ge=0, le=0.3)
    scenario: Literal['discovery', 'rough_terrain', 'low_battery'] = 'discovery'
    strategy: Literal['balanced', 'nearest'] = 'balanced'


class Command(BaseModel):
    action: Literal['start', 'pause', 'step', 'return', 'speed']
    speed: int | None = Field(default=None, ge=1, le=20)


class Obstacle(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
