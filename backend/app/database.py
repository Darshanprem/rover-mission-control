import json
import os
import sqlite3
from pathlib import Path


class Database:
    def __init__(self):
        self.path = Path(os.environ.get('ROVER_DB', Path(__file__).resolve().parents[1] / 'data' / 'missions.db'))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
              CREATE TABLE IF NOT EXISTS missions (
                id TEXT PRIMARY KEY, created_at TEXT NOT NULL, config_json TEXT NOT NULL,
                initial_world_json TEXT NOT NULL, state_json TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS events (
                mission_id TEXT NOT NULL, event_id INTEGER NOT NULL, tick INTEGER NOT NULL,
                payload_json TEXT NOT NULL, PRIMARY KEY(mission_id, event_id));
            ''')

    def connect(self):
        return sqlite3.connect(self.path)

    def save(self, mission):
        state = mission.state()
        with self.connect() as db:
            db.execute('INSERT INTO missions VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json',
                       (mission.id, mission.created_at, json.dumps(mission.config.model_dump()), json.dumps(mission.initial_world), json.dumps(state)))
            db.executemany('INSERT OR IGNORE INTO events VALUES (?, ?, ?, ?)',
                           [(mission.id, e['id'], e['tick'], json.dumps(e)) for e in mission.events])
        return state

    def get(self, mission_id):
        with self.connect() as db:
            row = db.execute('SELECT state_json FROM missions WHERE id=?', (mission_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def history(self):
        with self.connect() as db:
            rows = db.execute('SELECT state_json FROM missions ORDER BY created_at DESC LIMIT 50').fetchall()
        return [{'id': s['id'], 'created_at': s['created_at'], 'config': s['config'], 'status': s['status'], 'metrics': s['metrics']}
                for s in (json.loads(r[0]) for r in rows)]

    def export(self, mission_id):
        state = self.get(mission_id)
        if state is None:
            return None
        with self.connect() as db:
            row = db.execute('SELECT initial_world_json FROM missions WHERE id=?', (mission_id,)).fetchone()
            events = db.execute('SELECT payload_json FROM events WHERE mission_id=? ORDER BY event_id', (mission_id,)).fetchall()
        return {'format_version': 1, 'state': state, 'initial_world': json.loads(row[0]),
                'events': [json.loads(e[0]) for e in events],
                'note': 'Initial world is evaluator data. The live planner only uses discovered cells.'}
