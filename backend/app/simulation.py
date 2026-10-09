"""Deterministic grid simulation. Planning reads `known`, never `world`.

Sensor model: an ideal radius-2 square sensor (no occlusion). One move costs
destination terrain energy plus 0.4 for sensing. All routes include this cost.
"""
import random
import uuid
from datetime import datetime, timezone
import networkx as nx
from .models import MissionConfig

COLLECT_COST = 3.0
UPLOAD_COST = 2.0
SENSOR_COST = 0.4
CAPACITY = 5
TERMINAL = {'completed', 'failed'}


def neighbors(p, size):
    x, y = p
    return [(a, b) for a, b in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            if 0 <= a < size and 0 <= b < size]


def generate_world(config):
    rng = random.Random(config.seed)
    size = config.size
    rough = 0.40 if config.scenario == 'rough_terrain' else 0.16
    world = [[{'terrain': 'wall' if rng.random() < config.obstacle_density else
               ('rough' if rng.random() < rough else 'plain'), 'site': None, 'comm': False}
              for _ in range(size)] for _ in range(size)]
    base = (2, 2)
    # Launch corridor guarantees a reachable initial relay and demonstration site.
    for y in range(1, 5):
        for x in range(1, 7):
            world[y][x]['terrain'] = 'plain'
    seen, todo = {base}, [base]
    while todo:
        for p in neighbors(todo.pop(), size):
            if p not in seen and world[p[1]][p[0]]['terrain'] != 'wall':
                seen.add(p)
                todo.append(p)
    candidates = sorted(seen - {base, (4, 2), (5, 3)})
    rng.shuffle(candidates)
    zones = [(4, 2)] + candidates[:3]
    for x, y in zones:
        world[y][x]['comm'] = True
    sites = [(5, 3)] + [p for p in candidates[3:] if p not in zones][:max(8, size // 2)]
    for index, (x, y) in enumerate(sites):
        world[y][x]['site'] = {'id': f'SCI-{index + 1:02}', 'value': rng.randint(15, 50), 'collected': False}
    return world, base


class Mission:
    def __init__(self, config: MissionConfig):
        self.id = uuid.uuid4().hex[:12]
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.config = config
        self.world, self.base = generate_world(config)
        self.initial_world = [[dict(c, site=dict(c['site']) if c['site'] else None) for c in row] for row in self.world]
        self.pos = self.base
        self.initial_energy = float(min(config.energy, 85) if config.scenario == 'low_battery' else config.energy)
        self.energy = self.initial_energy
        self.reserve = round(max(8, self.initial_energy * 0.08), 1)
        self.known = {}
        self.visited = {self.base}
        self.cargo = []
        self.uploaded = []
        self.status = 'ready'
        self.mode = 'standby'
        self.tick = 0
        self.steps = 0
        self.replans = 0
        self.speed = 5
        self.path = []
        self.target = None
        self.return_requested = False
        self.reason = 'Launch checks complete. Start the mission to explore.'
        self.failure_reason = None
        self.events = []
        self.energy_history = [{'tick': 0, 'energy': self.energy}]
        self.reveal()
        self.event('mission', 'Mission ready. Sensor sweep complete; nearby relay identified.')

    def event(self, kind, message):
        self.events.append({'id': len(self.events) + 1, 'tick': self.tick, 'type': kind, 'message': message})

    def reveal(self):
        x, y = self.pos
        discoveries = 0
        for b in range(max(0, y - 2), min(self.config.size, y + 3)):
            for a in range(max(0, x - 2), min(self.config.size, x + 3)):
                c = self.world[b][a]
                old = self.known.get((a, b))
                if old is None and c['site']:
                    discoveries += 1
                self.known[(a, b)] = dict(c, site=dict(c['site']) if c['site'] else None)
        if discoveries:
            self.event('discovery', f'Discovered {discoveries} science site(s).')

    def graph(self):
        graph = nx.DiGraph()
        for p, c in self.known.items():
            if c['terrain'] != 'wall':
                graph.add_node(p)
        for p in list(graph):
            for q in neighbors(p, self.config.size):
                if q in graph:
                    graph.add_edge(p, q, weight=self.move_cost(q))
        return graph

    def move_cost(self, p):
        return (3.0 if self.known[p]['terrain'] == 'rough' else 1.0) + SENSOR_COST

    @staticmethod
    def routes(graph, source):
        if source not in graph:
            return {}, {}
        return nx.single_source_dijkstra(graph, source, weight='weight')

    def return_option(self, graph, source, with_cargo):
        costs, paths = self.routes(graph, source)
        if not with_cargo:
            return costs.get(self.base, float('inf')), paths.get(self.base, []), self.base
        options = []
        for zone, c in self.known.items():
            if not c['comm'] or zone not in costs:
                continue
            back, _ = self.routes(graph, zone)
            if self.base in back:
                options.append((costs[zone] + UPLOAD_COST + back[self.base], paths[zone], zone))
        return min(options, key=lambda v: (v[0], v[2])) if options else (float('inf'), [], None)

    def set_route(self, graph, target, mode, reason):
        self.target = target
        self.mode = mode
        self.reason = reason
        try:
            self.path = nx.astar_path(graph, self.pos, target,
                heuristic=lambda a, b: (abs(a[0] - b[0]) + abs(a[1] - b[1])) * 1.4,
                weight='weight')[1:]
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            self.path = []

    def spend(self, amount):
        if self.energy + 1e-8 < amount:
            return False
        self.energy = max(0.0, self.energy - amount)
        return True

    def finish(self, failure=None):
        self.status = 'failed' if failure or self.energy <= 0 else 'completed'
        self.mode = 'failed' if self.status == 'failed' else 'complete'
        self.failure_reason = failure or ('Energy exhausted.' if self.energy <= 0 else None)
        self.path = []
        self.target = None
        self.reason = self.failure_reason or 'Rover safely recovered at base.'
        self.event('failure' if self.status == 'failed' else 'complete', self.reason)

    def choose_action(self):
        graph = self.graph()
        home_cost, home_path, zone = self.return_option(graph, self.pos, bool(self.cargo))
        direct_cost, _, _ = self.return_option(graph, self.pos, False)
        if direct_cost == float('inf'):
            self.finish('Stranded: no known route to base after the terrain changed.')
            return
        if self.energy + 1e-8 < direct_cost or self.energy <= 0:
            self.finish('Insufficient energy for a safe return.')
            return
        # Data recovery yields to vehicle recovery if a new obstacle made it infeasible.
        if home_cost > self.energy:
            self.return_requested = True
            home_cost, home_path, zone = self.return_option(graph, self.pos, False)
        if self.energy <= home_cost + self.reserve:
            self.return_requested = True
        here = self.known[self.pos]
        if here['comm'] and self.cargo and self.energy >= UPLOAD_COST + direct_cost:
            count, value = len(self.cargo), sum(c['value'] for c in self.cargo)
            self.spend(UPLOAD_COST)
            self.uploaded.extend(self.cargo)
            self.cargo = []
            self.mode = 'upload'
            self.path = []
            self.target = self.pos
            self.reason = f'Uploaded {count} packet(s), securing {value} science points.'
            self.event('upload', self.reason)
            return
        if self.return_requested:
            if self.pos == self.base and (not self.cargo or home_cost > self.energy or zone == self.base):
                self.finish()
                return
            target = zone if self.cargo and home_path and zone != self.base else self.base
            self.set_route(graph, target, 'return_home', 'Returning with a safe energy budget; routing via a relay when feasible.')
            self.move()
            return

        costs, _ = self.routes(graph, self.pos)
        # Collect only when the full collect → upload → return budget is feasible.
        site = here['site']
        if site and not site['collected'] and len(self.cargo) < CAPACITY:
            after_cost, _, _ = self.return_option(graph, self.pos, True)
            if self.energy >= COLLECT_COST + after_cost + self.reserve:
                self.spend(COLLECT_COST)
                self.cargo.append({'id': site['id'], 'value': site['value']})
                site['collected'] = True
                self.world[self.pos[1]][self.pos[0]]['site']['collected'] = True
                self.mode = 'collect'
                self.path = []
                self.reason = f'Collected {site["id"]}: {site["value"]} points stored onboard.'
                self.event('collect', self.reason)
                return

        if len(self.cargo) >= 3 and zone is not None:
            self.set_route(graph, zone, 'upload', 'Three packets onboard. Securing discoveries at the lowest-cost relay.')
            self.move()
            return

        candidates = []
        for p, cell in self.known.items():
            if p not in costs or p == self.pos:
                continue
            site = cell['site']
            if site and not site['collected'] and len(self.cargo) < CAPACITY:
                back, _, _ = self.return_option(graph, p, True)
                if costs[p] + COLLECT_COST + back + self.reserve <= self.energy:
                    score = site['value'] / (costs[p] + COLLECT_COST + 2)
                    candidates.append((score, p, 'collect', f'Heading to {site["id"]}: value {site["value"]}; collection, upload and return are affordable.'))
        # Science takes priority when feasible; exploration discovers new choices.
        if not candidates:
            for p in graph:
                if p == self.pos or p not in costs or not any(q not in self.known for q in neighbors(p, self.config.size)):
                    continue
                back, _, _ = self.return_option(graph, p, bool(self.cargo))
                if costs[p] + back + self.reserve > self.energy:
                    continue
                x, y = p
                gain = sum((a, b) not in self.known for a in range(max(0, x - 2), min(self.config.size, x + 3))
                           for b in range(max(0, y - 2), min(self.config.size, y + 3)))
                score = gain / (costs[p] + 2)
                candidates.append((score, p, 'explore', f'Exploring a frontier near ({x}, {y}); up to {gain} new cells within sensor range.'))
        if candidates:
            if self.config.strategy == 'nearest':
                selected = min(candidates, key=lambda c: (costs[c[1]], c[1]))
            else:
                selected = max(candidates, key=lambda c: (c[0], -costs[c[1]], c[1]))
            _, target, mode, reason = selected
            self.set_route(graph, target, mode, reason)
            self.move()
        else:
            self.return_requested = True
            self.event('return', 'No further target fits the remaining energy budget. Returning to base.')
            self.choose_action()

    def move(self):
        if not self.path:
            self.finish('No feasible route to the selected target.')
            return
        nxt = self.path[0]
        if self.world[nxt[1]][nxt[0]]['terrain'] == 'wall':
            self.known[nxt] = dict(self.world[nxt[1]][nxt[0]])
            self.path = []
            self.replans += 1
            self.event('replan', 'New blockage detected before movement. Route invalidated.')
            return
        if not self.spend(self.move_cost(nxt)):
            self.finish('Insufficient energy to move.')
            return
        self.pos = nxt
        self.path = self.path[1:]
        self.steps += 1
        self.visited.add(nxt)
        self.reveal()
        if self.pos == self.base and self.return_requested and not self.cargo:
            self.finish()

    def step(self):
        if self.status in TERMINAL:
            return
        self.tick += 1
        previous_mode = self.mode
        self.choose_action()
        if self.mode != previous_mode and self.mode not in ('collect', 'upload', 'complete', 'failed'):
            self.event('decision', self.reason)
        self.energy_history.append({'tick': self.tick, 'energy': round(self.energy, 2)})

    def inject_obstacle(self, x, y):
        p = (x, y)
        if self.status in TERMINAL:
            raise ValueError('Create a new mission before changing terrain.')
        if p not in self.known:
            raise ValueError('Choose an observed cell. Unknown terrain cannot be edited.')
        cell = self.known[p]
        if p in (self.pos, self.base) or cell['comm'] or cell['site'] or cell['terrain'] == 'wall':
            raise ValueError('Choose empty terrain away from the rover, base, relays and science sites.')
        self.world[y][x]['terrain'] = 'wall'
        self.known[p]['terrain'] = 'wall'
        self.replans += 1
        self.path = []
        self.reason = f'Terrain changed at ({x}, {y}). Replanning on the next tick.'
        self.event('replan', self.reason)

    def metrics(self):
        uploaded_value = sum(p['value'] for p in self.uploaded)
        used = self.initial_energy - self.energy
        returned = self.status == 'completed' and self.pos == self.base and self.energy > 0
        return {'observed_cells': len(self.known), 'visited_cells': len(self.visited),
                'coverage': round(100 * len(self.known) / self.config.size ** 2, 1),
                'uploaded_value': uploaded_value, 'uploaded_packets': len(self.uploaded),
                'carried_value': sum(p['value'] for p in self.cargo),
                'collected_packets': len(self.uploaded) + len(self.cargo),
                'energy_used': round(used, 2), 'efficiency': round(uploaded_value / used, 2) if used else 0,
                'steps': self.steps, 'replans': self.replans, 'returned_safely': returned,
                'success': returned and uploaded_value > 0, 'failure_reason': self.failure_reason}

    def state(self):
        cost, _, _ = self.return_option(self.graph(), self.pos, bool(self.cargo))
        return {'id': self.id, 'created_at': self.created_at, 'config': self.config.model_dump(),
                'status': self.status, 'tick': self.tick, 'speed': self.speed, 'base': list(self.base),
                'rover': {'x': self.pos[0], 'y': self.pos[1], 'energy': round(self.energy, 2),
                          'initial_energy': self.initial_energy, 'reserve': self.reserve,
                          'mode': self.mode, 'cargo': self.cargo, 'capacity': CAPACITY},
                'return_cost': round(cost, 2) if cost != float('inf') else None,
                'known_cells': [{'x': p[0], 'y': p[1], **c, 'visited': p in self.visited} for p, c in sorted(self.known.items())],
                'path': [list(p) for p in self.path], 'target': list(self.target) if self.target else None,
                'reason': self.reason, 'metrics': self.metrics(), 'events': self.events[-60:],
                'energy_history': self.energy_history[-1000:]}
