import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('ROVER_DB', str(tmp_path / 'test.db'))
    with TestClient(app) as client:
        yield client


def test_mission_api_and_persistence(client):
    assert client.get('/api/health').json()['status'] == 'ok'
    assert client.get('/api/active').json() is None
    r = client.post('/api/missions', json={'seed': 42, 'size': 12})
    assert r.status_code == 201
    m = r.json()
    mid = m['id']
    assert 'world' not in m and 'initial_world' not in m
    assert len(m['known_cells']) == 25
    with client.websocket_connect(f'/ws/missions/{mid}') as ws:
        assert ws.receive_json()['id'] == mid
    stepped = client.post(f'/api/missions/{mid}/commands', json={'action': 'step'}).json()
    assert stepped['tick'] == 1 and stepped['status'] == 'paused'
    energy = stepped['rover']['energy']
    paused = client.post(f'/api/missions/{mid}/commands', json={'action': 'pause'}).json()
    assert paused['rover']['energy'] == energy
    assert client.post(f'/api/missions/{mid}/commands', json={'action': 'speed', 'speed': 10}).json()['speed'] == 10
    assert client.get(f'/api/missions/{mid}/results').status_code == 200
    report = client.get(f'/api/missions/{mid}/export')
    assert report.status_code == 200 and 'attachment' in report.headers['content-disposition']
    assert report.json()['events'] and report.json()['initial_world']
    assert client.get('/api/missions').json()[0]['id'] == mid
    client.post('/api/missions', json={'seed': 7})
    assert client.get(f'/api/missions/{mid}').json()['status'] == 'archived'
    assert client.post(f'/api/missions/{mid}/commands', json={'action': 'step'}).status_code == 409


def test_validation(client):
    assert client.post('/api/missions', json={'size': 2}).status_code == 422
    assert client.post('/api/missions', json={'obstacle_density': .9}).status_code == 422
    mid = client.post('/api/missions', json={}).json()['id']
    assert client.post(f'/api/missions/{mid}/commands', json={'action': 'speed', 'speed': 100}).status_code == 422
    assert client.post(f'/api/missions/{mid}/commands', json={'action': 'speed'}).status_code == 422
    assert client.post(f'/api/missions/{mid}/obstacles', json={'x': 2, 'y': 2}).status_code == 422
    assert client.get('/api/missions/missing').status_code == 404


def test_database_survives_restart(tmp_path, monkeypatch):
    monkeypatch.setenv('ROVER_DB', str(tmp_path / 'persist.db'))
    with TestClient(app) as client:
        mid = client.post('/api/missions', json={}).json()['id']
        client.post(f'/api/missions/{mid}/commands', json={'action': 'step'})
    with TestClient(app) as client:
        assert client.get('/api/active').json() is None
        assert client.get(f'/api/missions/{mid}').json()['tick'] == 1
        assert client.get('/api/missions').json()[0]['id'] == mid
