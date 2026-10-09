import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from .database import Database
from .models import MissionConfig, Command, Obstacle
from .simulation import Mission, TERMINAL


class Controller:
    def __init__(self):
        self.db = Database()
        self.mission = None
        self.lock = asyncio.Lock()

    def require(self, mission_id):
        if not self.mission or self.mission.id != mission_id:
            raise HTTPException(409, 'This is an archived mission. Create a new mission to run it.')
        return self.mission

    async def run(self):
        while True:
            async with self.lock:
                m = self.mission
                if m and m.status == 'running':
                    m.step()
                    self.db.save(m)
                speed = m.speed if m else 5
            await asyncio.sleep(1 / speed)


@asynccontextmanager
async def lifespan(app):
    app.state.controller = Controller()
    task = asyncio.create_task(app.state.controller.run())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    m = app.state.controller.mission
    if m and m.status not in TERMINAL:
        m.status = 'paused'
        app.state.controller.db.save(m)


app = FastAPI(title='ORBIT — Rover Mission Control', version='1.0.0', lifespan=lifespan)


@app.get('/api/health')
def health():
    return {'status': 'ok', 'version': '1.0.0'}


@app.get('/api/missions')
async def history():
    return app.state.controller.db.history()


@app.get('/api/active')
async def active():
    m = app.state.controller.mission
    return m.state() if m else None


@app.post('/api/missions', status_code=201)
async def create(config: MissionConfig):
    c = app.state.controller
    async with c.lock:
        if c.mission and c.mission.status not in TERMINAL:
            c.mission.status = 'archived'
            c.mission.reason = 'Replaced by a new mission.'
            c.db.save(c.mission)
        c.mission = Mission(config)
        return c.db.save(c.mission)


@app.get('/api/missions/{mission_id}')
async def state(mission_id: str):
    c = app.state.controller
    result = c.mission.state() if c.mission and c.mission.id == mission_id else c.db.get(mission_id)
    if result is None:
        raise HTTPException(404, 'Mission not found.')
    return result


@app.get('/api/missions/{mission_id}/results')
async def results(mission_id: str):
    return (await state(mission_id))['metrics']


@app.get('/api/missions/{mission_id}/export')
async def export(mission_id: str):
    result = app.state.controller.db.export(mission_id)
    if result is None:
        raise HTTPException(404, 'Mission not found.')
    return JSONResponse(result, headers={'Content-Disposition': f'attachment; filename="orbit-{mission_id}.json"'})


@app.post('/api/missions/{mission_id}/commands')
async def command(mission_id: str, command: Command):
    c = app.state.controller
    async with c.lock:
        m = c.require(mission_id)
        if m.status in TERMINAL:
            raise HTTPException(409, 'Mission ended. Create a new mission.')
        if command.action == 'start':
            m.status = 'running'
        elif command.action == 'pause':
            m.status = 'paused'
        elif command.action == 'step':
            m.status = 'paused'
            m.step()
        elif command.action == 'return':
            m.return_requested = True
            m.status = 'running'
            m.event('return', 'Operator requested return to base.')
        elif command.action == 'speed':
            if command.speed is None:
                raise HTTPException(422, 'Provide speed between 1 and 20.')
            m.speed = command.speed
        return c.db.save(m)


@app.post('/api/missions/{mission_id}/obstacles')
async def obstacle(mission_id: str, obstacle: Obstacle):
    c = app.state.controller
    async with c.lock:
        m = c.require(mission_id)
        try:
            m.inject_obstacle(obstacle.x, obstacle.y)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        return c.db.save(m)


@app.websocket('/ws/missions/{mission_id}')
async def stream(websocket: WebSocket, mission_id: str):
    await websocket.accept()
    try:
        last = None
        while True:
            c = app.state.controller
            if not c.mission or c.mission.id != mission_id:
                await websocket.close(code=1000)
                return
            snapshot = c.mission.state()
            if snapshot != last:
                await websocket.send_json(snapshot)
                last = snapshot
            await asyncio.sleep(0.1)
    except (WebSocketDisconnect, RuntimeError):
        pass


# A built frontend is included in the ZIP: one Python command serves the app.
DIST = Path(__file__).resolve().parents[2] / 'frontend' / 'dist'
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

    @app.get('/')
    def index():
        return FileResponse(DIST / 'index.html')
