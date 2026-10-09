import copy
import pytest
from app.models import MissionConfig
from app.simulation import Mission, generate_world, TERMINAL, COLLECT_COST, UPLOAD_COST, CAPACITY


def complete(m, limit=1200):
    last = m.energy
    for _ in range(limit):
        if m.status in TERMINAL:
            return m
        m.step()
        assert 0 <= m.energy <= last + 1e-8
        assert len(m.cargo) <= CAPACITY
        assert m.world[m.pos[1]][m.pos[0]]['terrain'] != 'wall'
        last = m.energy
    pytest.fail(f'Mission never terminated: {m.state()}')


def known_world():
    m = Mission(MissionConfig(size=12, obstacle_density=0))
    for row in m.world:
        for cell in row:
            cell.update(terrain='plain', site=None, comm=False)
    m.known = {(x, y): copy.deepcopy(m.world[y][x]) for x in range(12) for y in range(12)}
    return m


def test_seed_reproducibility():
    assert generate_world(MissionConfig(seed=73)) == generate_world(MissionConfig(seed=73))
    assert generate_world(MissionConfig(seed=73)) != generate_world(MissionConfig(seed=74))


@pytest.mark.parametrize('scenario', ['discovery', 'rough_terrain', 'low_battery'])
@pytest.mark.parametrize('strategy', ['balanced', 'nearest'])
@pytest.mark.parametrize('seed', [7, 42, 137])
def test_normal_missions_recover_and_upload(scenario, strategy, seed):
    m = complete(Mission(MissionConfig(size=16, seed=seed, scenario=scenario, strategy=strategy)))
    assert m.status == 'completed'
    assert m.pos == m.base
    assert m.metrics()['success']
    assert m.energy > 0
    assert not m.cargo


def test_planner_does_not_read_hidden_world():
    a = Mission(MissionConfig(seed=42))
    b = copy.deepcopy(a)
    for y, row in enumerate(b.world):
        for x, cell in enumerate(row):
            if (x, y) not in b.known:
                cell.update(terrain='wall', site={'id': 'HIDDEN', 'value': 999999, 'collected': False})
    assert set(a.graph()) == set(b.graph())
    a.step()
    b.step()
    assert a.pos == b.pos
    assert a.target == b.target
    assert a.energy == b.energy


def test_collection_and_upload_are_distinct():
    m = known_world()
    p = (3, 2)
    m.pos = p
    m.known[p]['site'] = {'id': 'TEST', 'value': 30, 'collected': False}
    m.world[2][3]['site'] = copy.deepcopy(m.known[p]['site'])
    m.known[(4, 2)]['comm'] = True
    m.world[2][4]['comm'] = True
    start = m.energy
    m.step()
    assert m.energy == start - COLLECT_COST
    assert len(m.cargo) == 1 and not m.uploaded
    m.step()
    assert len(m.cargo) == 1 and not m.uploaded  # movement is not upload
    assert m.pos == (4, 2)
    start = m.energy
    m.step()
    assert m.energy == start - UPLOAD_COST
    assert not m.cargo and m.metrics()['uploaded_value'] == 30
    complete(m)
    assert m.metrics()['collected_packets'] == 1


def test_weighted_path_avoids_expensive_terrain():
    m = known_world()
    m.known[(3, 2)]['terrain'] = 'rough'
    m.known[(4, 2)]['terrain'] = 'rough'
    m.set_route(m.graph(), (5, 2), 'explore', 'test')
    assert (3, 2) not in m.path and (4, 2) not in m.path


def test_route_replans_around_injected_obstacle():
    m = known_world()
    m.pos = (5, 2)
    m.return_requested = True
    m.set_route(m.graph(), m.base, 'return_home', 'test')
    assert (4, 2) in m.path
    m.inject_obstacle(4, 2)
    assert not m.path and m.replans == 1
    m.step()
    assert m.pos != (4, 2)
    assert (4, 2) not in m.path
    assert complete(m).metrics()['returned_safely']


def test_stranding_reported_without_teleportation():
    m = known_world()
    m.pos = (5, 5)
    for x, y in [(4, 5), (6, 5), (5, 4), (5, 6)]:
        m.inject_obstacle(x, y)
    m.step()
    assert m.status == 'failed'
    assert m.pos == (5, 5)
    assert 'Stranded' in m.failure_reason


def test_bad_obstacle_edits_rejected():
    m = Mission(MissionConfig())
    for p in [m.base, (4, 2), (23, 23), (99, 99)]:
        with pytest.raises(ValueError):
            m.inject_obstacle(*p)


def test_zero_energy_fails_and_never_goes_negative():
    m = known_world()
    m.energy = 0
    m.step()
    assert m.status == 'failed' and m.energy == 0
    state = m.state()
    m.step()
    assert m.state() == state


def test_no_data_upload_outside_zone_even_at_base():
    m = known_world()
    m.cargo = [{'id': 'TEST', 'value': 40}]
    m.return_requested = True
    complete(m)
    assert m.metrics()['returned_safely']
    assert m.metrics()['uploaded_value'] == 0
    assert not m.metrics()['success']


def test_full_storage_does_not_collect_more():
    m = known_world()
    m.cargo = [{'id': str(i), 'value': 10} for i in range(CAPACITY)]
    site = {'id': 'EXTRA', 'value': 50, 'collected': False}
    m.known[m.pos]['site'] = copy.deepcopy(site)
    m.world[m.pos[1]][m.pos[0]]['site'] = copy.deepcopy(site)
    m.known[(4, 2)]['comm'] = True
    m.world[2][4]['comm'] = True
    m.step()
    assert len(m.cargo) == CAPACITY
    assert not m.world[2][2]['site']['collected']
